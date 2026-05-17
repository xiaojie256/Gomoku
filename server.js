// server.js
const express = require("express");
const app = express();
const gameRoutes = require("./routes/game");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

app.use(express.json()); // 解析 JSON 请求体

// 挂载身份认证接口
app.use("/api/auth", authRoutes);
// 挂载落子 API
app.use("/api/game", gameRoutes);
// 挂载管理后台 API
app.use("/api/admin", adminRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`本地开发服务器已启动: http://localhost:${PORT}`);
});
