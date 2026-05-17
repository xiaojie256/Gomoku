// server.js
require('dotenv').config(); // 引入环境变量支持
const express = require("express");
const cors = require("cors");
const app = express();
const gameRoutes = require("./routes/game");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

app.use(cors()); // 允许跨域请求
app.use(express.json()); 

app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);

// 使用环境变量端口，如果未设置则使用 4125（避开常见的 3000/8080）
const PORT = process.env.PORT || 4125;
app.listen(PORT, () => {
  console.log(`🚀 后端核心服务已启动: http://localhost:${PORT}`);
});
