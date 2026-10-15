import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../modules/auth/user-store.interface';

/** 本地单用户模式的默认用户 ID；AuthGuard 会覆盖为真实登录用户 */
export const LOCAL_USER_ID = 'local-user';

export interface UserContext {
  userId: string;
  /** 登录用户名（AuthGuard 注入） */
  username?: string;
  /** 用户角色（AuthGuard 注入） */
  role?: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

@Injectable()
export class LocalUserContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // 安全：不再信任外部 X-User-Id 请求头（公网下可被任意伪造），统一由 AuthGuard 注入真实用户
    req.userContext = { userId: LOCAL_USER_ID };
    next();
  }
}
