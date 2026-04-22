const db = require("../config/db.config");
const { uploadToDrive, getFileStream } = require("../utils/googleDrive");
const { createNotification } = require("../utils/notification");

// Helper to calculate reminder time
const calculateReminderTime = (dueDate, timeValue, timeUnit, triggerType) => {
  if (!dueDate) return null;
  let date = new Date(dueDate);
  if (isNaN(date.getTime())) return null;

  let ms = 0;
  const value = parseInt(timeValue);
  if (timeUnit === "minutes") ms = value * 60 * 1000;
  else if (timeUnit === "hours") ms = value * 60 * 60 * 1000;
  else if (timeUnit === "days") ms = value * 24 * 60 * 60 * 1000;

  return triggerType === "before"
    ? new Date(date.getTime() - ms)
    : new Date(date.getTime() + ms);
};

exports.createDelegation = async (req, res) => {
  const {
    delegation_name,
    taskTitle,
    description,
    delegator_id,
    assignerId,
    delegator_name,
    assignerName,
    doer_id,
    doerId,
    doer_name,
    doerName,
    department,
    priority,
    due_date,
    dueDate,
    evidence_required,
    evidenceRequired,
    category,
    tags,
    checklist,
    checklistItems,
    repeat_settings,
    isRepeat,
    inLoopIds,
    in_loop_ids,
    groupId,
    group_id,
    parentId,
    parent_id,
    reminders,
  } = req.body;

  // Normalize fields
  const final_name = taskTitle || delegation_name;
  const final_delegator_id = parseInt(assignerId || delegator_id);
  const rawDoerIds = Array.isArray(doerId)
    ? doerId
    : doerId
      ? [doerId]
      : doer_id
        ? [doer_id]
        : [];
  const final_doer_ids = rawDoerIds
    .map((id) => parseInt(id))
    .filter((id) => !isNaN(id));

  const final_due_date = dueDate || due_date;
  const final_evidence_req =
    evidenceRequired !== undefined
      ? evidenceRequired === "true" || evidenceRequired === true
      : evidence_required === "true" || evidence_required === true;
  const final_checklist = checklistItems || checklist;

  const rawInLoop = inLoopIds || in_loop_ids || [];
  const final_in_loop = Array.isArray(rawInLoop)
    ? rawInLoop.map((id) => parseInt(id)).filter((id) => !isNaN(id))
    : [];

  const final_group_id =
    groupId || group_id ? parseInt(groupId || group_id) : null;
  const final_parent_id =
    parentId || parent_id ? parseInt(parentId || parent_id) : null;

  let voice_note_url = null;
  let reference_docs = [];

  try {
    if (req.files && req.files["voice_note"]) {
      const file = req.files["voice_note"][0];
      try {
        voice_note_url = await uploadToDrive(
          file.buffer,
          file.originalname,
          file.mimetype,
        );
      } catch (e) {
        voice_note_url = `/uploads/voice_${Date.now()}.mp3`;
      }
    }
    if (req.files && req.files["reference_docs"]) {
      reference_docs = await Promise.all(
        req.files["reference_docs"].map(async (f) => {
          try {
            return await uploadToDrive(f.buffer, f.originalname, f.mimetype);
          } catch (e) {
            return null;
          }
        }),
      );
      reference_docs = reference_docs.filter((u) => u !== null);
    }
  } catch (e) {
    console.error("Upload error:", e);
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const results = [];

    for (const targetDoerId of final_doer_ids) {
      const query = `
                INSERT INTO delegation (
                    delegation_name, description, delegator_id, delegator_name,
                    doer_id, doer_name, department, priority, due_date, 
                    voice_note_url, reference_docs, evidence_required,
                    status, category, tags, checklist, repeat_settings,
                    in_loop_ids, group_id, parent_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`;

      const values = [
        final_name,
        description,
        final_delegator_id,
        delegator_name || assignerName,
        targetDoerId,
        doer_name || doerName,
        department,
        priority,
        final_due_date,
        voice_note_url,
        reference_docs,
        final_evidence_req,
        "Pending",
        category || "Category",
        JSON.stringify(tags || []),
        JSON.stringify(final_checklist || []),
        JSON.stringify(repeat_settings || {}),
        final_in_loop,
        final_group_id,
        final_parent_id,
      ];

      const resDelegation = await client.query(query, values);
      const newDelegation = resDelegation.rows[0];
      results.push(newDelegation);

      // Handle reminders
      if (reminders && Array.isArray(reminders)) {
        for (const r of reminders) {
          const rTime = calculateReminderTime(
            final_due_date,
            r.timeValue,
            r.timeUnit,
            r.triggerType,
          );
          if (rTime) {
            await client.query(
              `INSERT INTO task_reminders (delegation_id, type, time_value, time_unit, trigger_type, reminder_time)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                newDelegation.id,
                r.type,
                r.timeValue,
                r.timeUnit,
                r.triggerType,
                rTime,
              ],
            );
          }
        }
      }

      // Create notification for doer
      await createNotification(
        targetDoerId,
        "New Task Assigned",
        `You have been assigned: ${final_name}`,
        "delegation",
        newDelegation.id,
      );
    }

    await client.query("COMMIT");
    res
      .status(201)
      .json({
        success: true,
        message: "Delegation(s) created",
        data: results[0],
      });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error creating delegation" });
  } finally {
    if (client) client.release();
  }
};

exports.getDelegations = async (req, res) => {
  const { role } = req.user;
  const userId = req.user.id || req.user.User_Id;
  try {
    let query,
      values = [];
    if (role === "SuperAdmin" || role === "Admin") {
      query =
        "SELECT * FROM delegation WHERE deleted_at IS NULL ORDER BY created_at DESC";
    } else {
      query =
        "SELECT * FROM delegation WHERE deleted_at IS NULL AND (doer_id = $1 OR delegator_id = $1 OR $1 = ANY(in_loop_ids) OR $1 = ANY(subscribed_by)) ORDER BY created_at DESC";
      values = [userId];
    }
    const result = await db.query(query, values);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching delegations" });
  }
};

exports.addRemark = async (req, res) => {
  const { id } = req.params;
  const { remark } = req.body;
  const userId = req.user.id || req.user.User_Id;
  const username = req.user.email || req.user.name;
  try {
    const query =
      "INSERT INTO remark (delegation_id, user_id, username, remark) VALUES ($1, $2, $3, $4) RETURNING *";
    const result = await db.query(query, [id, userId, username, remark]);
    await db.query(
      "UPDATE delegation SET remarks = array_append(remarks, $1) WHERE id = $2",
      [remark, id],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error adding remark" });
  }
};

exports.getDelegationDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const delegationRes = await db.query(
      "SELECT * FROM delegation WHERE id = $1",
      [id],
    );
    if (delegationRes.rows.length === 0)
      return res.status(404).json({ message: "Not found" });
    const remarksRes = await db.query(
      "SELECT * FROM remark WHERE delegation_id = $1 ORDER BY created_at ASC",
      [id],
    );
    const historyRes = await db.query(
      "SELECT * FROM revision_history WHERE delegation_id = $1 ORDER BY created_at DESC",
      [id],
    );
    const remindersRes = await db.query(
      "SELECT * FROM task_reminders WHERE delegation_id = $1",
      [id],
    );

    const data = delegationRes.rows[0];
    data.remarks_detail = remarksRes.rows;
    data.revision_history_detail = historyRes.rows;
    data.reminders = remindersRes.rows;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.updateDelegation = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT * FROM delegation WHERE id = $1",
      [id],
    );
    if (!current.rows.length) throw new Error("Not found");

    const old = current.rows[0];
    let newRevCount = Number(old.revision_count || 0);
    if (
      updates.status &&
      updates.status !== old.status &&
      ["NEED REVISION", "HOLD", "NEED CLARITY"].includes(updates.status)
    ) {
      newRevCount += 1;
    }

    const updateQuery = `
            UPDATE delegation SET
                delegation_name = COALESCE($1, delegation_name),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                due_date = COALESCE($5, due_date),
                category = COALESCE($6, category),
                revision_count = $7,
                checklist = COALESCE($8, checklist),
                tags = COALESCE($9, tags),
                completed_at = CASE WHEN $3 = 'Completed' THEN NOW() ELSE completed_at END
            WHERE id = $10 RETURNING *`;

    const values = [
      updates.taskTitle || updates.delegation_name || null,
      updates.description || null,
      updates.status || null,
      updates.priority || null,
      updates.dueDate || updates.due_date || null,
      updates.category || null,
      newRevCount,
      updates.checklistItems || updates.checklist
        ? JSON.stringify(updates.checklistItems || updates.checklist)
        : null,
      updates.tags ? JSON.stringify(updates.tags) : null,
      id,
    ];

    const result = await client.query(updateQuery, values);
    if (updates.remark) {
      await client.query(
        "INSERT INTO remark (delegation_id, user_id, username, remark) VALUES ($1, $2, $3, $4)",
        [id, req.user.id, req.user.email, updates.remark],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

exports.deleteDelegation = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM delegation WHERE id = $1", [id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.softDeleteDelegation = async (req, res) => {
  const { id } = req.params;
  const user = req.user.email || req.user.name || "System";
  try {
    const reslt = await db.query(
      "UPDATE delegation SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 RETURNING *",
      [user, id],
    );
    res.json({ success: true, data: reslt.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.restoreDelegation = async (req, res) => {
  const { id } = req.params;
  try {
    const reslt = await db.query(
      "UPDATE delegation SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 RETURNING *",
      [id],
    );
    res.json({ success: true, data: reslt.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.subscribeToDelegation = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id || req.user.User_Id;
  try {
    const reslt = await db.query(
      "UPDATE delegation SET subscribed_by = array_append(subscribed_by, $1) WHERE id = $2 AND NOT ($1 = ANY(subscribed_by)) RETURNING *",
      [userId, id],
    );
    res.json({ success: true, data: reslt.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.getMyTasks = async (req, res) => {
  const userId = req.user.id || req.user.User_Id;
  try {
    const result = await db.query(
      "SELECT * FROM delegation WHERE doer_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
      [userId],
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.getDelegatedTasks = async (req, res) => {
  const userId = req.user.id || req.user.User_Id;
  try {
    const result = await db.query(
      "SELECT * FROM delegation WHERE delegator_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
      [userId],
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.getSubscribedTasks = async (req, res) => {
  const userId = req.user.id || req.user.User_Id;
  try {
    const result = await db.query(
      "SELECT * FROM delegation WHERE ($1 = ANY(subscribed_by) OR $1 = ANY(in_loop_ids)) AND deleted_at IS NULL ORDER BY created_at DESC",
      [userId],
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.getAllTasks = async (req, res) => {
  const userId = req.user.id || req.user.User_Id;
  const { role } = req.user;
  try {
    let query,
      values = [];
    if (role === "Admin" || role === "SuperAdmin") {
      query =
        "SELECT * FROM delegation WHERE deleted_at IS NULL ORDER BY created_at DESC";
    } else {
      query =
        "SELECT * FROM delegation WHERE deleted_at IS NULL AND (doer_id = $1 OR delegator_id = $1 OR $1 = ANY(in_loop_ids) OR $1 = ANY(subscribed_by)) ORDER BY created_at DESC";
      values = [userId];
    }
    const result = await db.query(query, values);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.getDeletedTasks = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM delegation WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

exports.streamAudio = async (req, res) => {
  const { fileId } = req.params;
  try {
    const stream = await getFileStream(fileId);
    res.setHeader("Content-Type", "audio/webm");
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: "Error streaming audio" });
  }
};
