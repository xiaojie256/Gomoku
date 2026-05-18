const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'gomoku_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gomoku_db',
    password: process.env.DB_PASSWORD || 'gomoku_password',
    port: parseInt(process.env.DB_PORT || '5432'),
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('PostgreSQL 连接池异常:', err);
});

pool.on('connect', () => {
    console.log('✅ PostgreSQL 连接池初始化成功');
});

module.exports = pool;
