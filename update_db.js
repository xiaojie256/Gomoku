// update_db.js
const poolImport = require('./db/postgres');
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchema = async () => {
    if (!pool || typeof pool.connect !== 'function') {
        console.error("数据库实例加载失败，请检查 db/postgres.js");
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 使用 IF NOT EXISTS 保证脚本的幂等性（重复执行依然安全）
        await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;`);
        // 限制暗码长度为 6 位
        await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS secret_code VARCHAR(6) DEFAULT NULL;`);
        
        await client.query('COMMIT');
        console.log("✅ 数据库平滑升级成功：已新增 is_public 和 secret_code 字段。");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ 数据库升级失败:", err);
    } finally {
        client.release();
        process.exit();
    }
};

upgradeSchema();
