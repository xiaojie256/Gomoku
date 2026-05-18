const { createClient } = require('redis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
    url: redisUrl
});

redisClient.on('error', (err) => console.error('❌ Redis 客户端连接异常:', err));

redisClient.connect().then(() => {
    console.log('✅ Redis 客户端成功连接');
}).catch((err) => {
    console.error('❌ Redis 连接失败:', err);
});

module.exports = redisClient;