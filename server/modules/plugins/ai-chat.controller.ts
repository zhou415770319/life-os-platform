import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
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

  /** AI 深度助手：实时数据快照（前端展示参考面板） */
  @Get('context')
  async getDeepContext() {
    return this.aiChatService.buildDataSnapshot();
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
    @Req() req: { userContext: { userId: string } },
    @Body() body: AiChatRequest,
  ): Promise<AiChatResponse> {
    const { userId } = req.userContext;
    return this.aiChatService.chat(body, userId);
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

