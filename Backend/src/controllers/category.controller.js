const db = require('../config/db.config');

exports.createCategory = async (req, res) => {
    const { name, color } = req.body;
    const userId = req.user?.id || req.user?.User_Id;
    try {
        const query = 'INSERT INTO categories (name, color, created_by) VALUES ($1, $2, $3) RETURNING *';
        const result = await db.query(query, [name, color, userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error creating category' });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categories ORDER BY name ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching categories' });
    }
};

exports.deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM categories WHERE id = $1', [id]);
        res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting category' });
    }
};
