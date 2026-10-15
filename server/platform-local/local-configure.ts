import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { LocalUserContextMiddleware } from './local-context.middleware';
import { SecurityMiddleware } from './security';

/**
 * 本地模式应用配置（替代平台 configureApp）
 * 提供：JSON/URL-encoded body 解析、CORS 白名单、安全响应头、全局限流、本地用户上下文注入。
 */
export async function configureAppLocal(app: NestExpressApplication): Promise<void> {
  // body 解析
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS：白名单收紧。来源从 .env CORS_ORIGINS 读取（逗号分隔），未配置时仅放行本地开发地址。
  // 生产（内网穿透/公网）必须在 .env 中显式配置允许的来源（如穿透域名），否则跨源请求会被拒绝。
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0
      ? corsOrigins
      : ['http://localhost:5180', 'http://127.0.0.1:5180'],
    credentials: true,
  });

  // 安全响应头 + 全局限流
  const security = new SecurityMiddleware();
  app.use((req, res, next) => security.use(req, res, next));

  // 注入本地用户上下文（req.userContext.userId；真实身份由全局 AuthGuard 覆盖）
  const middleware = new LocalUserContextMiddleware();
  app.use((req, res, next) => middleware.use(req, res, next));
}
