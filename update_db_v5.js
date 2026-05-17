// update_db_v5.js
const poolImport = require('./db/postgres');
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchemaV5 = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;`);

    await client.query('COMMIT');
    console.log("✅ 数据库升级 v5 成功：已新增 is_admin 字段到 users 表。");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ 数据库升级失败:", err);
  } finally {
    client.release();
    process.exit();
  }
};

upgradeSchemaV5();
