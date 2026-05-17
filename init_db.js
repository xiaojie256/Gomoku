const poolImport = require("./db/postgres");
// 兼容直接导出或对象导出的情况
const pool = poolImport.connect ? poolImport : poolImport.pool;

const initSchema = async () => {
  if (!pool || typeof pool.connect !== "function") {
    console.error(
      "数据库实例加载失败，请检查 db/postgres.js 的 module.exports",
    );
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query(`
            CREATE TABLE IF NOT EXISTS boards (
                id SERIAL PRIMARY KEY,
                status VARCHAR(20) DEFAULT 'playing',
                winner_id INT DEFAULT NULL
            );

            CREATE TABLE IF NOT EXISTS moves (
                id SERIAL PRIMARY KEY,
                board_id INT,
                user_id INT,
                x INT,
                y INT,
                player INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    console.log("PostgreSQL 本地数据表初始化成功！");
  } catch (err) {
    console.error("数据表创建失败:", err);
  } finally {
    client.release();
    process.exit();
  }
};

initSchema();
