// Gomoku/update_db_v7.js
const poolImport = require("./db/postgres");
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchemaV7 = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 注入默认的最大账号数量 (如果已存在则忽略)
    await client.query(`
        INSERT INTO global_settings (key, value) 
        VALUES ('max_users', '100') 
        ON CONFLICT (key) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("✅ 数据库升级 v7 成功：已注入 max_users 默认配置上限 (100)。");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ 数据库升级失败:", err);
  } finally {
    client.release();
    process.exit();
  }
};

upgradeSchemaV7();
