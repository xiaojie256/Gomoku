const { createClient } = require('redis');

const redisClient = createClient({
    url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis 客户端连接异常:', err));

redisClient.connect().then(() => {
    console.log('Redis 客户端成功连接至本地容器');
}).catch((err) => {
    console.error('Redis 连接失败:', err);
});

module.exports = redisClient;