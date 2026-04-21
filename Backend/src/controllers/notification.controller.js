const db = require('../config/db.config');

exports.getNotifications = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        const result = await db.query(
            'SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

exports.markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating notification' });
    }
};

exports.markAllAsRead = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        await db.query('UPDATE notifications SET is_read = true WHERE recipient_id = $1', [userId]);
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating notifications' });
    }
};

exports.deleteNotification = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM notifications WHERE id = $1', [id]);
        res.json({ message: 'Notification deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting notification' });
    }
};

exports.clearAll = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        await db.query('DELETE FROM notifications WHERE recipient_id = $1', [userId]);
        res.json({ message: 'All notifications cleared' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error clearing notifications' });
    }
};
