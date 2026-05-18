// controllers/gameController.js
const prisma = require("../db/prisma");
const redisClient = require("../db/redis");
const createGomokuLogic = require("../wasm/logic.js");
const { getSettingCached } = require("../db/settings");

let wasmModule = null;

createGomokuLogic()
  .then((mod) => {
    wasmModule = mod;
    console.log("Express 成功加载 WASM 核心计算模块");
  })
  .catch((err) => {
    console.error("Express 加载 WASM 模块失败:", err);
  });

const generateSecretCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

// 验证落子参数
const validateMoveInput = (boardId, x, y, player) => {
  if (!Number.isInteger(boardId) || boardId <= 0) {
    return { valid: false, message: "棋盘ID必须是正整数", status: 400 };
  }
  if (!Number.isInteger(x) || x < 0 || x > 14) {
    return { valid: false, message: "x 坐标必须在 0-14 范围内", status: 400 };
  }
  if (!Number.isInteger(y) || y < 0 || y > 14) {
    return { valid: false, message: "y 坐标必须在 0-14 范围内", status: 400 };
  }
  if (!Number.isInteger(player) || player < 1 || player > 2) {
    return { valid: false, message: "player 必须是 1(黑子) 或 2(白子)", status: 400 };
  }
  return { valid: true };
};

exports.submitMove = async (req, res) => {
  const { boardId, x, y, player } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: "未登录" });

  // 验证输入参数
  const validation = validateMoveInput(boardId, x, y, player);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.message });
  }

  const lockKey = `board_lock:${boardId}`;

  const acquired = await redisClient.set(lockKey, "LOCKED", { NX: true, EX: 2 });
  if (!acquired) return res.status(429).json({ error: "落子冲突或操作过快，请重试" });

  let pointer = null;  // 修复：使用 null 而非 0

  try {
    const result = await prisma.$transaction(async (tx) => {
      const board = await tx.board.findUnique({
        where: { id: boardId },
        select: { status: true, black_user_id: true, white_user_id: true, created_at: true, expires_at: true },
      });
      if (!board) throw new Error("棋盘不存在");

      if (board.expires_at && board.expires_at < new Date()) {
        throw new Error("该棋局已过期自动关闭");
      }

      const daysDiff = (new Date() - new Date(board.created_at)) / (1000 * 3600 * 24);
      if (daysDiff > 10 && board.status === "playing") {
        await tx.board.update({ where: { id: boardId }, data: { status: "draw" } });
        throw new Error("该棋局已超过 10 天生命周期，系统已自动判定为和局");
      }

      if (board.status !== "playing") throw new Error("当前棋局已结束，无法落子");

      const currentMoves = await tx.move.findMany({
        where: { board_id: boardId },
        orderBy: { id: "asc" },
        select: { x: true, y: true, player: true },
      });

      const expectedPlayer = currentMoves.length % 2 === 0 ? 1 : 2;
      if (player !== expectedPlayer)
        throw new Error(`当前该${expectedPlayer === 1 ? "黑子" : "白子"}落子`);

      if (player === 1 && board.black_user_id !== userId) {
        throw new Error("只有建局者可以执黑落子");
      }
      if (player === 2) {
        if (!board.white_user_id) {
          if (board.black_user_id === userId) {
            throw new Error("房主不能同时执白子，无法自己挑战自己");
          }
          await tx.board.update({ where: { id: boardId }, data: { white_user_id: userId } });
        } else if (board.white_user_id !== userId) {
          throw new Error("当前棋局的白子已被其他玩家抢先绑定");
        }
      }

      const currentBoard = Array(225).fill(0);
      currentMoves.forEach((move) => {
        currentBoard[move.y * 15 + move.x] = move.player;
      });

      const positionIndex = y * 15 + x;
      if (currentBoard[positionIndex] !== 0) throw new Error("该位置已被占用");

      pointer = wasmModule._malloc(900);
      for (let i = 0; i < 225; i++) {
        wasmModule.setValue(pointer + i * 4, currentBoard[i], "i32");
      }
      wasmModule.setValue(pointer + positionIndex * 4, player, "i32");

      const gameState = wasmModule._check_game_state(pointer, x, y, player);

      await tx.move.create({ data: { board_id: boardId, user_id: userId, x, y, player } });

      if (gameState !== 0) {
        await tx.board.update({
          where: { id: boardId },
          data: {
            status: gameState === 1 ? "finished" : "draw",
            winner_id: gameState === 1 ? userId : null,
          },
        });
      }

      return gameState;
    });

    const io = req.app.get("io");
    io.to(boardId).emit("board_updated", {
      x, y, player,
      gameState: result,
      status: result !== 0 ? (result === 1 ? "finished" : "draw") : "playing",
    });

    res.json({ success: true, gameState: result, x, y, player });
  } catch (err) {
    // 根据错误类型返回适当的 HTTP 状态码
    let statusCode = 500;
    const message = err.message || "服务器异常";

    if (message === "棋盘不存在") {
      statusCode = 404;
    } else if (message === "该棋局已过期自动关闭") {
      statusCode = 410;  // Gone
    } else if (message === "该位置已被占用") {
      statusCode = 409;  // Conflict
    } else if (message.includes("当前棋局已结束") ||
               message.includes("当前该") ||
               message.includes("只有建局者") ||
               message.includes("房主不能") ||
               message.includes("已被其他玩家") ||
               message.includes("超过 10 天生命周期")) {
      statusCode = 403;  // Forbidden
    }

    res.status(statusCode).json({ error: message });
  } finally {
    if (pointer !== null) wasmModule._free(pointer);  // 修复：检查 null 而非 truthy
    await redisClient.del(lockKey);
  }
};

