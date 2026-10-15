import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { NeedLogin } from '../../platform-local/need-login';
import { AiChatService } from './ai-chat.service';
import type {
  AiChatRequest,
  AiChatResponse,
  PluginMethod,
  ListResponse,
  AiChatSession,
  AiChatSessionMessage,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Get('methods')
  async getMethods(): Promise<ListResponse<PluginMethod>> {
    return this.aiChatService.getMethods();
  }

  /** AI 深度助手：实时数据快照（前端展示参考面板，按当前用户） */
  @Get('context')
  async getDeepContext(@Req() req: { userContext: { userId: string } }) {
    return this.aiChatService.buildDataSnapshot(req.userContext.userId);
  }

  /** AI 长期记忆 */
  @Get('memory')
  async listMemory(): Promise<ListResponse<import('@shared/api.interface').AiMemoryItem>> {
    return this.aiChatService.listMemories();
  }

  @Post('memory')
  async addMemory(
    @Body() body: { content: string; category?: import('@shared/api.interface').AiMemoryItem['category'] },
  ): Promise<import('@shared/api.interface').AiMemoryItem> {
    return this.aiChatService.addMemory(body.content, body.category);
  }

  @Delete('memory/:id')
  async deleteMemory(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.aiChatService.deleteMemory(id);
  }

  @Get('sessions')
  async listSessions(
    @Req() req: { userContext: { userId: string } },
  ): Promise<ListResponse<AiChatSession>> {
    const { userId } = req.userContext;
    return this.aiChatService.listSessions(userId);
  }

  @Post('sessions')
  async createSession(
    @Req() req: { userContext: { userId: string } },
    @Body() body: { title?: string },
  ): Promise<AiChatSession> {
    const { userId } = req.userContext;
    return this.aiChatService.createSession(userId, body.title);
  }

  @Post('chat')
  async chat(
    @Req() req: { userContext: { userId: string } } & Request,
    @Res() res: Response,
    @Body() body: AiChatRequest,
  ): Promise<void> {
    const { userId } = req.userContext;

    // 前端停止生成（abort 请求）时，中断后端 AI 调用，历史保存「已停止生成」而非完整回复
    const abortController = new AbortController();
    const onAbort = () => abortController.abort();
    req.on('aborted', onAbort);
    res.on('close', () => {
      if (!res.writableEnded) onAbort();
      req.off('aborted', onAbort);
    });

    const result = await this.aiChatService.chat(body, userId, abortController.signal);
    res.json(result);
  }

  @Get('sessions/:id')
  async getSessionMessages(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ items: AiChatSessionMessage[] }> {
    const { userId } = req.userContext;
    const items = await this.aiChatService.getSessionMessages(id, userId);
    return { items };
  }

  @Patch('sessions/:id')
  async updateSessionTitle(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() body: { title: string },
  ): Promise<void> {
    const { userId } = req.userContext;
    await this.aiChatService.updateSessionTitle(id, body.title, userId);
  }

  @Delete('sessions/:id')
  async deleteSession(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<void> {
    const { userId } = req.userContext;
    await this.aiChatService.deleteSession(id, userId);
  }
}

