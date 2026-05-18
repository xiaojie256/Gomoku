// server.js
require('dotenv').config(); // 引入环境变量支持
const express = require("express");
const http = require('http');
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
const gameRoutes = require("./routes/game");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

// 1. 创建 HTTP server
const server = http.createServer(app);

// 2. 初始化 Socket.io，配置跨域
const io = new Server(server, {
  cors: {
    origin: ["https://gomoku.xiaojie256.top", "http://localhost:3000", "http://localhost:4125"],
    methods: ["GET", "POST"]
  }
});

// 3. 将 io 挂载到 app 上，方便 controller 调用
app.set('io', io);

// 4. 监听客户端连接并加入对应的棋盘房间
io.on('connection', (socket) => {
  console.log('玩家已连接:', socket.id);
  
  // 玩家进入棋盘页面时，加入特定的房间
  socket.on('join_board', (boardId) => {
    socket.join(boardId);
    console.log(`玩家 ${socket.id} 加入了棋盘房间: ${boardId}`);
  });

  socket.on('disconnect', () => {
    console.log('玩家已断开:', socket.id);
  });
});

app.use(cors()); // 允许跨域请求
app.use(express.json()); 

app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);

// 5. 启动服务 (注意：这里用 server.listen 而不是 app.listen)
const PORT = process.env.PORT || 4125;
server.listen(PORT, () => {
  console.log(`🚀 后端核心服务已启动: http://localhost:${PORT}`);
});
