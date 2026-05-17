// controllers/gameController.js
const redisClient = require('../db/redis');   
const pool = require('../db/postgres');       
const createGomokuLogic = require('../wasm/logic.js');

let wasmModule = null;

// 初始化加载 WASM 模块
createGomokuLogic().then(mod => { 
    wasmModule = mod; 
    console.log("Express 成功加载 WASM 核心计算模块");
}).catch(err => {
    console.error("Express 加载 WASM 模块失败:", err);
});

exports.submitMove = async (req, res) => {
    const { boardId, userId, x, y, player, currentBoardArray } = req.body;
    const lockKey = `board_lock:${boardId}`;

    const acquired = await redisClient.set(lockKey, "LOCKED", { NX: true, EX: 2 });
    if (!acquired) return res.status(429).json({ error: '落子冲突或操作过快，请重试' });

    let pointer = 0;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. 【安全审计】查询当前棋盘状态与阵营绑定情况 (利用 FOR UPDATE 行级锁防止并发写入)
        const boardRes = await client.query(
            'SELECT status, black_user_id, white_user_id FROM boards WHERE id = $1 FOR UPDATE',
            [boardId]
        );
        
        if (boardRes.rows.length === 0) throw new Error('棋盘不存在');
        const board = boardRes.rows[0];

        if (board.status !== 'playing') {
            throw new Error('当前棋局已结束，无法落子');
        }

        // 2. 【阵营抢占与强绑定逻辑】
        if (player === 1) { // 执黑请求
            if (board.black_user_id === null) {
                // 首子抢占：将此 userId 永久绑定为黑方
                await client.query('UPDATE boards SET black_user_id = $1 WHERE id = $2', [userId, boardId]);
            } else if (board.black_user_id !== userId) {
                throw new Error('非法操作：您不是该局的黑方玩家');
            }
        } else if (player === 2) { // 执白请求
            if (board.white_user_id === null) {
                 // 应对 README 中提到的白方顺位机制：第一个成功落入白子的用户，绑定为白方
                await client.query('UPDATE boards SET white_user_id = $1 WHERE id = $2', [userId, boardId]);
            } else if (board.white_user_id !== userId) {
                throw new Error('非法操作：您不是该局的白方玩家');
            }
        } else {
            throw new Error('非法的阵营参数');
        }

        // --- 以下为原有的 WASM 判定与写入 moves 表的逻辑 ---
        pointer = wasmModule._malloc(900);
        for (let i = 0; i < 225; i++) {
            wasmModule.setValue(pointer + (i * 4), currentBoardArray[i], 'i32');
        }
        wasmModule.setValue(pointer + ((y * 15 + x) * 4), player, 'i32');
        
        const gameState = wasmModule._check_game_state(pointer, x, y, player);

        await client.query(
            'INSERT INTO moves (board_id, user_id, x, y, player) VALUES ($1, $2, $3, $4, $5)',
            [boardId, userId, x, y, player]
        );

        if (gameState !== 0) {
            const status = gameState === 1 ? 'finished' : 'draw';
            const winnerId = gameState === 1 ? userId : null;
            await client.query(
                'UPDATE boards SET status = $1, winner_id = $2 WHERE id = $3',
                [status, winnerId, boardId]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, gameState, x, y, player });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("落子处理拦截:", err.message);
        // 返回明确的错误信息给前端拦截
        res.status(403).json({ error: err.message || '服务器内部计算或入库异常' });
    } finally {
        if (pointer) wasmModule._free(pointer); 
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
    // 接收前端传入的布尔值
    const { isPublic } = req.body; 
    const secretCode = isPublic ? null : generateSecretCode();

    const client = await pool.connect();
    try {
        const result = await client.query(
            "INSERT INTO boards (status, is_public, secret_code) VALUES ('playing', $1, $2) RETURNING id, secret_code",
            [isPublic, secretCode]
        );
        res.json({ 
            success: true, 
            boardId: result.rows[0].id,
            secretCode: result.rows[0].secret_code 
        });
    } catch (err) {
        console.error("建局失败:", err);
        res.status(500).json({ error: '建局事务失败' });
    } finally {
        client.release();
    }
};

// 验证暗码
exports.verifySecretCode = async (req, res) => {
    const { secretCode } = req.body;
    const client = await pool.connect();
    try {
        const result = await client.query(
            "SELECT id FROM boards WHERE secret_code = $1 AND is_public = false LIMIT 1",
            [secretCode]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '暗码无效或棋局不存在' });
        }
        res.json({ success: true, boardId: result.rows[0].id });
    } catch (err) {
        console.error("验证失败:", err);
        res.status(500).json({ error: '服务器异常' });
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
            "SELECT id, status FROM boards WHERE is_public = true AND status = 'playing' ORDER BY id DESC LIMIT 20"
        );
        res.json({ success: true, rooms: result.rows });
    } catch (err) {
        console.error("拉取大厅列表失败:", err);
        res.status(500).json({ error: '拉取大厅失败' });
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
            [boardId]
        );
        if (boardRes.rows.length === 0) {
            return res.status(404).json({ error: '棋局不存在' });
        }

        const movesRes = await client.query(
            "SELECT x, y, player FROM moves WHERE board_id = $1 ORDER BY id ASC", 
            [boardId]
        );
        
        res.json({ 
            success: true, 
            board: boardRes.rows[0], 
            moves: movesRes.rows 
        });
    } catch (err) {
        console.error("获取棋局失败:", err);
        res.status(500).json({ error: '获取棋局失败' });
    } finally {
        client.release();
    }
};