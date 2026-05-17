const pool = require("../db/postgres");

exports.requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "未登录" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT is_admin FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }
    if (!result.rows[0].is_admin) {
      return res.status(403).json({ error: "需要管理员权限" });
    }
    next();
  } catch (err) {
    console.error("管理员权限验证失败:", err);
    res.status(500).json({ error: "服务器异常" });
  } finally {
    client.release();
  }
};
