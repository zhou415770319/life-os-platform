import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { LifeLogService } from './life-log.service';
import { CreateLifeLogDtoClass } from './life-log.dto';
import type {
  LifeLogEntry,
  LifeLogCategory,
  ListResponse,
} from '@shared/api.interface';

interface CategoryStat {
  category: string;
  count: number;
}

@NeedLogin()
@Controller('api/life-log')
export class LifeLogController {
  constructor(private readonly lifeLogService: LifeLogService) {}

  @Get('export')
  async exportAll(
    @Req() req: { userContext: { userId: string } },
  ): Promise<{
    data: LifeLogEntry[];
    exportTime: string;
    total: number;
  }> {
    return this.lifeLogService.exportAll(req.userContext.userId);
  }

  @Get('categories')
  async getCategories(
    @Req() req: { userContext: { userId: string } },
  ): Promise<CategoryStat[]> {
    return this.lifeLogService.getCategoryStats(req.userContext.userId);
  }

  @Get()
  async findAll(
    @Req() req: { userContext: { userId: string } },
    @Query('eventType') eventType?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ListResponse<LifeLogEntry>> {
    return this.lifeLogService.findAll({
      eventType,
      category,
      startDate,
      endDate,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
    }, req.userContext.userId);
  }

  @Get(':id')
  async findOne(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<LifeLogEntry> {
    return this.lifeLogService.findOne(id, req.userContext.userId);
  }

  @Post()
  async create(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateLifeLogDtoClass,
  ): Promise<LifeLogEntry> {
    return this.lifeLogService.append({
      eventType: dto.eventType,
      eventCategory: dto.eventCategory as LifeLogCategory,
      contentSummary: dto.contentSummary,
      metadata: dto.metadata,
    }, req.userContext.userId);
  }
}
