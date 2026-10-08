import { Controller, Get, Render, Req } from '@nestjs/common';
import type { Request } from 'express';

interface PlatformRenderData {
  __platform_data__?: Record<string, unknown>;
}

@Controller()
export class ViewController {
  @Get(['/', '*'])
  @Render('index')
  async render(@Req() req: Request): Promise<{ __platform__: string }> {
    // 本地模式无平台信息，注入最小可用结构；后续迁移数据库可扩展
    const platformData = (req as Request & PlatformRenderData).__platform_data__ ?? {
      userId: (req as Request & { userContext?: { userId?: string } }).userContext?.userId ?? '',
    };
    return {
      // don't delete this line, it's used by client to get platform info
      __platform__: JSON.stringify(platformData),
    };
  }
}
