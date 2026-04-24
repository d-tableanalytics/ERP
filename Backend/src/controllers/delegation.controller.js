const db = require("../config/db.config");
const { uploadToDrive, getFileStream } = require("../utils/googleDrive");
const { createNotification } = require("../utils/notification");
const { notifyUser } = require("../services/notificationService");

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
        final_parent_id
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
      await notifyUser('TASK_CREATED', {
        ...newDelegation,
        triggeredById: final_delegator_id
      });
      if (false) await createNotification(
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
        "SELECT * FROM delegation WHERE record_source = 'delegation' AND deleted_at IS NULL ORDER BY created_at DESC";
    } else {
      query =
        "SELECT * FROM delegation WHERE record_source = 'delegation' AND deleted_at IS NULL AND (doer_id = $1 OR (delegator_id = $1 AND doer_id != $1) OR $1 = ANY(in_loop_ids) OR $1 = ANY(subscribed_by)) ORDER BY created_at DESC";
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
    const delegationRes = await db.query("SELECT * FROM delegation WHERE id = $1", [
      id,
    ]);
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
    const subtasksRes = await db.query(
      `SELECT
          id,
          delegation_name AS "taskTitle",
          description,
          doer_id AS "doerId",
          doer_name AS "doerName",
          status,
          priority,
          due_date AS "dueDate",
          created_at AS "createdAt",
          parent_id AS "parentId"
       FROM delegation
       WHERE parent_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [id],
    );

    const row = delegationRes.rows[0];
    const { record_source, ...delegationRow } = row;
    const remarks = remarksRes.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      remark: r.remark,
      createdAt: r.created_at,
    }));
    const revisionHistory = historyRes.rows.map((h) => ({
      id: h.id,
      oldDueDate: h.old_due_date,
      newDueDate: h.new_due_date,
      oldStatus: h.old_status,
      newStatus: h.new_status,
      reason: h.reason,
      changedBy: h.changed_by,
      createdAt: h.created_at,
    }));
    const reminders = remindersRes.rows.map((r) => ({
      id: r.id,
      type: r.type,
      timeValue: r.time_value,
      timeUnit: r.time_unit,
      triggerType: r.trigger_type,
      reminderTime: r.reminder_time,
    }));

    const referenceDocsList = Array.isArray(row.reference_docs)
      ? row.reference_docs
      : row.reference_docs
        ? [row.reference_docs]
        : [];

    const data = {
      ...delegationRow,
      taskTitle: delegationRow.delegation_name,
      delegatorId: delegationRow.delegator_id,
      assignerId: delegationRow.delegator_id,
      delegatorName: delegationRow.delegator_name,
      assignerName: delegationRow.delegator_name,
      doerId: delegationRow.doer_id,
      doerName: delegationRow.doer_name,
      dueDate: delegationRow.due_date,
      checklistItems: delegationRow.checklist,
      repeatSettings: delegationRow.repeat_settings,
      inLoopIds: delegationRow.in_loop_ids,
      groupId: delegationRow.group_id,
      parentId: delegationRow.parent_id,
      voiceNoteUrl: delegationRow.voice_note_url,
      referenceDocs: referenceDocsList.join(","),
      referenceDocsList,
      evidenceRequired: delegationRow.evidence_required,
      evidenceUrl: delegationRow.evidence_url || delegationRow.evidenceUrl || null,
      createdAt: delegationRow.created_at,
      completedAt: delegationRow.completed_at,
      remarks,
      remarks_detail: remarks,
      revision_history: revisionHistory,
      revisionHistory,
      revision_history_detail: revisionHistory,
      reminders,
      subtasks: subtasksRes.rows,
    };

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

    const parseIdArray = (value) => {
      if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'null') return null;
      const raw = Array.isArray(value) ? value : (typeof value === 'string' ? (() => {
        try { return JSON.parse(value); } catch { return [value]; }
      })() : [value]);
      const ids = raw
        .map((v) => parseInt(v))
        .filter((v) => !isNaN(v));
      return ids.length > 0 ? ids : null;
    };

    const parseBoolean = (value) => {
      if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'null') return null;
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      return null;
    };
    const parseString = (value) => {
      if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'null') return null;
      const str = String(value).trim();
      return str || null;
    };
    const parseJSON = (value, fallback = null) => {
      if (value === undefined || value === null) return fallback;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      }
      return value;
    };

    const finalDoerIds = parseIdArray(updates.doerId || updates.doer_id);
    let finalDoerId = Array.isArray(finalDoerIds) ? finalDoerIds[0] : null;
    let finalDoerName = updates.doerName || updates.doer_name || null;

    if (finalDoerId && !finalDoerName) {
      const userRes = await client.query(
        "SELECT first_name, last_name FROM employees WHERE user_id = $1",
        [finalDoerId],
      );
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        finalDoerName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      }
    }

    const finalInLoopIds = parseIdArray(updates.inLoopIds || updates.in_loop_ids);
    const finalGroupId = updates.groupId || updates.group_id ? parseInt(updates.groupId || updates.group_id) : null;
    const finalParentId = updates.parentId || updates.parent_id ? parseInt(updates.parentId || updates.parent_id) : null;
    const finalEvidenceRequired = parseBoolean(updates.evidenceRequired ?? updates.evidence_required);
    const parsedChecklist = parseJSON(updates.checklistItems || updates.checklist, null);
    const parsedTags = parseJSON(updates.tags, null);
    const parsedStatus = parseString(updates.status);
    const parsedPriority = parseString(updates.priority);
    const parsedDueDate = parseString(updates.dueDate || updates.due_date);
    const parsedDescription = parseString(updates.description);
    const parsedTaskTitle = parseString(updates.taskTitle || updates.delegation_name);
    const parsedDepartment = parseString(updates.department);
    const parsedCategory = parseString(updates.category);

    const dueDateInput = parsedDueDate;
    const finalDueDateForReminder = dueDateInput || old.due_date;
    const statusChanged =
      parsedStatus &&
      String(parsedStatus).trim() !== "" &&
      String(parsedStatus) !== String(old.status);
    const dueDateChanged = (() => {
      if (!dueDateInput) return false;
      const oldMs = old?.due_date ? new Date(old.due_date).getTime() : null;
      const newMs = new Date(dueDateInput).getTime();
      if (Number.isNaN(newMs)) return false;
      if (oldMs === null) return true;
      return newMs !== oldMs;
    })();
    const changedBy =
      updates.changedBy ||
      req.user?.id ||
      req.user?.User_Id ||
      req.user?.email ||
      req.user?.name ||
      "System";
    const revisionReason =
      updates.reason ||
      (statusChanged
        ? `Status updated to ${parsedStatus}`
        : dueDateChanged
          ? "Due date updated"
          : null);
    const parsedReminders = parseJSON(
      updates.reminders,
      updates.reminders === undefined ? null : [],
    );
    const normalizeMediaUrls = (value) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === "undefined" ||
        value === "null"
      ) {
        return [];
      }

      if (Array.isArray(value)) {
        return value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean);
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed
              .map((item) => (typeof item === "string" ? item.trim() : ""))
              .filter(Boolean);
          }
          if (typeof parsed === "string" && parsed.trim()) {
            return [parsed.trim()];
          }
        } catch (e) {
          // Fallback to comma-separated parsing.
        }

        return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
      }

      return [];
    };
    const uploadBatchToDrive = async (files = []) => {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          try {
            return await uploadToDrive(file.buffer, file.originalname, file.mimetype);
          } catch (uploadErr) {
            console.error(`Failed to upload "${file.originalname}"`, uploadErr);
            return null;
          }
        }),
      );
      return uploaded.filter(Boolean);
    };

    const existingReferenceDocs = normalizeMediaUrls(old.reference_docs);
    const existingEvidenceUrls = normalizeMediaUrls(old.evidence_url);
    const hasReferenceDocsUpdate =
      Object.prototype.hasOwnProperty.call(updates, "referenceDocs") ||
      Object.prototype.hasOwnProperty.call(updates, "reference_docs");
    const hasEvidenceUpdate =
      Object.prototype.hasOwnProperty.call(updates, "evidenceUrl") ||
      Object.prototype.hasOwnProperty.call(updates, "evidence_url");
    const hasVoiceUpdate =
      Object.prototype.hasOwnProperty.call(updates, "voiceNoteUrl") ||
      Object.prototype.hasOwnProperty.call(updates, "voice_note_url");

    let uploadedVoiceNoteUrl = null;
    if (req.files?.voice_note?.length) {
      const voiceFile = req.files.voice_note[0];
      try {
        uploadedVoiceNoteUrl = await uploadToDrive(
          voiceFile.buffer,
          voiceFile.originalname,
          voiceFile.mimetype,
        );
      } catch (uploadErr) {
        console.error(`Failed to upload voice note "${voiceFile.originalname}"`, uploadErr);
      }
    }

    const uploadedReferenceDocs = await uploadBatchToDrive(
      req.files?.reference_docs || [],
    );
    const uploadedEvidenceUrls = await uploadBatchToDrive(
      req.files?.evidence_files || [],
    );

    let finalVoiceNoteUrl = null;
    if (uploadedVoiceNoteUrl) {
      finalVoiceNoteUrl = uploadedVoiceNoteUrl;
    } else if (hasVoiceUpdate) {
      const voiceFromBody = updates.voiceNoteUrl ?? updates.voice_note_url;
      finalVoiceNoteUrl =
        typeof voiceFromBody === "string" && voiceFromBody.trim()
          ? voiceFromBody.trim()
          : null;
    }

    let finalReferenceDocs = hasReferenceDocsUpdate
      ? normalizeMediaUrls(updates.referenceDocs ?? updates.reference_docs)
      : null;
    if (uploadedReferenceDocs.length > 0) {
      finalReferenceDocs = [
        ...(finalReferenceDocs ?? existingReferenceDocs),
        ...uploadedReferenceDocs,
      ];
    }
    if (Array.isArray(finalReferenceDocs)) {
      finalReferenceDocs = [...new Set(finalReferenceDocs)];
    }

    let finalEvidenceUrls = hasEvidenceUpdate
      ? normalizeMediaUrls(updates.evidenceUrl ?? updates.evidence_url)
      : null;
    if (uploadedEvidenceUrls.length > 0) {
      finalEvidenceUrls = [
        ...(finalEvidenceUrls ?? existingEvidenceUrls),
        ...uploadedEvidenceUrls,
      ];
    }
    if (Array.isArray(finalEvidenceUrls)) {
      finalEvidenceUrls = [...new Set(finalEvidenceUrls)];
    }
    const serializedEvidenceUrls =
      finalEvidenceUrls !== null ? JSON.stringify(finalEvidenceUrls) : null;

    const updateQuery = `
            UPDATE delegation SET
                delegation_name = COALESCE($1, delegation_name),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                due_date = COALESCE($5, due_date),
                doer_id = COALESCE($6, doer_id),
                doer_name = COALESCE($7, doer_name),
                department = COALESCE($8, department),
                category = COALESCE($9, category),
                evidence_required = COALESCE($10, evidence_required),
                in_loop_ids = COALESCE($11, in_loop_ids),
                group_id = COALESCE($12, group_id),
                parent_id = COALESCE($13, parent_id),
                revision_count = $14,
                checklist = COALESCE($15, checklist),
                tags = COALESCE($16, tags),
                repeat_settings = COALESCE($17, repeat_settings),
                voice_note_url = COALESCE($18, voice_note_url),
                reference_docs = COALESCE($19, reference_docs),
                evidence_url = COALESCE($20, evidence_url),
                completed_at = CASE WHEN LOWER($3) = 'completed' THEN NOW() ELSE completed_at END
            WHERE id = $21 RETURNING *`;

    const values = [
      parsedTaskTitle,
      parsedDescription,
      parsedStatus,
      parsedPriority,
      parsedDueDate,
      finalDoerId,
      finalDoerName,
      parsedDepartment,
      parsedCategory,
      finalEvidenceRequired,
      finalInLoopIds,
      finalGroupId,
      finalParentId,
      newRevCount,
      parsedChecklist !== null ? JSON.stringify(parsedChecklist) : null,
      parsedTags !== null ? JSON.stringify(parsedTags) : null,
      updates.repeatSettings || updates.repeat_settings ? JSON.stringify(updates.repeatSettings || updates.repeat_settings) : null,
      finalVoiceNoteUrl,
      finalReferenceDocs,
      serializedEvidenceUrls,
      id,
    ];

    const result = await client.query(updateQuery, values);
    const updated = result.rows[0];

    if (statusChanged || dueDateChanged) {
      await client.query(
        `INSERT INTO revision_history
          (delegation_id, old_due_date, new_due_date, old_status, new_status, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          old.due_date,
          dueDateInput || old.due_date,
          old.status,
          parsedStatus || old.status,
          revisionReason,
          String(changedBy),
        ],
      );
      await client.query(
        "UPDATE delegation SET revision_history = array_append(revision_history, $1::jsonb) WHERE id = $2",
        [
          JSON.stringify({
            oldStatus: old.status,
            newStatus: parsedStatus || old.status,
            oldDueDate: old.due_date,
            newDueDate: dueDateInput || old.due_date,
            reason: revisionReason,
            changedBy: String(changedBy),
            createdAt: new Date().toISOString(),
          }),
          id,
        ],
      );
    }

    if (updates.remark) {
      await client.query(
        "INSERT INTO remark (delegation_id, user_id, username, remark) VALUES ($1, $2, $3, $4)",
        [
          id,
          req.user.id || req.user.User_Id || changedBy,
          req.user.email || req.user.name || String(changedBy),
          updates.remark,
        ],
      );
      await client.query(
        "UPDATE delegation SET remarks = array_append(remarks, $1) WHERE id = $2",
        [updates.remark, id],
      );
    }

    if (parsedReminders !== null && Array.isArray(parsedReminders)) {
      await client.query("DELETE FROM task_reminders WHERE delegation_id = $1", [id]);
      for (const reminder of parsedReminders) {
        const timeValue = parseInt(
          reminder?.timeValue ?? reminder?.timingValue ?? "0",
          10,
        );
        const timeUnit =
          reminder?.timeUnit || reminder?.timingUnit || "minutes";
        const triggerTypeRaw =
          reminder?.triggerType || reminder?.timingRelation || "before";
        const triggerType =
          String(triggerTypeRaw).toLowerCase() === "after" ? "after" : "before";
        const type = reminder?.type || reminder?.medium || "Email";
        const reminderTime = calculateReminderTime(
          finalDueDateForReminder,
          Number.isNaN(timeValue) ? 0 : timeValue,
          timeUnit,
          triggerType,
        );
        if (!reminderTime) continue;
        await client.query(
          `INSERT INTO task_reminders
            (delegation_id, type, time_value, time_unit, trigger_type, reminder_time)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, type, Number.isNaN(timeValue) ? 0 : timeValue, timeUnit, triggerType, reminderTime],
        );
      }
    }

    await client.query("COMMIT");

    // Trigger Notifications
    if (statusChanged || dueDateChanged) {
        const eventType = updated.status === 'Completed' ? 'TASK_COMPLETED' : 'TASK_UPDATED';
        const updatedFields = {};
        if (statusChanged) updatedFields.status = updated.status;
        if (dueDateChanged) updatedFields.due_date = updated.due_date;

        await notifyUser(eventType, {
            ...updated,
            triggeredById: req.user.id || req.user.User_Id,
            changedBy: String(changedBy),
            updatedFields
        });
    }

    res.json({ success: true, data: updated });
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
    const task = reslt.rows[0];
    if (task) {
      await notifyUser('TASK_DELETED', {
        ...task,
        triggeredById: req.user.id || req.user.User_Id,
        changedBy: user
      });
    }
    res.json({ success: true, data: task });
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
      "SELECT * FROM delegation WHERE record_source = 'delegation' AND delegator_id = $1 AND doer_id != $1 AND deleted_at IS NULL ORDER BY created_at DESC",
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
        "SELECT * FROM delegation WHERE record_source = 'delegation' AND deleted_at IS NULL ORDER BY created_at DESC";
    } else {
      query =
        "SELECT * FROM delegation WHERE record_source = 'delegation' AND deleted_at IS NULL AND (doer_id = $1 OR (delegator_id = $1 AND doer_id != $1) OR $1 = ANY(in_loop_ids) OR $1 = ANY(subscribed_by)) ORDER BY created_at DESC";
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
