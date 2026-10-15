import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AuthResult } from './auth.service';
import { Public, Roles } from './roles.decorator';
import { UserRole } from './user-store.interface';

export interface AuthMeResult {
  loggedIn: boolean;
  userId?: string;
  username?: string;
  role?: UserRole;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 注册：系统无用户时免邀请码（首用户自动成为管理员）；已初始化需管理员邀请码（新用户为普通角色） */
  @Public()
  @Post('register')
  register(
    @Body() dto: { username?: string; password?: string; inviteCode?: string },
  ): AuthResult {
    return this.authService.register(
      dto?.username ?? '',
      dto?.password ?? '',
      dto?.inviteCode,
    );
  }

  /** 登录 */
  @Public()
  @Post('login')
  login(
    @Body() dto: { username?: string; password?: string },
    @Req() req: Request,
  ): AuthResult {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
    return this.authService.login(dto?.username ?? '', dto?.password ?? '', ip);
  }

  /** 系统初始化状态（公开）：true=已有用户请登录，false=首次使用请注册管理员 */
  @Public()
  @Get('bootstrap')
  bootstrap(): { initialized: boolean } {
    return { initialized: this.authService.isInitialized() };
  }

  /** 当前登录态（带 token 时返回用户信息） */
  @Public()
  @Get('me')
  me(@Req() req: Request): AuthMeResult {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const resolved = this.authService.resolveByToken(token);
    if (!resolved) return { loggedIn: false };
    return {
      loggedIn: true,
      userId: resolved.user.id,
      username: resolved.user.username,
      role: resolved.user.role,
    };
  }

  // ==================== 邀请码管理（仅管理员） ====================

  /** 生成邀请码（默认 1 个 / 有效期 30 天） */
  @Roles('admin')
  @Post('invite-codes')
  createInviteCodes(
    @Req() req: Request,
    @Body() dto: { count?: number; days?: number },
  ) {
    const creatorId = req.userContext?.userId ?? 'system';
    return this.authService.createInviteCodes(creatorId, {
      count: dto?.count,
      days: dto?.days,
    });
  }

  /** 邀请码列表（含状态：未用/已用/已作废/过期） */
  @Roles('admin')
  @Get('invite-codes')
  listInviteCodes() {
    return this.authService.listInviteCodes();
  }

  /** 作废邀请码 */
  @Roles('admin')
  @Delete('invite-codes/:code')
  revokeInviteCode(@Param('code') code: string) {
    const ok = this.authService.revokeInviteCode(code);
    if (!ok) {
      return { success: false, message: '邀请码不存在' };
    }
    return { success: true };
  }
}
