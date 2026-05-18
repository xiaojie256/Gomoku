FROM node:22-alpine
WORKDIR /app

# 安装 Prisma 需要的 OpenSSL
RUN apk add --no-cache openssl libc6-compat

# 清除代理设置
ENV HTTP_PROXY=""
ENV HTTPS_PROXY=""
ENV http_proxy=""
ENV https_proxy=""
ENV ALL_PROXY=""
ENV all_proxy=""

# 配置 npm
RUN npm config delete proxy 2>/dev/null || true && \
    npm config delete https-proxy 2>/dev/null || true && \
    npm config set registry https://registry.npmmirror.com

# 先复制 package.json 安装依赖（跳过 postinstall）
COPY package*.json ./
RUN npm ci --ignore-scripts

# 再复制全部代码（包括 prisma/schema.prisma）
COPY . .

# 手动运行 prisma generate
RUN npx prisma generate

# 删除 dev 依赖减小镜像
RUN npm prune --omit=dev

EXPOSE 4125
CMD ["node", "server.js"]