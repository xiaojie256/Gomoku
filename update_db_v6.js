// Gomoku/update_db_v6.js
const poolImport = require("./db/postgres");
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchemaV6 = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 创建全局设置表
    await client.query(`
        CREATE TABLE IF NOT EXISTS global_settings (
            key VARCHAR(50) PRIMARY KEY,
            value VARCHAR(255) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 注入默认的单人最大开局数 (如果已存在则忽略)
    await client.query(`
        INSERT INTO global_settings (key, value) 
        VALUES ('max_active_games', '5') 
        ON CONFLICT (key) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("✅ 数据库升级 v6 成功：已新增 global_settings 表及默认配置。");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ 数据库升级失败:", err);
  } finally {
    client.release();
    process.exit();
  }
};

upgradeSchemaV6();
