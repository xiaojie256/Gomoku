// update_db_v2.js
const poolImport = require('./db/postgres');
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchemaV2 = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 追加黑白双方的 user_id，允许初始为 NULL（即虚位以待）
        await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS black_user_id INT DEFAULT NULL;`);
        await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS white_user_id INT DEFAULT NULL;`);
        
        await client.query('COMMIT');
        console.log("✅ 数据库升级 v2 成功：已新增 black_user_id 和 white_user_id 阵营锁定字段。");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ 数据库升级失败:", err);
    } finally {
        client.release();
        process.exit();
    }
};

upgradeSchemaV2();
