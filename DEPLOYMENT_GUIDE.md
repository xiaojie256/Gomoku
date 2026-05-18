# 服务器部署打包指南

## ⚠️ 重要提示

在将代码上传到服务器之前，**必须删除以下目录和文件**，否则会导致部署失败。

## ❌ 必须删除/不传的目录和文件

```
node_modules/              # 后端依赖库（体积巨大，服务器会重新安装）
frontend/node_modules/     # 前端依赖库（体积巨大，服务器会重新安装）
frontend/.next/            # Next.js 本地编译缓存（服务器会重新编译）
.git/                      # Git 版本控制目录（不需要传到应用服务器）
.DS_Store                  # macOS 系统文件
.env.local                 # 本地环境变量（不应上传）
```

**删除原因：**
- 服务器使用 `docker-compose up --build` 会在纯净的 Linux 环境中根据 `package.json` 重新下载依赖
- 本地编译的产物（.next/）在服务器环境中无法使用
- Windows/Mac 本地依赖与 Linux 服务器环境不兼容

## ✅ 必须保留并上传的目录和文件

你的压缩包应该只包含以下内容：

```
Gomoku/
├── controllers/           # 控制器
├── routes/                # 路由
├── middlewares/           # 中间件
├── db/                    # 数据库配置
├── wasm/                  # WASM 模块
├── frontend/              # 前端源码
│   ├── app/              # Next.js App Router
│   ├── components/       # React 组件
│   ├── utils/            # 工具函数
│   ├── package.json      # 前端依赖配置
│   ├── package-lock.json # 前端依赖锁定文件
│   ├── tsconfig.json     # TypeScript 配置
│   ├── next.config.js    # Next.js 配置
│   └── tailwind.config.js # Tailwind CSS 配置
├── package.json           # 后端依赖配置
├── package-lock.json      # 后端依赖锁定文件
├── server.js              # 后端入口文件
├── docker-compose.yml     # Docker Compose 配置
├── Dockerfile             # 后端 Docker 镜像构建文件
├── .env                   # 环境变量（如果使用）
├── update_db_v8.js        # 数据库迁移脚本
├── NGINX_WEBSOCKET_CONFIG.md # Nginx 配置说明
└── DEPLOYMENT_GUIDE.md    # 本文件
```

## 📦 打包步骤（Windows）

### 方法一：使用 PowerShell 删除并打包

```powershell
# 进入项目目录
cd e:\PpProjects\Gomoku

# 删除不需要的目录
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend/.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue

# 压缩为 zip 文件
Compress-Archive -Path * -DestinationPath Gomoku-Deploy.zip -Force
```

### 方法二：手动删除后压缩

1. 在文件资源管理器中打开 `e:\PpProjects\Gomoku`
2. 删除 `node_modules` 文件夹
3. 删除 `frontend/node_modules` 文件夹
4. 删除 `frontend/.next` 文件夹
5. 删除 `.git` 文件夹（如果存在）
6. 右键点击剩余的所有文件和文件夹
7. 选择"发送到" -> "压缩(zipped)文件夹"

## 📦 打包步骤（macOS/Linux）

```bash
# 进入项目目录
cd e:\PpProjects\Gomoku

# 删除不需要的目录
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf frontend/.next
rm -rf .git

# 压缩为 tar.gz 文件
tar -czf Gomoku-Deploy.tar.gz *
```

## 🚀 服务器部署步骤

### 1. 上传压缩包到服务器

使用 SCP、SFTP 或宝塔面板文件管理器上传压缩包到服务器：
```bash
# 示例：使用 SCP 上传
scp Gomoku-Deploy.zip root@your-server:/www/wwwroot/
```

### 2. 在服务器上解压

```bash
# SSH 登录服务器
ssh root@your-server

# 进入目录
cd /www/wwwroot/Gomoku

# 备份旧版本（可选）
mv . ../Gomoku-backup-$(date +%Y%m%d)

# 解压新版本
unzip Gomoku-Deploy.zip
# 或
tar -xzf Gomoku-Deploy.tar.gz
```

### 3. 运行数据库迁移

```bash
cd /www/wwwroot/Gomoku
docker-compose exec backend node update_db_v8.js
```

### 4. 配置 Nginx WebSocket 支持

按照 `NGINX_WEBSOCKET_CONFIG.md` 中的说明配置 Nginx。

### 5. 启动服务

```bash
cd /www/wwwroot/Gomoku
docker-compose up -d --build
```

### 6. 验证部署

- 访问 `https://gomoku.xiaojie256.top` 检查网站是否正常
- 打开浏览器开发者工具（F12）-> Network 标签
- 检查是否有 WebSocket 连接（状态 101 Switching Protocols）
- 确认没有 6 秒轮询请求

## 🔍 验证清单

- [ ] 已删除 `node_modules/`
- [ ] 已删除 `frontend/node_modules/`
- [ ] 已删除 `frontend/.next/`
- [ ] 已删除 `.git/`
- [ ] 前端 WebSocket 连接使用相对路径 `io('/')`
- [ ] 后端 CORS 配置包含 `https://gomoku.xiaojie256.top`
- [ ] 已运行数据库迁移 `update_db_v8.js`
- [ ] Nginx 已配置 WebSocket 支持
- [ ] Docker 容器成功启动
- [ ] 网站可以正常访问
- [ ] WebSocket 连接正常（无轮询）

## ⚡ 常见问题

**Q: 为什么不能直接上传整个项目文件夹？**
A: 本地依赖体积巨大（node_modules 可能数百MB），且包含平台特定二进制文件，在 Linux 服务器上无法运行。Docker 会在服务器上重新安装依赖。

**Q: 如何验证打包后的文件大小？**
A: 正常的源码包应该在 5-20MB 左右。如果超过 100MB，说明可能误包含了 node_modules。

**Q: 部署后 WebSocket 连接失败怎么办？**
A: 检查 Nginx 配置是否包含了 WebSocket 支持的三个关键配置项（见 NGINX_WEBSOCKET_CONFIG.md）。

**Q: 数据库迁移失败怎么办？**
A: 确保 PostgreSQL 容器正在运行，使用 `docker-compose ps` 检查容器状态。