exports.createGame = async (req, res) => {
  const { isPublic } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未登录" });

  try {
    const maxGamesLimit = await getSettingCached("max_active_games", 5);
    const activeCount = await prisma.board.count({
      where: { black_user_id: userId, status: "playing" },
    });
    if (activeCount >= maxGamesLimit) {
      return res.status(403).json({ error: `您同时开启的对局数已达 ${maxGamesLimit} 局上限` });
    }

    const secretCode = isPublic ? null : generateSecretCode();
    const boardLifetimeHours = await getSettingCached("board_lifetime_hours", 2);
    const expiresAt = new Date(Date.now() + boardLifetimeHours * 60 * 60 * 1000);
    const board = await prisma.board.create({
      data: { black_user_id: userId, is_public: isPublic, secret_code: secretCode, status: "playing", expires_at: expiresAt },
      select: { id: true },
    });

    res.json({ success: true, boardId: board.id, secretCode, expiresAt });
  } catch (err) {
    console.error("建局失败:", err);
    res.status(500).json({ error: "建局事务失败" });
  }
};

exports.verifySecretCode = async (req, res) => {
  const { secretCode } = req.body;
  try {
    const code = (secretCode || "").toString().trim().toUpperCase();
    if (!code || code.length !== 6) {
      return res.status(404).json({ error: "暗码无效或棋局不存在" });
    }

    const board = await prisma.board.findFirst({
      where: { secret_code: code, is_public: false },
      select: { id: true },
    });
    if (!board) return res.status(404).json({ error: "暗码无效或棋局不存在" });

    res.json({ success: true, boardId: board.id });
  } catch (err) {
    console.error("验证失败:", err);
    res.status(500).json({ error: "服务器异常" });
  }
};

exports.resetGame = async (req, res) => {
  const { boardId } = req.body;
  const userId = req.user?.id;
  if (!boardId || !userId) return res.status(401).json({ error: "未登录" });

  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { black_user_id: true },
    });
    if (!board) return res.status(404).json({ error: "棋盘不存在" });
    if (board.black_user_id !== userId) return res.status(403).json({ error: "仅限房主重置棋局" });

    await prisma.$transaction([
      prisma.move.deleteMany({ where: { board_id: boardId } }),
      prisma.board.update({
        where: { id: boardId },
        data: { status: "playing", winner_id: null, white_user_id: null },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("重置棋局失败:", err);
    res.status(500).json({ error: "重置失败" });
  }
};

exports.getPublicRooms = async (req, res) => {
  try {
    const rooms = await prisma.board.findMany({
      where: { is_public: true, status: "playing" },
      orderBy: { id: "desc" },
      take: 20,
      select: { id: true, status: true },
    });
    res.json({ success: true, rooms });
  } catch (err) {
    console.error("拉取大厅列表失败:", err);
    res.status(500).json({ error: "拉取大厅失败" });
  }
};

exports.endGameInAdvance = async (req, res) => {
  const { boardId } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未登录" });

  try {
    const board = await prisma.board.findFirst({
      where: { id: boardId, black_user_id: userId, status: "playing" },
      select: { white_user_id: true },
    });
    if (!board) return res.status(403).json({ error: "仅限房主操作或棋局已结束" });

    await prisma.board.update({
      where: { id: boardId },
      data: { status: "finished", winner_id: board.white_user_id },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "操作失败" });
  }
};

exports.getUserHistory = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未登录" });

  try {
    const boards = await prisma.board.findMany({
      where: {
        OR: [
          { black_user_id: userId },
          { white_user_id: userId },
          { moves: { some: { user_id: userId } } },
        ],
      },
      orderBy: { created_at: "desc" },
      take: 30,
      select: { id: true, status: true, is_public: true, created_at: true },
      distinct: ["id"],
    });
    res.json({ success: true, history: boards });
  } catch (err) {
    res.status(500).json({ error: "获取历史失败" });
  }
};

exports.getGame = async (req, res) => {
  const boardId = parseInt(req.params.boardId);
  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, status: true, winner_id: true, black_user_id: true, white_user_id: true },
    });
    if (!board) return res.status(404).json({ error: "棋局不存在" });

    const moves = await prisma.move.findMany({
      where: { board_id: boardId },
      orderBy: { id: "asc" },
      select: { x: true, y: true, player: true },
    });

    res.json({ success: true, board, moves });
  } catch (err) {
    console.error("获取棋局失败:", err);
    res.status(500).json({ error: "获取棋局失败" });
  }
};
