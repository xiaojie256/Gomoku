// server.js
const express = require("express");
const app = express();
const gameRoutes = require("./routes/game");
const authRoutes = require("./routes/auth");

app.use(express.json()); // 解析 JSON 请求体

// 挂载身份认证接口
app.use("/api/auth", authRoutes);
// 挂载落子 API
app.use("/api/game", gameRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`本地开发服务器已启动: http://localhost:${PORT}`);
});
