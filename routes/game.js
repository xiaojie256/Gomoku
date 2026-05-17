// routes/game.js
const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");
const { authenticateToken } = require("../middlewares/auth");

// 路由挂载
router.get("/lobby", gameController.getPublicRooms); // 拉取大厅列表
router.post("/create", authenticateToken, gameController.createGame); // 创建棋局
router.post("/verify", authenticateToken, gameController.verifySecretCode); // 验证暗码
router.post("/reset", authenticateToken, gameController.resetGame); // 房主重置棋局
router.get("/:boardId", gameController.getGame); // 获取单局详情
router.post("/move", authenticateToken, gameController.submitMove); // 核心落子接口
router.post("/end", authenticateToken, gameController.endGameInAdvance); // 房主提前结束
router.get("/history", authenticateToken, gameController.getUserHistory); // 获取用户历史

module.exports = router;
