const poolImport = require('./db/postgres');
const pool = poolImport.connect ? poolImport : poolImport.pool;

const runTest = async () => {
    // 1. 注册测试用户
    const registerRes = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'test_user_' + Date.now(),
            password: 'test123'
        })
    });
    const registerData = await registerRes.json();
    const token = registerData.token;
    console.log("测试用户注册成功，Token:", token);

    // 2. 创建测试棋局
    const createRes = await fetch('http://localhost:3000/api/game/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            isPublic: true
        })
    });
    const createData = await createRes.json();
    const boardId = createData.boardId;
    console.log(`已创建测试棋局，ID 为: ${boardId}`);

    // 3. 模拟盘面数据：前 4 子已连线 (一维数组 0~3 位为黑子)
    const currentBoardArray = new Array(225).fill(0);
    for (let i = 0; i < 4; i++) {
        currentBoardArray[i] = 1; 
    }

    // 4. 模拟前端向后端发起的落子 POST 请求（落子在第 5 格，达成五子连珠）
    const response = await fetch('http://localhost:3000/api/game/move', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            boardId: boardId,
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
