// Gomoku/create_admin.js
// 创建管理员账号脚本
// 用法：ADMIN_USER=yourname ADMIN_PASS=yourpassword node create_admin.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const prisma = require("../db/prisma");
const bcrypt = require('bcryptjs');

const createAdmin = async () => {
  const username = process.env.ADMIN_USER || process.argv[2];
  const password = process.env.ADMIN_PASS || process.argv[3];

  if (!username || !password) {
    console.error("❌ 请提供管理员用户名和密码");
    console.error("   用法: ADMIN_USER=xxx ADMIN_PASS=yyy node create_admin.js");
    console.error("   或:   node create_admin.js <username> <password>");
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { username },
      update: { is_admin: true },
      create: { username, password_hash: passwordHash, is_admin: true },
      select: { id: true, username: true, is_admin: true },
    });
    console.log("✅ 管理员账号创建/更新成功:");
    console.log(`   用户名: ${user.username}`);
    console.log(`   管理员权限: ${user.is_admin ? "是" : "否"}`);
  } catch (err) {
    console.error("❌ 创建管理员失败:", err.message);
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
};

createAdmin();
