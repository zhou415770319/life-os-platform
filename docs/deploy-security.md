# 公网部署安全加固指南

Life-OS 已内置的核心安全能力（代码层面）：
- 全站强制登录（全局 AuthGuard，HMAC token + 角色分级 admin/user）
- 登录限流（用户系统与儿童电视：同 IP 5 次失败锁 15 分钟；全局限流 300 次/分）
- 安全响应头 + CORS 白名单
- 日志不记录请求/响应 body（防密码、API Key 泄露）

以下为**部署层面**仍需完成的加固项。

## 1. 入口必须加 Basic Auth（强烈建议，公网必做）

即使已有用户登录，公网入口仍建议加一层 Basic Auth，屏蔽未授权访问者探测：
- 防止未登录页（登录页、静态资源）被随意访问
- 防止 child-tv 免登录接口（watch-status/usage）被扫描

### Nginx 反代示例

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（必配，Basic Auth + HTTP 明文密码不安全）
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # 整站 Basic Auth（生成：openssl passwd -apr1 你的密码）
    auth_basic "Life-OS";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:5180;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        # WebSocket（AI 聊天流式输出用）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
```

生成 `.htpasswd`：
```bash
htpasswd -c /etc/nginx/.htpasswd lifeos
# 或手动：echo "lifeos:$(openssl passwd -apr1 '你的强密码')" > /etc/nginx/.htpasswd
```

### Caddy 反代示例（自动 HTTPS）

```caddy
your-domain.com {
    basicauth {
        lifeos $2y$05$...  # caddy hash-password 生成
    }
    reverse_proxy 127.0.0.1:5180
}
```

### 内网穿透工具（frp / ngrok / cpolar 等）

穿透工具通常不带鉴权。两个选择：
1. 优先选支持「访问密码 / Token」的穿透服务，开启密码访问；
2. 若工具不支持，改用上述 Nginx/Caddy 方案（穿透指向本机 80 端口，由反代加 Basic Auth 后转发 5180）。

## 2. 部署 Checklist

- [ ] 使用生产构建启动（`npm run start:prod`），不要用 vite dev server 对外
- [ ] 入口加 Basic Auth（见上）
- [ ] 使用 HTTPS（穿透/反代必须，避免 token 明文传输）
- [ ] `.env` 中 `CORS_ORIGINS` 填入页面真实域名（穿透域名），删除多余来源
- [ ] `.env` 中 `SERVER_HOST` 设为 `127.0.0.1`（穿透指向本机时）
- [ ] child-tv 控制台修改默认密码（启动日志若提示"仍在使用默认密码 123456"必须立即修改）
- [ ] 若启用在线数据库，`DATABASE_URL` 使用强口令
- [ ] 定期备份 `user-data/` 目录（用户、插件、业务数据全在此）

## 3. 已知安全边界（业务设计如此，接受即可）

- `GET /api/child-tv/watch-status`、`GET /api/child-tv/usage` 免登录（儿童观看页只读）
- `/api/auth/register` 仅系统无用户时可调用（首用户注册制，之后自动关闭）
- 本地 JSON 存储为单份共享数据，无用户级隔离——公网请只信任管理员一人使用
