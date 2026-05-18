/**
 * JWT 统一配置
 * 避免在多个文件中重复定义 JWT_SECRET
 */
const JWT_SECRET = process.env.JWT_SECRET || "gomoku_dev_secret";
const JWT_EXPIRES_IN = "7d";

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
