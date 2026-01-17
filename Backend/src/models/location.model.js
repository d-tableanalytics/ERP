const { pool } = require('../config/db.config');

const createLocationTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try {
        await pool.query(queryText);
        console.log('Locations table ensured in database');

        // Seed initial locations if none exist
        const checkQuery = 'SELECT COUNT(*) FROM locations';
        const { rows } = await pool.query(checkQuery);

        if (parseInt(rows[0].count) === 0) {
            const seedQuery = `
                INSERT INTO locations (name) VALUES 
                ('Office'), ('Site A'), ('Site B'), ('Warehouse')
                ON CONFLICT (name) DO NOTHING;
            `;
            await pool.query(seedQuery);
            console.log('Seed locations added');
        }
    } catch (err) {
        console.error('Error creating locations table:', err);
        throw err;
    }
};

module.exports = {
    createLocationTable,
};
