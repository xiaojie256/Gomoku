const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middlewares/auth");
const { requireAdmin } = require("../middlewares/admin");

// 用户管理
router.get(
  "/users",
  authenticateToken,
  requireAdmin,
  adminController.getAllUsers,
);
router.get(
  "/users/:userId",
  authenticateToken,
  requireAdmin,
  adminController.getUserById,
);
router.put(
  "/users/:userId/admin",
  authenticateToken,
  requireAdmin,
  adminController.setUserAdmin,
);
router.delete(
  "/users/:userId",
  authenticateToken,
  requireAdmin,
  adminController.deleteUser,
);

// 对局管理
router.get(
  "/games",
  authenticateToken,
  requireAdmin,
  adminController.getAllGames,
);
router.delete(
  "/games/:gameId",
  authenticateToken,
  requireAdmin,
  adminController.deleteGame,
);

// 系统统计
router.get("/stats", authenticateToken, requireAdmin, adminController.getStats);

// 系统设置管理
router.get("/settings", authenticateToken, requireAdmin, adminController.getSettings);
router.put("/settings", authenticateToken, requireAdmin, adminController.updateSetting);

// 系统配置接口 (用于前端控制台)
router.get("/config", authenticateToken, requireAdmin, adminController.getConfig);
router.post("/config", authenticateToken, requireAdmin, adminController.updateConfig);

// 修改管理员密码
router.post("/change-password", authenticateToken, requireAdmin, adminController.changePassword);

module.exports = router;
