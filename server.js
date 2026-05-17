// server.js
const express = require('express');
const app = express();
const gameRoutes = require('./routes/game');

app.use(express.json()); // 解析 JSON 请求体

// 挂载落子 API
app.use('/api/game', gameRoutes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`本地开发服务器已启动: http://localhost:${PORT}`);
});