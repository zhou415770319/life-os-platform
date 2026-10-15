import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { NotesService } from './notes.service';
import {
  CreateNoteDtoClass,
  UpdateNoteDtoClass,
  CreatePrincipleDtoClass,
  CreateQuickLinkDtoClass,
} from './notes.dto';
import type {
  LifeNote,
  LifePrinciple,
  QuickLink,
  ListResponse,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /** 当前登录用户 id（全局 AuthGuard 注入） */
  private uid(req: { userContext: { userId: string } }): string {
    return req.userContext.userId;
  }

  // Notes - static routes before dynamic

  @Get()
  async findAllNotes(
    @Req() req: { userContext: { userId: string } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifeNote>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.notesService.findAllNotes(this.uid(req), pageNum, pageSizeNum);
  }

  @Post()
  async createNote(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateNoteDtoClass,
  ): Promise<LifeNote> {
    return this.notesService.createNote(dto, this.uid(req));
  }

  // Principles - static sub-routes before :id

  @Get('principles')
  async findAllPrinciples(
    @Req() req: { userContext: { userId: string } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifePrinciple>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.notesService.findAllPrinciples(this.uid(req), pageNum, pageSizeNum);
  }

  @Post('principles')
  async createPrinciple(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreatePrincipleDtoClass,
  ): Promise<LifePrinciple> {
    return this.notesService.createPrinciple(dto, this.uid(req));
  }

  @Delete('principles/:id')
  async deletePrinciple(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.notesService.deletePrinciple(id, this.uid(req));
    return { success: true };
  }

  // Quick Links - static sub-routes before :id

  @Get('quick-links')
  async findAllQuickLinks(
    @Req() req: { userContext: { userId: string } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<QuickLink>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.notesService.findAllQuickLinks(this.uid(req), pageNum, pageSizeNum);
  }

  @Post('quick-links')
  async createQuickLink(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateQuickLinkDtoClass,
  ): Promise<QuickLink> {
    return this.notesService.createQuickLink(dto, this.uid(req));
  }

  @Delete('quick-links/:id')
  async deleteQuickLink(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.notesService.deleteQuickLink(id, this.uid(req));
    return { success: true };
  }

  // Note dynamic routes (must come after static sub-routes)

  @Patch(':id')
  async updateNote(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateNoteDtoClass,
  ): Promise<LifeNote> {
    return this.notesService.updateNote(id, dto, this.uid(req));
  }

  @Delete(':id')
  async deleteNote(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.notesService.deleteNote(id, this.uid(req));
    return { success: true };
  }
}
