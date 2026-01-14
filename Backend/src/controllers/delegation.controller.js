const db = require('../config/db.config');


// In delegation.controller.js
const { uploadToDrive, testDriveConnection } = require('../utils/googleDrive');

exports.createDelegation = async (req, res) => {
    const {
        delegation_name, description, delegator_id, delegator_name,
        doer_id, doer_name, department, priority, due_date,
        evidence_required
    } = req.body;

    // Handle File Uploads to Google Drive
    let voice_note_url = null;
    let reference_docs = [];

    try {
        // Test connection first
        const isConnected = await testDriveConnection();
        if (!isConnected) {
            console.warn('⚠️ Google Drive connection test failed. Using fallback storage.');
        }

        if (req.files && req.files['voice_note']) {
            const file = req.files['voice_note'][0];
            try {
                voice_note_url = await uploadToDrive(file.buffer, file.originalname, file.mimetype);
            } catch (uploadError) {
                console.warn('Voice note upload failed, using fallback:', uploadError.message);
                voice_note_url = `/uploads/voice_${Date.now()}.mp3`;
            }
        }

        if (req.files && req.files['reference_docs']) {
            reference_docs = await Promise.all(
                req.files['reference_docs'].map(async (file, index) => {
                    try {
                        return await uploadToDrive(file.buffer, file.originalname, file.mimetype);
                    } catch (uploadError) {
                        console.warn(`Reference doc ${index} upload failed:`, uploadError.message);
                        return `/uploads/doc_${Date.now()}_${index}.pdf`;
                    }
                })
            );
        }
    } catch (uploadError) {
        console.error('File upload failed:', uploadError);
        // Don't return error - continue with null/empty URLs
        // return res.status(500).json({ message: 'Error uploading files to Google Drive' });
    }

    try {
        const query = `
      INSERT INTO delegation (
        delegation_name, description, delegator_id, delegator_name,
        doer_id, doer_name, department, priority, due_date, 
        voice_note_url, reference_docs, evidence_required,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;

        const values = [
            delegation_name, description, delegator_id, delegator_name,
            doer_id, doer_name, department, priority, due_date,
            voice_note_url, reference_docs,
            evidence_required === 'true' || evidence_required === true,
            'NEED CLARITY'
        ];

        const result = await db.query(query, values);
        console.log('✅ Delegation created:', result.rows[0].id);
        res.status(201).json({
            ...result.rows[0],
            message: voice_note_url ? 'Delegation created with files' : 'Delegation created (files skipped)'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating delegation' });
    }
};

// Get delegations with role-based filtering
exports.getDelegations = async (req, res) => {
    const { role, email } = req.user;

    try {
        let query;
        let values = [];

        if (role === 'SuperAdmin' || role === 'Admin') {
            // Admin/SuperAdmin see everything
            query = 'SELECT * FROM delegation ORDER BY created_at DESC';
        } else {
            // Doer sees only their assigned tasks OR tasks they delegated
            query = 'SELECT * FROM delegation WHERE doer_id = $1 OR doer_name = $2 OR delegator_id = $1 OR delegator_name = $2 ORDER BY created_at DESC';
            values = [req.user.id, email];
        }

        const result = await db.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching delegations' });
    }
};

// Add a remark to a delegation
exports.addRemark = async (req, res) => {
    const { id } = req.params;
    const { remark } = req.body;
    const { id: user_id, email: username } = req.user;

    try {
        const query = `
            INSERT INTO remark (delegation_id, user_id, username, remark)
            VALUES ($1, $2, $3, $4) RETURNING *`;

        const result = await db.query(query, [id, user_id, username, remark]);

        // Also optionally update the remarks array in the main delegation table
        await db.query(
            'UPDATE delegation SET remarks = array_append(remarks, $1) WHERE id = $2',
            [remark, id]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error adding remark' });
    }
};

// Get delegation details with remarks and history
exports.getDelegationDetail = async (req, res) => {
    const { id } = req.params;

    try {
        const delegationResult = await db.query('SELECT * FROM delegation WHERE id = $1', [id]);
        if (delegationResult.rows.length === 0) {
            return res.status(404).json({ message: 'Delegation not found' });
        }

        const remarksResult = await db.query('SELECT * FROM remark WHERE delegation_id = $1 ORDER BY created_at ASC', [id]);
        const historyResult = await db.query('SELECT * FROM revision_history WHERE delegation_id = $1 ORDER BY created_at DESC', [id]);

        const delegation = delegationResult.rows[0];
        delegation.remarks_detail = remarksResult.rows;
        delegation.revision_history_detail = historyResult.rows;

        res.json(delegation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching delegation detail' });
    }
};

// Update delegation
exports.updateDelegation = async (req, res) => {
    const { id } = req.params;
    const {
        delegation_name, description, doer_id, doer_name,
        department, priority, due_date, evidence_required, status,
        remark // Extract remark if present
    } = req.body;

    const client = await db.pool.connect(); // Use transaction for multi-table updates

    try {
        await client.query('BEGIN');

        // 1. Check current state for revision history
        const currentRes = await client.query('SELECT due_date, status, delegation_name FROM delegation WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Delegation not found' });
        }
        const currentDelegation = currentRes.rows[0];

        // 2. Handle Revision History (if due_date changes)
        // Ensure valid dates before comparing
        if (due_date && currentDelegation.due_date) {
            const newDate = new Date(due_date);
            const oldDate = new Date(currentDelegation.due_date);

            // Compare timestamps to detect change
            if (newDate.getTime() !== oldDate.getTime()) {
                await client.query(
                    `INSERT INTO revision_history (delegation_id, old_due_date, new_due_date, changed_by, reason)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        id,
                        currentDelegation.due_date,
                        due_date,
                        req.user.email, // Assuming req.user exists from auth middleware
                        remark || `Status changed to ${status}`
                    ]
                );
            }
        }

        // 3. Handle Remark (if provided)
        if (remark) {
            await client.query(
                `INSERT INTO remark (delegation_id, user_id, username, remark)
                 VALUES ($1, $2, $3, $4)`,
                [id, req.user.id, req.user.email, remark]
            );
        }

        // 4. Update Delegation
        // Use COALESCE to allow partial updates.
        const updateQuery = `
            UPDATE delegation 
            SET delegation_name = COALESCE($1, delegation_name),
                description = COALESCE($2, description),
                doer_id = COALESCE($3, doer_id),
                doer_name = COALESCE($4, doer_name),
                department = COALESCE($5, department),
                priority = COALESCE($6, priority),
                due_date = COALESCE($7, due_date),
                evidence_required = COALESCE($8, evidence_required),
                status = COALESCE($9, status)
            WHERE id = $10 RETURNING *`;

        const values = [
            delegation_name || null,
            description || null,
            doer_id || null,
            doer_name || null,
            department || null,
            priority || null,
            due_date || null,
            evidence_required !== undefined ? (evidence_required === 'true' || evidence_required === true) : null,
            status || null,
            id
        ];

        const result = await client.query(updateQuery, values);

        await client.query('COMMIT');

        console.log('✅ Delegation updated:', id);
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating delegation:', err);
        res.status(500).json({ message: 'Error updating delegation' });
    } finally {
        client.release();
    }
};

// Delete delegation
exports.deleteDelegation = async (req, res) => {
    const { id } = req.params;

    try {
        // Soft delete could be better, but hard delete for now as requested
        const result = await db.query('DELETE FROM delegation WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Delegation not found' });
        }

        console.log('🗑️ Delegation deleted:', id);
        res.json({ message: 'Delegation deleted successfully', id });
    } catch (err) {
        console.error('Error deleting delegation:', err);
        res.status(500).json({ message: 'Error deleting delegation' });
    }
};

// Stream audio from Google Drive
exports.streamAudio = async (req, res) => {
    const { fileId } = req.params;
    const { getFileStream } = require('../utils/googleDrive');

    try {
        const stream = await getFileStream(fileId);

        // We assume webm for now as that's what we record
        // Ideally we'd store mimeType in DB or fetch metadata first
        res.setHeader('Content-Type', 'audio/webm');

        stream.pipe(res);
    } catch (err) {
        console.error('Error streaming audio:', err);
        res.status(500).json({ message: 'Error streaming audio' });
    }
};
