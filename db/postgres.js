const { Pool } = require('pg');

const pool = new Pool({
    user: 'gomoku_user',
    host: 'localhost',
    database: 'gomoku_db',
    password: 'gomoku_password',
    port: 5432,
});

pool.on('connect', () => {
    console.log('PostgreSQL 连接池初始化成功');
});

module.exports = pool;
