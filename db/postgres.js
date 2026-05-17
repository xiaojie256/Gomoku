const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'gomoku_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gomoku_db',
    password: process.env.DB_PASSWORD || 'gomoku_password',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5435, // 对应上面 docker-compose 的映射
});

pool.on('connect', () => {
    console.log('✅ PostgreSQL 连接池初始化成功');
});

module.exports = pool;
