const poolImport = require("./db/postgres");
const pool = poolImport.connect ? poolImport : poolImport.pool;

const upgradeSchemaV4 = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`);

    await client.query("COMMIT");
    console.log("✅ 数据库升级 v4 成功：已新增 users 表。");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ 数据库升级失败:", err);
  } finally {
    client.release();
    process.exit();
  }
};

upgradeSchemaV4();
