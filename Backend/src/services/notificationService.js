const db = require('../config/db.config');
const { sendNotificationEmail } = require('../utils/emailService');

/**
 * Event Types:
 * - TASK_CREATED
 * - TASK_UPDATED
 * - TASK_COMPLETED
 * - TASK_DELETED
 * - TASK_REMINDER
 * - TASK_DUE_SOON
 */

const notifyUser = async (eventType, taskData) => {
    try {
        const {
            id,
            delegation_name,
            taskTitle,
            description,
            doer_id,
            doer_name,
            delegator_id,
            delegator_name,
            due_date,
            status,
            updatedFields,
            changedBy
        } = taskData;

        const title = taskTitle || taskData.task_title || delegation_name || 'Untitled Task';
        const recipients = [];

        // Determine recipients
        if (eventType === 'TASK_CREATED') {
            recipients.push({ id: doer_id, role: 'DOER' });
        } else if (eventType === 'TASK_UPDATED') {
            recipients.push({ id: doer_id, role: 'DOER' });
        } else if (eventType === 'TASK_COMPLETED') {
            recipients.push({ id: delegator_id, role: 'DELEGATOR' });
        } else if (eventType === 'TASK_DELETED') {
            recipients.push({ id: doer_id, role: 'DOER' });
            recipients.push({ id: delegator_id, role: 'DELEGATOR' });
        } else if (eventType === 'TASK_REMINDER' || eventType === 'TASK_DUE_SOON') {
            recipients.push({ id: doer_id, role: 'DOER' });
        }

        // Add loop members if applicable
        if (taskData.in_loop_ids && Array.isArray(taskData.in_loop_ids)) {
            taskData.in_loop_ids.forEach(loopId => {
                if (!recipients.find(r => r.id === loopId)) {
                    recipients.push({ id: loopId, role: 'LOOP' });
                }
            });
        }

        for (const recipient of recipients) {
            // Skip if recipient is the one who triggered the event (except for reminders)
            if (eventType !== 'TASK_REMINDER' && eventType !== 'TASK_DUE_SOON' && recipient.id === taskData.triggeredById) {
                // continue; // Commented out to ensure all relevant parties are notified during development/testing
            }

            const notificationContent = getNotificationContent(eventType, taskData, recipient.role);
            
            // 1. Create In-App Notification
            await createInAppNotification(recipient.id, notificationContent.title, notificationContent.message, eventType, id);

            // 2. Send Email Notification
            await sendEmailNotification(recipient.id, eventType, taskData, notificationContent);
        }

    } catch (err) {
        console.error('Error in notificationService.notifyUser:', err);
    }
};

const getNotificationContent = (eventType, taskData, role) => {
    const title = taskData.taskTitle || taskData.task_title || taskData.delegation_name || 'Untitled Task';
    const actor = taskData.changedBy || 'Someone';

    switch (eventType) {
        case 'TASK_CREATED':
            return {
                title: 'New Task Assigned',
                message: `You have been assigned a new task: "${title}" by ${taskData.delegator_name}.`
            };
        case 'TASK_UPDATED':
            return {
                title: 'Task Updated',
                message: `Task "${title}" has been updated by ${actor}.`
            };
        case 'TASK_COMPLETED':
            return {
                title: 'Task Completed',
                message: `Task "${title}" has been completed by ${taskData.doer_name}.`
            };
        case 'TASK_DELETED':
            return {
                title: 'Task Deleted',
                message: `Task "${title}" has been deleted by ${actor}.`
            };
        case 'TASK_REMINDER':
            return {
                title: 'Task Reminder',
                message: `Reminder: Task "${title}" is pending. Due date: ${new Date(taskData.due_date).toLocaleDateString()}.`
            };
        case 'TASK_DUE_SOON':
            return {
                title: 'Task Due Soon',
                message: `Alert: Task "${title}" is due within 24 hours!`
            };
        default:
            return {
                title: 'Task Update',
                message: `There is an update on task: "${title}".`
            };
    }
};

