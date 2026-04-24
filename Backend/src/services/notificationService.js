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

        const title = taskTitle || delegation_name;
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
    const title = taskData.taskTitle || taskData.delegation_name;
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
        delegation_name,
        taskTitle,
        description,
        doer_name,
        delegator_name,
        due_date,
        status,
        updatedFields
    } = taskData;

    const title = taskTitle || delegation_name;
    const formattedDueDate = due_date ? new Date(due_date).toLocaleString() : 'Not Set';
    
    let changesHtml = '';
    if (updatedFields && Object.keys(updatedFields).length > 0) {
        changesHtml = '<h3>Changes:</h3><ul>';
        for (const [field, value] of Object.entries(updatedFields)) {
            changesHtml += `<li><strong>${field}:</strong> ${value}</li>`;
        }
        changesHtml += '</ul>';
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
                .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 20px; }
                .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
                .button { display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .detail-item { margin-bottom: 8px; }
                .label { font-weight: bold; color: #4b5563; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Task Management System</h1>
                </div>
                <div class="content">
                    <h2>Hello ${recipient.first_name || 'User'},</h2>
                    <p>${content.message}</p>
                    
                    <div class="details">
                        <div class="detail-item"><span class="label">Task:</span> ${title}</div>
                        <div class="detail-item"><span class="label">Status:</span> ${status || 'N/A'}</div>
                        <div class="detail-item"><span class="label">Assigned To:</span> ${doer_name}</div>
                        <div class="detail-item"><span class="label">Created By:</span> ${delegator_name}</div>
                        <div class="detail-item"><span class="label">Due Date:</span> ${formattedDueDate}</div>
                    </div>

                    ${description ? `<div class="detail-item"><span class="label">Description:</span> <p>${description}</p></div>` : ''}
                    
                    ${changesHtml}

                    <p>Timestamp: ${new Date().toLocaleString()}</p>
                    
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/delegations" class="button">View Task Details</a>
                </div>
                <div class="footer">
                    <p>This is an automated notification. Please do not reply.</p>
                    <p>&copy; ${new Date().getFullYear()} DTA ERP Task Management System</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

module.exports = {
    notifyUser
};
