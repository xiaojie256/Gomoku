// controllers/gameController.js
const redisClient = require("../db/redis");
const pool = require("../db/postgres");
const createGomokuLogic = require("../wasm/logic.js");

let wasmModule = null;

// 初始化加载 WASM 模块
createGomokuLogic()
  .then((mod) => {
    wasmModule = mod;
    console.log("Express 成功加载 WASM 核心计算模块");
  })
  .catch((err) => {
    console.error("Express 加载 WASM 模块失败:", err);
  });

exports.submitMove = async (req, res) => {
  const { boardId, x, y, player } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未登录" });
  const lockKey = `board_lock:${boardId}`;

  const acquired = await redisClient.set(lockKey, "LOCKED", {
    NX: true,
    EX: 2,
  });
  if (!acquired)
    return res.status(429).json({ error: "落子冲突或操作过快，请重试" });

  let pointer = 0;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. 获取棋局状态并加锁
    const boardRes = await client.query(
      "SELECT status, black_user_id, white_user_id, created_at FROM boards WHERE id = $1 FOR UPDATE",
      [boardId],
    );
    if (boardRes.rows.length === 0) throw new Error("棋盘不存在");
    const board = boardRes.rows[0];

    // 2. 检查 10 天生命周期限制
    const daysDiff =
      (new Date() - new Date(board.created_at)) / (1000 * 3600 * 24);
    if (daysDiff > 10 && board.status === "playing") {
      await client.query("UPDATE boards SET status = 'draw' WHERE id = $1", [
        boardId,
      ]);
      throw new Error("该棋局已超过 10 天生命周期，系统已自动判定为和局");
    }

    if (board.status !== "playing") throw new Error("当前棋局已结束，无法落子");

    // 3. 读取最新落子历史
    const movesRes = await client.query(
      "SELECT x, y, player FROM moves WHERE board_id = $1 ORDER BY id ASC",
      [boardId],
    );
    const currentMoves = movesRes.rows;
    const expectedPlayer = currentMoves.length % 2 === 0 ? 1 : 2;

    if (player !== expectedPlayer)
      throw new Error(`当前该${expectedPlayer === 1 ? "黑子" : "白子"}落子`);

    // 4. 核心：阵营校验与抢位（先到先得）
    if (player === 1 && board.black_user_id !== userId) {
      throw new Error("只有建局者可以执黑落子");
    }
    if (player === 2) {
      if (!board.white_user_id) {
        // 首个落子的白方，锁定身份
        await client.query(
          "UPDATE boards SET white_user_id = $1 WHERE id = $2",
          [userId, boardId],
        );
      } else if (board.white_user_id !== userId) {
        throw new Error("当前棋局的白子已被其他玩家抢先绑定");
      }
    }

    // 重建盘面并进行 WASM 校验
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

    await client.query(
      "INSERT INTO moves (board_id, user_id, x, y, player) VALUES ($1, $2, $3, $4, $5)",
      [boardId, userId, x, y, player],
    );

    if (gameState !== 0) {
      const status = gameState === 1 ? "finished" : "draw";
      const winnerId = gameState === 1 ? userId : null;
      await client.query(
        "UPDATE boards SET status = $1, winner_id = $2 WHERE id = $3",
        [status, winnerId, boardId],
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, gameState, x, y, player });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(403).json({ error: err.message || "异常" });
  } finally {
    if (pointer) wasmModule._free(pointer);
    // 确保无论如何事务都会被关闭，防止连接池泄漏
    client.release();
    await redisClient.del(lockKey);
  }
};

// 辅助函数：生成 6 位大写随机暗码
const generateSecretCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// 创建新棋局 (支持公开/私密)
exports.createGame = async (req, res) => {
  const { isPublic } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未登录" });

  const client = await pool.connect();
  try {
    // 优化：优先从 Redis 缓存读取 max_active_games，避免每次建局都查数据库
    let maxGamesLimit = 5;
    const cachedLimit = await redisClient.get(
      "global_settings:max_active_games",
    );
    if (cachedLimit) {
      maxGamesLimit = parseInt(cachedLimit);
    } else {
      const settingsRes = await client.query(
        "SELECT value FROM global_settings WHERE key = 'max_active_games'",
      );
      if (settingsRes.rows.length > 0) {
        maxGamesLimit = parseInt(settingsRes.rows[0].value);
        // 回写缓存
        await redisClient.set(
          "global_settings:max_active_games",
          maxGamesLimit.toString(),
        );
      }
    }

    // ⬇️ 修改：检查进行中的棋局是否超过动态阈值
    const countRes = await client.query(
      "SELECT count(*) FROM boards WHERE black_user_id = $1 AND status = 'playing'",
      [userId],
    );
    if (parseInt(countRes.rows[0].count) >= maxGamesLimit) {
      return res
        .status(403)
        .json({ error: `您同时开启的对局数已达 ${maxGamesLimit} 局上限` });
    }

    const secretCode = isPublic ? null : generateSecretCode();
    const result = await client.query(
      "INSERT INTO boards (black_user_id, is_public, secret_code, status) VALUES ($1, $2, $3, 'playing') RETURNING id",
      [userId, isPublic, secretCode],
    );
    const board = result.rows[0];
    // 不在暗码验证环节自动分配白方，保留首个实际落子时的 "先落子得白" 机制。
    // 仅返回可加入的棋盘 ID，实际身份在第一次落子时由后端在事务内确定并绑定。
    res.json({ success: true, boardId: board.id });
  } catch (err) {
    console.error("建局失败:", err);
    res.status(500).json({ error: "建局事务失败" });
  } finally {
    client.release();
  }
};

