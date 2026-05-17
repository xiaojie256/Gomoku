/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // 读取环境变量，默认指向后端的 4125 端口
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4125';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
