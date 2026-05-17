const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middlewares/auth");
const { requireAdmin } = require("../middlewares/admin");

// 用户管理
router.get("/users", authenticateToken, requireAdmin, adminController.getAllUsers);
router.get("/users/:userId", authenticateToken, requireAdmin, adminController.getUserById);
router.put("/users/:userId/admin", authenticateToken, requireAdmin, adminController.setUserAdmin);
router.delete("/users/:userId", authenticateToken, requireAdmin, adminController.deleteUser);

// 对局管理
router.get("/games", authenticateToken, requireAdmin, adminController.getAllGames);
router.delete("/games/:gameId", authenticateToken, requireAdmin, adminController.deleteGame);

// 系统统计
router.get("/stats", authenticateToken, requireAdmin, adminController.getStats);

module.exports = router;
