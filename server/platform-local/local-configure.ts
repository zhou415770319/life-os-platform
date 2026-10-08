import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { LocalUserContextMiddleware } from './local-context.middleware';

/**
 * 本地模式应用配置（替代平台 configureApp）
 * 提供：JSON/URL-encoded body 解析、CORS、本地用户上下文注入。
 * 不连接任何平台服务，无需登录态。
 */
export async function configureAppLocal(app: NestExpressApplication): Promise<void> {
  // body 解析
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS：本地开发放行
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 注入本地用户上下文（req.userContext.userId）
  const middleware = new LocalUserContextMiddleware();
  app.use((req, res, next) => middleware.use(req, res, next));
}
