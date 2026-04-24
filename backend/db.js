const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'secure_file_storage'}`,
    // Production pool settings
    max: parseInt(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // For Neon, which uses SSL
});

// Log pool errors instead of crashing
pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    end: () => pool.end(),
};
