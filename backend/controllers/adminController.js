const prisma = require("../db/prisma");
const redisClient = require("../db/redis");

const upsertSettingCached = async (key, value) => {
  await prisma.globalSettings.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
  await redisClient.set(`global_settings:${key}`, String(value));
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, username: true, is_admin: true, created_at: true },
    });
    res.json({ success: true, users });
  } catch (err) {
    console.error("获取用户列表失败:", err);
    res.status(500).json({ error: "获取用户列表失败" });
  }
};

exports.setUserAdmin = async (req, res) => {
  const userId = parseInt(req.params.userId || req.body.userId);
  const isAdmin =
    typeof req.body.isAdmin !== "undefined"
      ? req.body.isAdmin
      : req.query.isAdmin === "true";
  try {
    await prisma.user.update({ where: { id: userId }, data: { is_admin: isAdmin } });
    res.json({ success: true });
  } catch (err) {
    console.error("设置管理员权限失败:", err);
    res.status(500).json({ error: "设置管理员权限失败" });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    await prisma.$transaction([
      prisma.move.deleteMany({ where: { user_id: userId } }),
      prisma.board.updateMany({ where: { black_user_id: userId }, data: { black_user_id: null } }),
      prisma.board.updateMany({ where: { white_user_id: userId }, data: { white_user_id: null } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("删除用户失败:", err);
    res.status(500).json({ error: "删除用户失败" });
  }
};

exports.getAllGames = async (req, res) => {
  try {
    const games = await prisma.board.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      select: {
        id: true, status: true, is_public: true, created_at: true,
        winner_id: true, black_user_id: true, white_user_id: true,
        black_user: { select: { username: true } },
        white_user: { select: { username: true } },
      },
    });
    const formatted = games.map((g) => ({
      ...g,
      black_username: g.black_user?.username ?? null,
      white_username: g.white_user?.username ?? null,
      black_user: undefined,
      white_user: undefined,
    }));
    res.json({ success: true, games: formatted });
  } catch (err) {
    console.error("获取对局列表失败:", err);
    res.status(500).json({ error: "获取对局列表失败" });
  }
};

exports.deleteGame = async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  try {
    await prisma.$transaction([
      prisma.move.deleteMany({ where: { board_id: gameId } }),
      prisma.board.delete({ where: { id: gameId } }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("删除对局失败:", err);
    res.status(500).json({ error: "删除对局失败" });
  }
};

exports.getUserById = async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, is_admin: true, created_at: true },
    });
    if (!user) return res.status(404).json({ error: "用户不存在" });
    res.json({ success: true, user });
  } catch (err) {
    console.error("获取用户信息失败:", err);
    res.status(500).json({ error: "获取用户信息失败" });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalGames, activeGames, finishedGames] = await Promise.all([
      prisma.user.count(),
      prisma.board.count(),
      prisma.board.count({ where: { status: "playing" } }),
      prisma.board.count({ where: { status: "finished" } }),
    ]);
    res.json({ success: true, stats: { totalUsers, totalGames, activeGames, finishedGames } });
  } catch (err) {
    console.error("获取统计信息失败:", err);
    res.status(500).json({ error: "获取统计信息失败" });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const rows = await prisma.globalSettings.findMany();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ success: true, settings });
  } catch (err) {
    console.error("获取设置失败:", err);
    res.status(500).json({ error: "获取设置失败" });
  }
};

exports.updateSetting = async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: "缺少参数" });
  try {
    await upsertSettingCached(key, value);
    res.json({ success: true });
  } catch (err) {
    console.error("更新设置失败:", err);
    res.status(500).json({ error: "更新设置失败" });
  }
};

exports.getConfig = async (req, res) => {
  try {
    const [maxUsersRow, maxGamesRow, boardLifetimeRow] = await Promise.all([
      prisma.globalSettings.findUnique({ where: { key: "max_users" } }),
      prisma.globalSettings.findUnique({ where: { key: "max_active_games" } }),
      prisma.globalSettings.findUnique({ where: { key: "board_lifetime_hours" } }),
    ]);
    const max_users = maxUsersRow ? parseInt(maxUsersRow.value) : 100;
    const max_active_games = maxGamesRow ? parseInt(maxGamesRow.value) : 5;
    const board_lifetime_hours = boardLifetimeRow ? parseInt(boardLifetimeRow.value) : 2;
    res.json({ success: true, max_users, max_active_games, board_lifetime_hours });
  } catch (err) {
    console.error("获取配置失败:", err);
    res.status(500).json({ error: "获取配置失败" });
  }
};

exports.updateConfig = async (req, res) => {
  const { max_users, max_active_games, board_lifetime_hours } = req.body;
  try {
    if (max_users !== undefined) {
      const v = parseInt(max_users);
      if (isNaN(v) || v < 1) return res.status(400).json({ error: "max_users 必须是大于 0 的数字" });
      await upsertSettingCached("max_users", v);
    }
    if (max_active_games !== undefined) {
      const v = parseInt(max_active_games);
      if (isNaN(v) || v < 1) return res.status(400).json({ error: "max_active_games 必须是大于 0 的数字" });
      await upsertSettingCached("max_active_games", v);
    }
    if (board_lifetime_hours !== undefined) {
      const v = parseInt(board_lifetime_hours);
      if (isNaN(v) || v < 1) return res.status(400).json({ error: "board_lifetime_hours 必须是大于 0 的数字" });
      await upsertSettingCached("board_lifetime_hours", v);
    }
    res.json({
      success: true,
      max_users: max_users !== undefined ? parseInt(max_users) : undefined,
      max_active_games: max_active_games !== undefined ? parseInt(max_active_games) : undefined,
      board_lifetime_hours: board_lifetime_hours !== undefined ? parseInt(board_lifetime_hours) : undefined,
    });
  } catch (err) {
    console.error("更新配置失败:", err);
    res.status(500).json({ error: "更新配置失败" });
  }
};

exports.getBoardsAdmin = async (req, res) => {
  try {
    const boards = await prisma.board.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, status: true, is_public: true, expires_at: true, created_at: true },
    });
    const data = boards.map((b) => ({
      ...b,
      is_expired: b.expires_at ? b.expires_at < new Date() : false,
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: "获取列表失败" });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "缺少参数" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "新密码至少 6 位" });
  }
  try {
    const bcrypt = require("bcryptjs");
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "用户不存在" });
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: "当前密码错误" });
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password_hash: hash } });
    res.json({ success: true });
  } catch (err) {
    console.error("修改密码失败:", err);
    res.status(500).json({ error: "修改密码失败" });
  }
};

exports.deleteBoard = async (req, res) => {
  const boardId = parseInt(req.params.boardId);
  try {
    await prisma.$transaction([
      prisma.move.deleteMany({ where: { board_id: boardId } }),
      prisma.board.delete({ where: { id: boardId } }),
    ]);
    const io = req.app.get("io");
    io.to(boardId).emit("board_terminated", { message: "该棋局已被管理员强制解散" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "删除失败" });
  }
};
