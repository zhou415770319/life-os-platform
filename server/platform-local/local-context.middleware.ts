import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/** 本地单用户模式的默认用户 ID；迁移到数据库后按 userId 隔离多用户 */
export const LOCAL_USER_ID = 'local-user';

interface UserContext {
  userId: string;
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
    const headerUserId = req.headers['x-user-id'];
    req.userContext = {
      userId:
        typeof headerUserId === 'string' && headerUserId.trim()
          ? headerUserId.trim()
          : LOCAL_USER_ID,
    };
    next();
  }
}
