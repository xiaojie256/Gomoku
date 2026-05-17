// Gomoku/create_admin.js
// 创建管理员账号脚本
const pool = require("./db/postgres");
const bcrypt = require('bcryptjs');

const createAdmin = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const username = "xiaojie256";
    const password = "xiaojie256";

    // 检查用户是否已存在
    const exist = await client.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    if (exist.rows.length > 0) {
      console.log(`用户 "${username}" 已存在，跳过创建`);
      await client.query("ROLLBACK");
      return;
    }

    // 密码哈希
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户并设置为管理员
    const result = await client.query(
      "INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, true) RETURNING id, username, is_admin",
      [username, passwordHash],
    );

    await client.query("COMMIT");
    console.log("✅ 管理员账号创建成功:");
    console.log(`   用户名: ${result.rows[0].username}`);
    console.log(`   密码: ${password}`);
    console.log(`   管理员权限: ${result.rows[0].is_admin ? "是" : "否"}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ 创建管理员失败:", err);
  } finally {
    client.release();
    process.exit();
  }
};

createAdmin();
