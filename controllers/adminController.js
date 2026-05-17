const pool = require("../db/postgres");

// 获取所有用户列表
exports.getAllUsers = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC"
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error("获取用户列表失败:", err);
    res.status(500).json({ error: "获取用户列表失败" });
  } finally {
    client.release();
  }
};

// 设置用户管理员权限
exports.setUserAdmin = async (req, res) => {
  // 支持通过 URL param 或请求 body 提交 userId
  const userId = req.params.userId || req.body.userId;
  const isAdmin = typeof req.body.isAdmin !== 'undefined' ? req.body.isAdmin : req.query.isAdmin === 'true';
  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE users SET is_admin = $1 WHERE id = $2",
      [isAdmin, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("设置管理员权限失败:", err);
    res.status(500).json({ error: "设置管理员权限失败" });
  } finally {
    client.release();
  }
};

// 删除用户
exports.deleteUser = async (req, res) => {
  const { userId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 删除用户相关的落子记录
    await client.query("DELETE FROM moves WHERE user_id = $1", [userId]);
    
    // 将用户作为房主或白方的棋局重置
    await client.query("UPDATE boards SET black_user_id = NULL WHERE black_user_id = $1", [userId]);
    await client.query("UPDATE boards SET white_user_id = NULL WHERE white_user_id = $1", [userId]);
    
    // 删除用户
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("删除用户失败:", err);
    res.status(500).json({ error: "删除用户失败" });
  } finally {
    client.release();
  }
};

// 获取所有对局列表
exports.getAllGames = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT b.id, b.status, b.is_public, b.created_at, b.winner_id, 
              b.black_user_id, b.white_user_id,
              u1.username as black_username, 
              u2.username as white_username
       FROM boards b
       LEFT JOIN users u1 ON b.black_user_id = u1.id
       LEFT JOIN users u2 ON b.white_user_id = u2.id
       ORDER BY b.created_at DESC
       LIMIT 100`
    );
    res.json({ success: true, games: result.rows });
  } catch (err) {
    console.error("获取对局列表失败:", err);
    res.status(500).json({ error: "获取对局列表失败" });
  } finally {
    client.release();
  }
};

// 删除对局
exports.deleteGame = async (req, res) => {
  const { gameId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    await client.query("DELETE FROM moves WHERE board_id = $1", [gameId]);
    await client.query("DELETE FROM boards WHERE id = $1", [gameId]);
    
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("删除对局失败:", err);
    res.status(500).json({ error: "删除对局失败" });
  } finally {
    client.release();
  }
};

// 获取系统统计信息
exports.getStats = async (req, res) => {
  const client = await pool.connect();
  try {
    const userCount = await client.query("SELECT COUNT(*) FROM users");
    const gameCount = await client.query("SELECT COUNT(*) FROM boards");
    const activeGameCount = await client.query("SELECT COUNT(*) FROM boards WHERE status = 'playing'");
    const finishedGameCount = await client.query("SELECT COUNT(*) FROM boards WHERE status = 'finished'");
    
    res.json({
      success: true,
      stats: {
        totalUsers: parseInt(userCount.rows[0].count),
        totalGames: parseInt(gameCount.rows[0].count),
        activeGames: parseInt(activeGameCount.rows[0].count),
        finishedGames: parseInt(finishedGameCount.rows[0].count),
      }
    });
  } catch (err) {
    console.error("获取统计信息失败:", err);
    res.status(500).json({ error: "获取统计信息失败" });
  } finally {
    client.release();
  }
};
