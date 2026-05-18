// Gomoku/update_db_v8.js
const poolImport = require("./db/postgres");
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchemaV8 = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 添加 expires_at 列到 boards 表（用于棋盘 TTL 管理）
    await client.query(`
        ALTER TABLE boards 
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
    `);

    // 为现有的棋盘设置默认过期时间（2小时后）
    await client.query(`
        UPDATE boards 
        SET expires_at = NOW() + INTERVAL '2 hours'
        WHERE expires_at IS NULL;
    `);

    await client.query("COMMIT");
    console.log("✅ 数据库升级 v8 成功：已添加 expires_at 列并设置默认过期时间。");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ 数据库升级失败:", err);
  } finally {
    client.release();
    process.exit();
  }
};

upgradeSchemaV8();
