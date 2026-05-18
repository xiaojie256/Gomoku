const prisma = require("./prisma");
const redisClient = require("./redis");

const getSettingCached = async (key, defaultValue) => {
  const cached = await redisClient.get(`global_settings:${key}`);
  if (cached) return parseInt(cached);
  const setting = await prisma.globalSettings.findUnique({ where: { key } });
  const value = setting ? parseInt(setting.value) : defaultValue;
  await redisClient.set(`global_settings:${key}`, value.toString());
  return value;
};

module.exports = { getSettingCached };
