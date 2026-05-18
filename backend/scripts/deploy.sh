#!/bin/bash
# Gomoku 自动部署脚本
# 用法: bash scripts/deploy.sh [ssh_host] [server_ip]
# 示例: bash scripts/deploy.sh huaxia 101.201.78.140

set -e

SSH_HOST="${1:-huaxia}"
PROJECT_DIR="/opt/gomoku"
# 优先使用参数传入的 IP，否则从服务器获取
SERVER_IP="${2:-$(ssh "$SSH_HOST" 'curl -4 -sf https://ifconfig.me 2>/dev/null || hostname -I | awk "{print \$1}"')}"

echo "🚀 开始部署 Gomoku 到 $SSH_HOST ($SERVER_IP)"

# 1. 检查 Docker
echo "📦 检查 Docker..."
ssh "$SSH_HOST" 'docker --version > /dev/null 2>&1 || (yum install -y docker-ce && systemctl start docker)'

# 2. 准备项目目录
echo "📁 准备项目..."
ssh "$SSH_HOST" "mkdir -p $PROJECT_DIR"

# 3. 打包并上传代码
echo "📤 打包上传..."
cd "$(dirname "$0")/../.."
export COPYFILE_DISABLE=1
tar czf /tmp/gomoku-deploy.tar.gz \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='._*' --exclude='.DS_Store' \
  .
scp /tmp/gomoku-deploy.tar.gz "$SSH_HOST:$PROJECT_DIR/"
rm -f /tmp/gomoku-deploy.tar.gz 2>/dev/null || true

# 4. 解压代码并生成 .env（保留已有 DB/JWT 密码，只在首次生成）
echo "⚙️ 配置环境..."
ssh "$SSH_HOST" "
cd $PROJECT_DIR
tar --warning=no-unknown-keyword -xzf gomoku-deploy.tar.gz && rm gomoku-deploy.tar.gz

# 读取已有密码（重部署时保留），否则生成新密码
if [ -f backend/.env ]; then
  DB_PASS=\$(grep '^DB_PASSWORD=' backend/.env | cut -d= -f2)
  JWT_SECRET=\$(grep '^JWT_SECRET=' backend/.env | cut -d= -f2)
  ADMIN_PASS=\$(grep '^ADMIN_PASS=' backend/.env | cut -d= -f2)
fi
DB_PASS=\${DB_PASS:-\$(openssl rand -hex 16)}
JWT_SECRET=\${JWT_SECRET:-\$(openssl rand -hex 32)}
ADMIN_PASS=\${ADMIN_PASS:-\$(openssl rand -hex 8)}

cat > backend/.env << EOF
DB_HOST=postgres
DB_PORT=5432
DB_USER=gomoku_user
DB_PASSWORD=\$DB_PASS
DB_NAME=gomoku_db
DATABASE_URL=postgresql://gomoku_user:\$DB_PASS@postgres:5432/gomoku_db
REDIS_URL=redis://redis:6379
JWT_SECRET=\$JWT_SECRET
PORT=4125
CORS_ORIGINS=http://localhost:3000,http://localhost:4125,http://$SERVER_IP:3000,http://$SERVER_IP:4125
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=\$ADMIN_PASS
EOF

echo \"✅ 环境变量已配置（管理员密码: \$ADMIN_PASS）\"
"

# 5. 拉取基础镜像（仅首次或本地无镜像时）
echo "🐳 检查基础镜像..."
ssh "$SSH_HOST" '
for tag in "postgres:15-alpine" "redis:7-alpine" "node:22-alpine"; do
  if ! docker image inspect "$tag" > /dev/null 2>&1; then
    mirror="m.daocloud.io/docker.io/library/$tag"
    echo "  拉取 $tag ..."
    docker pull "$mirror" 2>/dev/null && docker tag "$mirror" "$tag" 2>/dev/null || true
  fi
done
'

# 6. 构建并启动（不停止现有服务，只重建变化部分）
echo "🚀 构建并启动..."
ssh "$SSH_HOST" "
cd $PROJECT_DIR
export DOCKER_BUILDKIT=1
docker compose up -d --build 2>&1

# 等待数据库就绪
echo '⏳ 等待数据库就绪...'
until docker compose exec -T postgres pg_isready -U gomoku_user 2>/dev/null; do
  echo '  等待 postgres...'
  sleep 2
done

# 数据库迁移
echo '📊 执行数据库迁移...'
docker compose exec -T backend npx prisma db push --accept-data-loss 2>&1

# 创建管理员
echo '👤 创建管理员账号...'
docker compose exec -T backend node scripts/create_admin.js 2>&1 || echo '管理员创建失败（可能已存在）'

# 健康检查
echo '🔍 健康检查...'
sleep 5
if curl -sf http://localhost:4125/api/game/lobby > /dev/null 2>&1; then
  echo '✅ 后端服务正常'
else
  echo '❌ 后端服务异常，查看日志:'
  docker compose logs backend --tail=20
  exit 1
fi
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  echo '✅ 前端服务正常'
fi

ADMIN_PASS=\$(grep '^ADMIN_PASS=' backend/.env | cut -d= -f2)
echo ''
echo '✅ 部署完成！'
echo \"🌐 前端: http://$SERVER_IP:3000\"
echo \"⚙️  后端: http://$SERVER_IP:4125\"
echo \"👤 管理员: admin / \$ADMIN_PASS\"
echo ''
echo '📋 常用命令:'
echo '   查看日志: ssh $SSH_HOST \"cd $PROJECT_DIR && docker compose logs -f\"'
echo '   重启服务: ssh $SSH_HOST \"cd $PROJECT_DIR && docker compose restart\"'
"

echo "🎉 全部完成！"
