import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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

  // Notes - static routes before dynamic
  @Get()
  async findAllNotes(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifeNote>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.notesService.findAllNotes(pageNum, pageSizeNum);
  }

  @Post()
  async createNote(@Body() dto: CreateNoteDtoClass): Promise<LifeNote> {
    return this.notesService.createNote(dto);
  }

  // Principles - static sub-routes before :id
  @Get('principles')
  async findAllPrinciples(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifePrinciple>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.notesService.findAllPrinciples(pageNum, pageSizeNum);
  }

  @Post('principles')
  async createPrinciple(
    @Body() dto: CreatePrincipleDtoClass,
  ): Promise<LifePrinciple> {
    return this.notesService.createPrinciple(dto);
  }

  @Delete('principles/:id')
  async deletePrinciple(
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.notesService.deletePrinciple(id);
    return { success: true };
  }

  // Quick Links - static sub-routes before :id
  @Get('quick-links')
  async findAllQuickLinks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<QuickLink>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.notesService.findAllQuickLinks(pageNum, pageSizeNum);
  }

  @Post('quick-links')
  async createQuickLink(@Body() dto: CreateQuickLinkDtoClass): Promise<QuickLink> {
    return this.notesService.createQuickLink(dto);
  }

  @Delete('quick-links/:id')
  async deleteQuickLink(
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.notesService.deleteQuickLink(id);
    return { success: true };
  }

  // Note dynamic routes (must come after static sub-routes)
  @Patch(':id')
  async updateNote(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDtoClass,
  ): Promise<LifeNote> {
    return this.notesService.updateNote(id, dto);
  }

  @Delete(':id')
  async deleteNote(@Param('id') id: string): Promise<{ success: true }> {
    await this.notesService.deleteNote(id);
    return { success: true };
  }
}

