import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { InviteCodeStore } from './invite-code.store';
import { LocalUserStore } from './local-user.store';

/**
 * 用户系统模块（核心实现，不使用插件）：
 * - LocalUserStore：本地 JSON（user-data/users.json），后期可替换为飞书多维表格 / 数据库
 * - InviteCodeStore：邀请码（user-data/invite-codes.json），管理员生成、凭码注册
 * - AuthService：scrypt 密码哈希 + HMAC token + 登录限流 + 首用户注册制（之后凭邀请码注册）
 * - AuthGuard：全局认证守卫（APP_GUARD），除白名单外所有 /api 需登录
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    LocalUserStore,
    InviteCodeStore,
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthService, LocalUserStore, InviteCodeStore],
})
export class AuthModule {}
