import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY, ROLES_KEY } from './roles.decorator';
import { UserRole } from './user-store.interface';

/** 登录接口、儿童电视（独立 child_tv_token 认证体系）、其余全部 /api 需登录 */
const PUBLIC_PREFIXES: string[] = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/auth/bootstrap',
  // child-tv 走自身 HMAC token 认证（child_tv_token），家长/儿童独立账号体系
  '/api/child-tv',
  // 插件 bundle（script 标签加载无法带 Authorization 头），公开静态 JS，放行
  '/api/market/serve',
];

/**
 * 全局认证守卫（核心，不可绕过）：
 * - 非 /api 路径（静态资源）直接放行
 * - 白名单接口放行
 * - 其余：校验 Bearer token（HMAC 签名 + 过期），注入 req.userContext.{userId, role}
 * - 接口标了 @Roles 时校验角色
 * - 401 响应带 x-login-url 头，前端自动跳登录页
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const path: string = req.path ?? req.url ?? '';

    // 静态资源 / 非 API 路径放行
    if (!path.startsWith('/api')) return true;

    // 公开白名单
    if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
      return true;
    }

    // 显式 @Public 标记
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    if (isPublic) return true;

    // token 校验
    const token = this.extractToken(req);
    const resolved = this.authService.resolveByToken(token);
    if (!resolved) {
      res.setHeader('x-login-url', '/login');
      throw new UnauthorizedException('请先登录');
    }

    // 注入用户上下文（覆盖中间件默认 local-user）
    req.userContext = {
      userId: resolved.user.id,
      username: resolved.user.username,
      role: resolved.user.role,
    };

    // 角色校验
    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredRoles.length > 0 && !requiredRoles.includes(resolved.user.role)) {
      throw new ForbiddenException('该操作需要更高权限');
    }

    return true;
  }

  private extractToken(req: Request): string | null {
    const h = req.headers ?? {};
    const auth = h.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
    const cookie = h.cookie;
    if (typeof cookie === 'string') {
      const m = cookie.match(/(?:^|;\s*)life_os_token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
    return null;
  }
}
