const db = require('../config/db.config');

// --- Kanban ToDo CRUD ---

exports.createTodo = async (req, res) => {
    const { title, description, priority, status, due_date, assigned_to } = req.body;
    const created_by = req.user.id || req.user.User_Id;

    try {
        const query = `
            INSERT INTO todos (title, description, priority, status, due_date, created_by, assigned_to)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
        const result = await db.query(query, [
            title,
            description,
            priority || 'Normal',
            status || 'To Do',
            due_date,
            created_by,
            assigned_to || created_by
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating todo:', err);
        res.status(500).json({ message: 'Error creating todo' });
    }
};


exports.getTodosByUserId = async (req, res) => {
  const userId = req.params.id; 

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const query = `
      SELECT t.*, 
             e1.First_Name AS creator_first_name, 
             e1.Last_Name AS creator_last_name,
             e2.First_Name AS assignee_first_name, 
             e2.Last_Name AS assignee_last_name
      FROM todos t
      LEFT JOIN employees e1 ON t.created_by = e1.User_Id
      LEFT JOIN employees e2 ON t.assigned_to = e2.User_Id
      WHERE t.created_by = $1
         OR t.assigned_to = $1
      ORDER BY t.created_at DESC
    `;

    const result = await db.query(query, [userId]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching todos:", err);
    res.status(500).json({ message: "Error fetching todos" });
  }
};



exports.updateTodoStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const query = 'UPDATE todos SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE todo_id = $2 RETURNING *';
        const result = await db.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Todo not found' });
        }

        // Return updated todo with assignee info for frontend consistency
        const detailedQuery = `
            SELECT t.*, 
                   e1.First_Name as creator_first_name, e1.Last_Name as creator_last_name,
                   e2.First_Name as assignee_first_name, e2.Last_Name as assignee_last_name
            FROM todos t
            LEFT JOIN employees e1 ON t.created_by = e1.User_Id
            LEFT JOIN employees e2 ON t.assigned_to = e2.User_Id
            WHERE t.todo_id = $1
        `;
        const detailedResult = await db.query(detailedQuery, [id]);
        res.status(200).json(detailedResult.rows[0]);
    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ message: 'Error updating status' });
    }
};

exports.deleteTodo = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM todos WHERE todo_id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Todo not found' });
        res.status(200).json({ message: 'Todo deleted successfully' });
    } catch (err) {
        console.error('Error deleting todo:', err);
        res.status(500).json({ message: 'Error deleting todo' });
    }
};
