# Gomoku 异步五子棋平台

无时间限制的异步五子棋 Web 平台。随时建局随时离线，数据持久落库。

## 技术栈

| 层级 | 技术 |
|---|---|
| 后端 | Node.js + Express 5 + Socket.IO 4 |
| 前端 | Next.js 14 (App Router, standalone) + TypeScript + Tailwind |
| 数据库 | PostgreSQL 15 (Prisma ORM) + Redis 7 |
| 部署 | Docker Compose + Nginx |

## 项目结构

```
Gomoku/
├── backend/                    # Node.js 后端
│   ├── controllers/            # Express 控制器
│   ├── routes/                 # 路由定义
│   ├── middlewares/            # 认证 / 管理员中间件
│   ├── db/                     # prisma.js / redis.js / settings.js
│   ├── config/                 # jwt.js
│   ├── wasm/                   # WASM 胜负判定模块
│   ├── prisma/                 # schema.prisma
│   ├── scripts/                # deploy.sh / create_admin.js
│   ├── tests/                  # unit / integration
│   ├── server.js               # 入口
│   └── Dockerfile
├── frontend/                   # Next.js 前端
│   ├── app/                    # 页面（App Router）
│   ├── components/             # UI 组件
│   ├── utils/                  # api.ts / auth.ts / identity.ts
│   └── Dockerfile
├── docker-compose.yml          # 生产环境
├── docker-compose.local.yml    # 本地开发
├── Makefile
└── README.md
```

## 本地开发

```bash
# 1. 启动所有服务（postgres / redis / backend / frontend）
make local-build

# 2. 首次运行：推送 Prisma schema 并创建管理员
make db-migrate
make admin-create

# 访问
# 前端: http://localhost:3000
# 后端: http://localhost:4125
```

常用命令：

```bash
make local          # 启动（不重建）
make local-logs     # 实时查看日志
make ps             # 查看容器状态
make clean          # 删除所有容器和卷（数据清空）
```

## 生产部署

```bash
bash backend/scripts/deploy.sh [ssh_host] [server_ip]

# 示例
bash backend/scripts/deploy.sh huaxia 101.201.78.140

# 或使用 make
make deploy
```

脚本会自动完成：打包上传 → 生成 `.env`（重部署保留已有密码）→ 构建镜像 → 启动 → 数据库迁移 → 创建管理员 → 健康检查。

### Nginx 反代（可选，统一端口）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

配置后前端和 Socket.IO 均走 80 端口，无需对外暴露 4125。

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DB_PASSWORD` | 数据库密码 | **必填** |
| `JWT_SECRET` | JWT 签名密钥（≥32位） | **必填** |
| `DATABASE_URL` | PostgreSQL 连接串 | 由其他 DB_* 变量拼接 |
| `REDIS_URL` | Redis 连接 URL | `redis://localhost:6379` |
| `PORT` | 后端监听端口 | `4125` |
| `CORS_ORIGINS` | 允许跨域来源，逗号分隔 | `http://localhost:3000` |
| `ADMIN_USER` | 管理员用户名 | `admin` |
| `ADMIN_PASS` | 管理员初始密码 | **必填** |

参考 `.env.example` 配置。

## 核心特性

- **大厅系统**：公开 / 私密棋局，6 位暗码邀请
- **白方顺位**：首个落子的白方自动锁定身份，房主不可自战
- **实时同步**：Socket.IO WebSocket，对手落子即时推送
- **WASM 裁判**：C 编译的 WASM 模块判定胜负与平局
- **管理后台**：用户管理、同开局数上限、注册人数上限、棋盘最大存活时间等动态配置
