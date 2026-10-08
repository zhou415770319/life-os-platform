import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { LocalCapabilityService } from './local-capability.service';
import { AiSettingsModule } from '../modules/ai-settings/ai-settings.module';

/**
 * 本地模式平台模块（替代 @lark-apaas/fullstack-nestjs-core 的 PlatformModule）
 * 仅提供本地运行所需的基础能力，不连接任何平台服务：
 *   - ConfigModule：加载 .env.local / .env
 *   - HttpModule：通用 HTTP 客户端
 *   - LocalCapabilityService：本地 AI 能力服务（无用户 Key 时的默认通道）
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    HttpModule.register({ timeout: 5000, maxRedirects: 5 }),
    AiSettingsModule,
  ],
  providers: [LocalCapabilityService],
  exports: [LocalCapabilityService],
})
export class LocalPlatformModule {}
