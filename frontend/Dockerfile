# ---- 构建阶段 ----
FROM node:22-alpine AS builder
WORKDIR /app

# 清除代理设置
ENV HTTP_PROXY=""
ENV HTTPS_PROXY=""
ENV http_proxy=""
ENV https_proxy=""
ENV ALL_PROXY=""
ENV all_proxy=""

RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts

COPY . .

ARG BACKEND_URL=http://localhost:4125
ENV BACKEND_URL=${BACKEND_URL}

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---- 运行阶段 ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# 监听所有接口，允许外部访问
ENV HOSTNAME=0.0.0.0

# 复制 standalone 输出（包含所有静态资源）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]