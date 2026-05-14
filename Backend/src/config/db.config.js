const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}/${process.env.PGDATABASE}?sslmode=require`,
    ssl: {
        rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 30000,
    max: 20,
    idleTimeoutMillis: 60000,
});

pool.on('connect', () => {
    console.log('Connected to the Neon Database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Safe retry wrapper for ENOTFOUND (DNS issues)
const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
    // If a callback is provided, fallback to original to maintain compatibility
    if (typeof args[args.length - 1] === 'function') {
        return originalQuery(...args);
    }

    let retries = 3;
    while (retries > 0) {
        try {
            return await originalQuery(...args);
        } catch (err) {
            const retryableErrors = ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'];
            if (retryableErrors.includes(err.code) && retries > 1) {
                console.error(`[Database] Connection issue (${err.code}). Retrying in 2s... (${retries - 1} attempts left)`);
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw err;
            }
        }
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
