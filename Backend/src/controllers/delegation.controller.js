const db = require('../config/db.config');
const { uploadToDrive } = require('../utils/googleDrive');

// Create a new delegation
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
        if (req.files['voice_note']) {
            const file = req.files['voice_note'][0];
            voice_note_url = await uploadToDrive(file.buffer, file.originalname, file.mimetype);
        }

        if (req.files['reference_docs']) {
            reference_docs = await Promise.all(
                req.files['reference_docs'].map(file =>
                    uploadToDrive(file.buffer, file.originalname, file.mimetype)
                )
            );
        }
    } catch (uploadError) {
        console.error('File upload failed:', uploadError);
        return res.status(500).json({ message: 'Error uploading files to Google Drive' });
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
            evidence_required === 'true' || evidence_required === true, // handle string from multipart
            'NEED CLARITY'
        ];

        const result = await db.query(query, values);
        console.log(result.rows[0]);
        res.status(201).json(result.rows[0]);
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
