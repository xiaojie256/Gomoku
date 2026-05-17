const poolImport = require('./db/postgres');
const pool = poolImport.connect ? poolImport : poolImport.pool;

const runTest = async () => {
    // 1. 先在数据库创建一个测试棋盘，获取真实的 boardId
    const resBoard = await pool.query("INSERT INTO boards DEFAULT VALUES RETURNING id");
    const boardId = resBoard.rows[0].id;
    console.log(`已自动创建测试棋盘，ID 为: ${boardId}`);

    // 2. 模拟盘面数据：前 4 子已连线 (一维数组 0~3 位为黑子)
    const currentBoardArray = new Array(225).fill(0);
    for (let i = 0; i < 4; i++) {
        currentBoardArray[i] = 1; 
    }

    // 3. 模拟前端向后端发起的落子 POST 请求（落子在第 5 格，达成五子连珠）
    const response = await fetch('http://localhost:3000/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            boardId: boardId,
            userId: 99,       
            x: 4,             
            y: 0,             
            player: 1,        
            currentBoardArray: currentBoardArray
        })
    });

    const result = await response.json();
    console.log("后端 API 最终返回响应:", result);
    process.exit();
};

runTest().catch((err) => {
    console.error("测试未通过，原因:", err);
    process.exit(1);
});
