# 五子棋前端 (Gomoku Frontend)

基于 Next.js 和 Canvas 的高自由度异步棋盘系统。

## 技术栈

- Next.js 14.2.5
- React 18.3.1
- TypeScript
- HTML5 Canvas

## 功能特性

- 15x15 标准五子棋棋盘
- Canvas 高性能渲染
- 异步落子与后端通信
- 实时胜负判定
- 黑白棋子交替下棋
- 渐变色棋子效果
- 星位标记

## 开发指南

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

前端将在 http://localhost:3000 启动。

### 构建生产版本

```bash
npm run build
npm start
```

## 后端集成

前端通过 API 代理与后端通信，后端需要在 `localhost:3000` 运行。

API 端点：
- `POST /api/game/move` - 提交落子

## 项目结构

```
frontend/
├── app/
│   ├── layout.tsx      # 根布局
│   ├── page.tsx        # 主页面
│   └── globals.css     # 全局样式
├── components/
│   └── GomokuBoard.tsx # 棋盘组件
├── package.json
├── tsconfig.json
└── next.config.js
```

## 游戏规则

- 黑子先行
- 五子连珠获胜
- 支持重新开始
