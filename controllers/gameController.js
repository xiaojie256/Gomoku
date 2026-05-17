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