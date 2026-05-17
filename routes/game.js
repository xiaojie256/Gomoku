// routes/game.js
const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

// 路由挂载
router.get("/lobby", gameController.getPublicRooms); // 拉取大厅列表
router.post("/create", gameController.createGame); // 创建棋局
router.post("/verify", gameController.verifySecretCode); // 验证暗码
router.post("/reset", gameController.resetGame); // 房主重置棋局
router.get("/:boardId", gameController.getGame); // 获取单局详情 (上一步写的)
router.post("/move", gameController.submitMove); // 核心落子接口
router.post("/end", gameController.endGameInAdvance); // 房主提前结束
router.get("/history/:userId", gameController.getUserHistory); // 获取用户历史

module.exports = router;
