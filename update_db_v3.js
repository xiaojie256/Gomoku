// update_db_v3.js
const poolImport = require('./db/postgres');
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchemaV3 = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 为 boards 表补充创建时间，用于 10 天生命周期判定
        await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
        
        await client.query('COMMIT');
        console.log("✅ 数据库升级 v3 成功：已新增 created_at 字段。");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ 数据库升级失败:", err);
    } finally {
        client.release();
        process.exit();
    }
};

upgradeSchemaV3();
