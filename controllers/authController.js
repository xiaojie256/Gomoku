const pool = require("../db/postgres");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "gomoku_dev_secret";
const JWT_EXPIRES_IN = "7d";

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

  const client = await pool.connect();
  try {
    const exist = await client.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    if (exist.rows.length > 0) {
      return res.status(409).json({ error: "该用户名已被占用" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await client.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash],
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error("注册失败:", err);
    res.status(500).json({ error: "注册失败" });
  } finally {
    client.release();
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "用户名和密码不能为空" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error("登录失败:", err);
    res.status(500).json({ error: "登录失败" });
  } finally {
    client.release();
  }
};

exports.me = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "未登录" });
  }
  res.json({ success: true, user: req.user });
};
