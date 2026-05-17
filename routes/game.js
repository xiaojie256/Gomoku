// routes/game.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// 路由挂载
router.get('/lobby', gameController.getPublicRooms); // 拉取大厅列表
router.post('/create', gameController.createGame);   // 创建棋局
router.post('/verify', gameController.verifySecretCode); // 验证暗码
router.get('/:boardId', gameController.getGame);     // 获取单局详情 (上一步写的)
router.post('/move', gameController.submitMove);     // 核心落子接口

module.exports = router;