const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn'] : ['error'],
});

prisma.$connect()
  .then(() => console.log('✅ Prisma 客户端连接成功'))
  .catch((err) => console.error('❌ Prisma 连接失败:', err));

module.exports = prisma;
