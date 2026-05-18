const prisma = require("../db/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/jwt");
const { getSettingCached } = require("../db/settings");

const signToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

exports.register = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "用户名和密码不能为空" });
  }
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "用户名或密码格式错误" });
  }

  try {
    const maxUsersLimit = await getSettingCached("max_users", 100);
    const userCount = await prisma.user.count();
    if (userCount >= maxUsersLimit) {
      return res.status(403).json({ error: `系统注册人数已达 ${maxUsersLimit} 人上限，已闭站停止新进访问` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password_hash: passwordHash },
      select: { id: true, username: true },
    });

    const token = signToken(user);
    res.json({ success: true, token, user: { id: user.id, username: user.username } });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "该用户名已被占用" });
    }
    console.error("注册失败:", err);
    res.status(500).json({ error: "注册失败" });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "用户名和密码不能为空" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const token = signToken(user);
    res.json({ success: true, token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error("登录失败:", err);
    res.status(500).json({ error: "登录失败" });
  }
};

exports.me = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "未登录" });
  }
  res.json({ success: true, user: req.user });
};
