const prisma = require("../db/prisma");

exports.requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "未登录" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { is_admin: true },
    });
    if (!user) return res.status(404).json({ error: "用户不存在" });
    if (!user.is_admin) return res.status(403).json({ error: "需要管理员权限" });
    next();
  } catch (err) {
    console.error("管理员权限验证失败:", err);
    res.status(500).json({ error: "服务器异常" });
  }
};