const createInAppNotification = async (recipientId, title, message, type, relatedId) => {
    try {
        const query = `
            INSERT INTO notifications (recipient_id, title, message, type, related_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        await db.query(query, [recipientId, title, message, type, relatedId]);
    } catch (err) {
        console.error('Error creating in-app notification:', err);
    }
};

const sendEmailNotification = async (recipientId, eventType, taskData, content) => {
    try {
        // Get user's email and preferences
        const userQuery = `
            SELECT work_email, first_name, last_name 
            FROM employees 
            WHERE user_id = $1`;
        const userResult = await db.query(userQuery, [recipientId]);

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            if (user.work_email) {
                // Generate rich HTML body
                const htmlBody = generateTaskEmailTemplate(eventType, taskData, user, content);
                await sendNotificationEmail(user.work_email, content.title, htmlBody, eventType);
            }
        }
    } catch (err) {
        console.error('Error sending email notification:', err);
    }
};

const generateTaskEmailTemplate = (eventType, taskData, recipient, content) => {
    const {
        description,
        doer_name,
        delegator_name,
        due_date,
        status,
        updatedFields
    } = taskData;

    // Support both snake_case (from DB/RETURNING) and camelCase (from aliased queries)
    const voiceNoteUrl = taskData.voiceNoteUrl || taskData.voice_note_url;
    const referenceDocs = taskData.referenceDocs || taskData.reference_docs;
    const evidenceUrl = taskData.evidenceUrl || taskData.evidence_url;

    const title = taskData.taskTitle || taskData.task_title || taskData.delegation_name || 'Untitled Task';
    const formattedDueDate = due_date ? new Date(due_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Not Set';
    
    let changesHtml = '';
    if (updatedFields && Object.keys(updatedFields).length > 0) {
        changesHtml = '<div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">';
        changesHtml += '<h3 style="font-size: 14px; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">Update Details:</h3><ul style="padding-left: 20px;">';
        for (const [field, value] of Object.entries(updatedFields)) {
            changesHtml += `<li style="margin-bottom: 5px;"><strong>${field}:</strong> ${value}</li>`;
        }
        changesHtml += '</ul></div>';
    }

    // Attachments Logic
    let attachmentsHtml = '';
    const hasVoice = !!voiceNoteUrl;
    const hasDocs = Array.isArray(referenceDocs) ? referenceDocs.length > 0 : !!referenceDocs;
    const hasEvidence = Array.isArray(evidenceUrl) ? evidenceUrl.length > 0 : !!evidenceUrl;

    if (hasVoice || hasDocs || hasEvidence) {
        attachmentsHtml = '<div style="margin-top: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px;">';
        attachmentsHtml += '<h3 style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">📎 Attachments</h3>';
        
        if (hasVoice) {
            attachmentsHtml += `
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 12px; font-weight: 600; color: #475569;">🎤 Voice Note: </span>
                    <a href="${voiceNoteUrl}" style="margin-left: 8px; font-size: 12px; color: #4f46e5; text-decoration: none; font-weight: bold;">Listen to Recording</a>
                </div>`;
        }

        if (hasDocs) {
            const docs = Array.isArray(referenceDocs) ? referenceDocs : [referenceDocs];
            attachmentsHtml += '<div style="margin-bottom: 10px;"><span style="font-size: 12px; font-weight: 600; color: #475569;">📄 Reference Files:</span>';
            docs.forEach((doc, idx) => {
                const docUrl = typeof doc === 'string' ? doc : doc.url || doc;
                const docName = typeof doc === 'object' ? doc.name : `File ${idx + 1}`;
                attachmentsHtml += `<div style="margin-top: 4px; padding-left: 10px;"><a href="${docUrl}" style="font-size: 12px; color: #4f46e5; text-decoration: none;">• ${docName}</a></div>`;
            });
            attachmentsHtml += '</div>';
        }

        if (hasEvidence) {
            const evidence = Array.isArray(evidenceUrl) ? evidenceUrl : [evidenceUrl];
            attachmentsHtml += '<div style="margin-bottom: 5px;"><span style="font-size: 12px; font-weight: 600; color: #475569;">📸 Task Evidence / Images:</span>';
            evidence.forEach((ev, idx) => {
                const evUrl = typeof ev === 'string' ? ev : ev.url || ev;
                const isImage = evUrl.match(/\.(jpeg|jpg|gif|png)$/i);
                if (isImage) {
                    attachmentsHtml += `
                        <div style="margin-top: 8px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                            <a href="${evUrl}"><img src="${evUrl}" style="max-width: 100%; display: block;" alt="Evidence ${idx + 1}" /></a>
                        </div>`;
                } else {
                    attachmentsHtml += `<div style="margin-top: 4px; padding-left: 10px;"><a href="${evUrl}" style="font-size: 12px; color: #4f46e5; text-decoration: none;">• Evidence File ${idx + 1}</a></div>`;
                }
            });
            attachmentsHtml += '</div>';
        }
        
        attachmentsHtml += '</div>';
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
                .wrapper { background-color: #f1f5f9; padding: 40px 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
                .header { background: #4f46e5; color: #ffffff; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
                .content { padding: 30px; }
                .footer { text-align: center; font-size: 11px; color: #64748b; padding: 20px; border-top: 1px solid #f1f5f9; }
                .button { 
                    display: inline-block; 
                    padding: 14px 28px; 
                    background-color: #4f46e5; 
                    color: #ffffff !important; 
                    font-weight: 800; 
                    text-decoration: none; 
                    border-radius: 12px; 
                    margin-top: 25px;
                    text-transform: uppercase;
                    font-size: 11px;
                    letter-spacing: 1px;
                    box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
                }
                .details { background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #f1f5f9; }
                .detail-item { margin-bottom: 12px; display: flex; align-items: baseline; }
                .label { font-weight: 800; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; min-width: 100px; }
                .value { color: #1e293b; font-weight: 600; font-size: 13px; }
                .description-box { margin-top: 20px; border-left: 4px solid #e2e8f0; padding-left: 15px; color: #475569; font-style: italic; }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <h1>ERP TASK SYSTEM</h1>
                    </div>
                    <div class="content">
                        <h2 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-top: 0;">Hello ${recipient.first_name || 'User'},</h2>
                        <p style="color: #475569; font-size: 14px; margin-bottom: 25px;">${content.message}</p>
                        
                        <div class="details">
                            <div class="detail-item"><span class="label">Task:</span> <span class="value">${title}</span></div>
                            <div class="detail-item"><span class="label">Status:</span> <span class="value" style="color: #4f46e5;">${status || 'N/A'}</span></div>
                            <div class="detail-item"><span class="label">Assigned To:</span> <span class="value">${doer_name}</span></div>
                            <div class="detail-item"><span class="label">Created By:</span> <span class="value">${delegator_name}</span></div>
                            <div class="detail-item"><span class="label">Due Date:</span> <span class="value">${formattedDueDate}</span></div>
                        </div>

                        ${description ? `<div class="description-box"><span class="label" style="display:block; margin-bottom: 5px;">Description</span> <p style="margin: 0; font-size: 13px;">${description}</p></div>` : ''}
                        
                        ${attachmentsHtml}
                        
                        ${changesHtml}

                        <p style="font-size: 11px; color: #94a3b8; margin-top: 30px;">Sent at: ${new Date().toLocaleString()}</p>
                        
                        <div style="text-align: center;">
                            <a href="https://erp.dtableanalytics.com" class="button">View Task Details</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from DTA ERP.<br/>Please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} DTA ERP Task Management System</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

module.exports = {
    notifyUser
};
