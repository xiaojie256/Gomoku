# Nginx WebSocket 配置指南

由于引入了 Socket.io WebSocket 支持，必须在宝塔面板的 Nginx 代理设置中添加 WebSocket 支持。

## 配置步骤

1. 登录宝塔面板
2. 点击 **网站** -> 找到你的项目域名（如 move.xiaojie256.top）-> 点击 **设置**
3. 找到左侧的 **反向代理** 设置
4. 点击你原有代理的 **配置文件**
5. 在 `location /` 块中，添加以下 WebSocket 支持配置：

```nginx
location / {
    proxy_pass http://127.0.0.1:你的后端端口;
    
    # --- WebSocket 支持配置（必须添加）---
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400; # 防止长连接自动断开
    # --------------------------------------
    
    # 保留原有的头信息
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 完整配置示例

假设你的后端端口是 4125，完整的 location 块应该如下：

```nginx
location / {
    proxy_pass http://127.0.0.1:4125;
    
    # WebSocket 支持
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
    
    # 标准代理头
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 重要说明

- `proxy_http_version 1.1`：WebSocket 需要 HTTP/1.1 协议
- `proxy_set_header Upgrade $http_upgrade`：允许协议升级
- `proxy_set_header Connection "upgrade"`：告知 Nginx 这是一个升级连接
- `proxy_read_timeout 86400`：设置超时时间为 24 小时，防止长连接被断开

## 配置完成后

1. 点击 **保存**
2. 重启 Nginx 服务（宝塔面板会自动处理）
3. 在服务器上执行部署命令：

```bash
cd /www/wwwroot/Gomoku
docker-compose up -d --build
```

## 验证 WebSocket 连接

部署完成后，打开浏览器开发者工具（F12）-> Network 标签：
- 应该能看到一个状态为 `101 Switching Protocols` 的 WebSocket 连接
- 不再有每 6 秒一次的轮询请求
- 对手落子时，棋盘会实时更新
