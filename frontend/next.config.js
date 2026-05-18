/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  basePath: '/gomoku',
  trailingSlash: false,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4125';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },
  // 允许图片域名（如需）
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
