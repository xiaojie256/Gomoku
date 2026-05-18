.PHONY: help local local-build local-down local-logs prod prod-build prod-down prod-logs db-init db-migrate ps clean

# 默认显示帮助
help:
	@echo ""
	@echo "五子棋 Gomoku — 常用命令"
	@echo "==========================================="
	@echo "本地开发 (docker-compose.local.yml)"
	@echo "  make local          启动所有本地服务（后台）"
	@echo "  make local-build    强制重新构建并启动"
	@echo "  make local-down     停止并移除本地容器"
	@echo "  make local-logs     查看本地日志"
	@echo ""
	@echo "生产部署 (docker-compose.yml)"
	@echo "  make prod           启动所有生产服务（后台）"
	@echo "  make prod-build     强制重新构建并启动"
	@echo "  make prod-down      停止并移除生产容器"
	@echo "  make prod-logs      查看生产日志"
	@echo ""
	@echo "数据库"
	@echo "  make db-migrate     运行 Prisma migrate deploy（生产迁移）"
	@echo "  make db-studio      打开 Prisma Studio 数据库可视化"
	@echo "  make admin-create   创建/更新管理员账号"
	@echo ""
	@echo "其他"
	@echo "  make ps             查看所有运行中的容器"
	@echo "  make clean          清理所有容器 + 本地卷（危险！）"
	@echo ""

# ---- 本地 ----
local:
	docker compose -f docker-compose.local.yml up -d

local-build:
	docker compose -f docker-compose.local.yml up -d --build

local-down:
	docker compose -f docker-compose.local.yml down

local-logs:
	docker compose -f docker-compose.local.yml logs -f

# ---- 生产 ----
prod:
	docker compose -f docker-compose.yml up -d

prod-build:
	docker compose -f docker-compose.yml up -d --build

prod-down:
	docker compose -f docker-compose.yml down

prod-logs:
	docker compose -f docker-compose.yml logs -f

# ---- 数据库 ----
db-migrate:
	docker compose -f docker-compose.local.yml exec backend npx prisma migrate deploy

db-studio:
	npx prisma studio --schema=backend/prisma/schema.prisma

admin-create:
	docker compose -f docker-compose.local.yml exec backend node scripts/create_admin.js

deploy:
	bash backend/scripts/deploy.sh

# ---- 其他 ----
ps:
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

clean:
	@echo "⚠️  此操作将删除所有容器和本地数据卷，按 Ctrl+C 取消..."
	@sleep 3
	docker compose -f docker-compose.local.yml down -v
	docker compose -f docker-compose.yml down -v
