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
    // currentBoardArray: 前端传来的当前 225 长度的一维数组
    // player: 1 代表黑子，2 代表白子
    const { boardId, userId, x, y, player, currentBoardArray } = req.body;
    const lockKey = `board_lock:${boardId}`;

    // 1. Redis 分布式锁：防止多玩家使用密钥并发抢占同一落子权
    const acquired = await redisClient.set(lockKey, "LOCKED", {
    NX: true,
    EX: 2
});
    if (!acquired) {
        return res.status(429).json({ error: '落子冲突或操作过快，请重试' });
    }

    let pointer = 0;
    const client = await pool.connect();

    try {
        // 2. 严格遵循防 OOM 规范：分配 900 字节内存
        pointer = wasmModule._malloc(900);
        for (let i = 0; i < 225; i++) {
            wasmModule.setValue(pointer + (i * 4), currentBoardArray[i], 'i32');
        }

        // 3. 将本次落子模拟写入 WASM 内存空间
        wasmModule.setValue(pointer + ((y * 15 + x) * 4), player, 'i32');
        
        // 4. 调用 C++ 判定算法 (1:胜利, -1:和局, 0:继续)
        const gameState = wasmModule._check_game_state(pointer, x, y, player);

        // 5. 开启 PostgreSQL 事务，保证数据一致性
        await client.query('BEGIN');
        
        // 插入落子记录
        await client.query(
            'INSERT INTO moves (board_id, user_id, x, y, player) VALUES ($1, $2, $3, $4, $5)',
            [boardId, userId, x, y, player]
        );

        // 如果胜负已分或和局，更新棋盘主表状态
        if (gameState !== 0) {
            const status = gameState === 1 ? 'finished' : 'draw';
            const winnerId = gameState === 1 ? userId : null;
            await client.query(
                'UPDATE boards SET status = $1, winner_id = $2 WHERE id = $3',
                [status, winnerId, boardId]
            );
        }

        await client.query('COMMIT');
        
        // 返回前端最终计算与入库状态
        res.json({ success: true, gameState, x, y, player });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("落子处理事务失败:", err);
        res.status(500).json({ error: '服务器内部计算或入库异常' });
    } finally {
        // 6. 核心防漏策略：必须在 finally 中强制释放 WASM 内存与 Redis 锁
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
            "SELECT id, status, winner_id FROM boards WHERE id = $1", 
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