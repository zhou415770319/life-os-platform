import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * 安全加固中间件（免第三方依赖）：
 * 1. 安全响应头（helmet 等效核心项）
 * 2. 全局限流：每 IP 每 60 秒 N 次（防暴力破解 / 接口刷量）
 *    - 全局默认 300 次/分
 *    - /api/auth/*（登录/注册）更严格：10 次/分
 * 超限返回 429。
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  /** ipKey -> { hits: number[]（时间戳） } */
  private readonly buckets = new Map<string, number[]>();

  private readonly GLOBAL_LIMIT = 300;
  /**
   * 登录/注册：30 次/分。
   * 防暴力破解由 auth.service 的「连续失败 5 次锁 15 分钟」兜底，
   * 这里只防脚本高频刷量，30 次/分可避免正常用户输错几次密码就触发窗口限流。
   */
  private readonly AUTH_WRITE_LIMIT = 30;
  /** me/bootstrap 等只读高频接口：120 次/分（每个页面加载 AuthGate 都会调 me，HMR 刷新频繁） */
  private readonly AUTH_READ_LIMIT = 120;
  private readonly WINDOW_MS = 60_000;
  /** 防止 Map 无限增长：超过该大小清理一次 */
  private readonly MAX_BUCKETS = 10_000;

  use(req: Request, res: Response, next: NextFunction): void {
    // 1) 安全响应头
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 2) 限流（仅 /api 路径）
    const path: string = req.path ?? req.url ?? '';
    if (!path.startsWith('/api')) {
      next();
      return;
    }

    const ip = this.getClientIp(req);
    let limit = this.GLOBAL_LIMIT;
    if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register')) {
      limit = this.AUTH_WRITE_LIMIT;
    } else if (path.startsWith('/api/auth/')) {
      limit = this.AUTH_READ_LIMIT;
    }

    if (!this.hit(ip, limit)) {
      const retryAfter = this.retryAfterSeconds(ip);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        statusCode: 429,
        message: `请求过于频繁，请 ${retryAfter} 秒后再试`,
      });
      return;
    }

    next();
  }

  private getClientIp(req: Request): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
  }

  /** 窗口内最早一次命中距离现在还剩多少秒（下限 1 秒，上限 60 秒） */
  private retryAfterSeconds(ip: string): number {
    const arr = this.buckets.get(ip);
    if (!arr || arr.length === 0) return 60;
    const now = Date.now();
    const earliest = Math.min(...arr);
    const remainMs = this.WINDOW_MS - (now - earliest);
    return Math.max(1, Math.min(60, Math.ceil(remainMs / 1000)));
  }

  /** 记录一次命中；窗口内超过 limit 返回 false */
  private hit(ip: string, limit: number): boolean {
    if (this.buckets.size > this.MAX_BUCKETS) {
      this.buckets.clear();
      this.logger.warn('限流桶已满，已清空重建');
    }
    const now = Date.now();
    const cutoff = now - this.WINDOW_MS;
    const arr = (this.buckets.get(ip) ?? []).filter((t) => t > cutoff);
    if (arr.length >= limit) {
      this.buckets.set(ip, arr);
      return false;
    }
    arr.push(now);
    this.buckets.set(ip, arr);
    return true;
  }
}