// 验证暗码
exports.verifySecretCode = async (req, res) => {
  const { secretCode } = req.body;
  const userId = req.user?.id;
  const client = await pool.connect();
  try {
    const code = (secretCode || "").toString().trim().toUpperCase();
    if (!code || code.length !== 6) {
      return res.status(404).json({ error: "暗码无效或棋局不存在" });
    }

    const result = await client.query(
      "SELECT id, black_user_id, white_user_id FROM boards WHERE secret_code = $1 AND is_public = false LIMIT 1",
      [code],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "暗码无效或棋局不存在" });
    }

    const board = result.rows[0];
    res.json({ success: true, boardId: board.id });
  } catch (err) {
    console.error("验证失败:", err);
    res.status(500).json({ error: "服务器异常" });
  } finally {
    client.release();
  }
};

// 新增：重置棋局（仅限房主）
exports.resetGame = async (req, res) => {
  const { boardId } = req.body;
  const userId = req.user?.id;
  if (!boardId || !userId) return res.status(401).json({ error: "未登录" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const boardRes = await client.query(
      "SELECT black_user_id FROM boards WHERE id = $1 FOR UPDATE",
      [boardId],
    );
    if (boardRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "棋盘不存在" });
    }
    const board = boardRes.rows[0];
    if (board.black_user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "仅限房主重置棋局" });
    }

    // 删除该棋盘的所有落子，重置状态为 playing，并清除白方绑定与 winner
    await client.query("DELETE FROM moves WHERE board_id = $1", [boardId]);
    await client.query(
      "UPDATE boards SET status = 'playing', winner_id = NULL, white_user_id = NULL WHERE id = $1",
      [boardId],
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("重置棋局失败:", err);
    res.status(500).json({ error: "重置失败" });
  } finally {
    client.release();
  }
};

// 拉取大厅公开棋局列表
exports.getPublicRooms = async (req, res) => {
  const client = await pool.connect();
  try {
    // 仅拉取状态为 playing 且 is_public 为 true 的棋局，按创建时间倒序
    const result = await client.query(
      "SELECT id, status FROM boards WHERE is_public = true AND status = 'playing' ORDER BY id DESC LIMIT 20",
    );
    res.json({ success: true, rooms: result.rows });
  } catch (err) {
    console.error("拉取大厅列表失败:", err);
    res.status(500).json({ error: "拉取大厅失败" });
  } finally {
    client.release();
  }
};

// 新增：房主提前结束游戏
exports.endGameInAdvance = async (req, res) => {
  const { boardId } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未登录" });
  const client = await pool.connect();
  try {
    const result = await client.query(
      "UPDATE boards SET status = 'finished', winner_id = white_user_id WHERE id = $1 AND black_user_id = $2 AND status = 'playing' RETURNING id",
      [boardId, userId],
    );
    if (result.rows.length === 0)
      return res.status(403).json({ error: "仅限房主操作或棋局已结束" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "操作失败" });
  } finally {
    client.release();
  }
};

// 新增：拉取用户的历史对局 (最多30局)
exports.getUserHistory = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "未登录" });
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT b.id, b.status, b.is_public, b.created_at
             FROM boards b
             LEFT JOIN moves m ON b.id = m.board_id
             WHERE b.black_user_id = $1 OR b.white_user_id = $1 OR m.user_id = $1
             ORDER BY b.created_at DESC
             LIMIT 30`,
      [userId],
    );
    res.json({ success: true, history: result.rows });
  } catch (err) {
    res.status(500).json({ error: "获取历史失败" });
  } finally {
    client.release();
  }
};

// 获取棋局状态与历史落子（用于前端异步还原盘面）
exports.getGame = async (req, res) => {
  const { boardId } = req.params;
  const client = await pool.connect();
  try {
    const boardRes = await client.query(
      "SELECT id, status, winner_id, black_user_id, white_user_id FROM boards WHERE id = $1",
      [boardId],
    );
    if (boardRes.rows.length === 0) {
      return res.status(404).json({ error: "棋局不存在" });
    }

    const movesRes = await client.query(
      "SELECT x, y, player FROM moves WHERE board_id = $1 ORDER BY id ASC",
      [boardId],
    );

    res.json({
      success: true,
      board: boardRes.rows[0],
      moves: movesRes.rows,
    });
  } catch (err) {
    console.error("获取棋局失败:", err);
    res.status(500).json({ error: "获取棋局失败" });
  } finally {
    client.release();
  }
};
