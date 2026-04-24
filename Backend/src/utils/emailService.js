const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Send email function
const sendEmail = async (to, subject, html, text = '') => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

// Send notification email
const sendNotificationEmail = async (recipientEmail, title, html, type = 'info') => {
    let subject = `Task Management: ${title}`;
    
    if (type === 'TASK_CREATED') subject = `New Task Assigned: ${title}`;
    else if (type === 'TASK_UPDATED') subject = `Task Updated: ${title}`;
    else if (type === 'TASK_COMPLETED') subject = `Task Completed: ${title}`;
    else if (type === 'TASK_DELETED') subject = `Task Deleted: ${title}`;
    else if (type === 'TASK_REMINDER') subject = `Task Reminder: ${title}`;
    else if (type === 'TASK_DUE_SOON') subject = `Task Due Soon: ${title}`;

    return await sendEmail(recipientEmail, subject, html);
};

module.exports = {
    sendEmail,
    sendNotificationEmail
};