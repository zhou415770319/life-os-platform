import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { HealthService } from './health.service';
import {
  CreateHealthRecordDtoClass,
  UpdateHealthRecordDtoClass,
} from './health.dto';
import type {
  HealthRecord,
  HealthRecordType,
  HealthSummary,
  HealthMetrics,
  ListResponse,
} from '@shared/api.interface';

interface CreateHealthRecordDto {
  recordType: HealthRecordType;
  recordDate: string;
  metrics?: HealthMetrics;
  note?: string;
}

interface UpdateHealthRecordDto {
  recordType?: HealthRecordType;
  recordDate?: string;
  metrics?: HealthMetrics;
  note?: string;
}

@NeedLogin()
@Controller('api/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('records')
  async findRecords(
    @Query('recordType') recordType?: HealthRecordType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ListResponse<HealthRecord>> {
    return this.healthService.findRecords({
      recordType,
      startDate,
      endDate,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
    });
  }

  @Get('records/:id')
  async findOne(@Param('id') id: string): Promise<HealthRecord> {
    return this.healthService.findOne(id);
  }

  @Post('records')
  async create(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateHealthRecordDtoClass,
  ): Promise<HealthRecord> {
    const { userId } = req.userContext;
    return this.healthService.create(dto as CreateHealthRecordDto, userId);
  }

  @Patch('records/:id')
  async update(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateHealthRecordDtoClass,
  ): Promise<HealthRecord> {
    const { userId } = req.userContext;
    return this.healthService.update(id, dto as UpdateHealthRecordDto, userId);
  }

  @Delete('records/:id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.healthService.remove(id);
  }

  @Get('summary')
  async getSummary(
    @Query('days') days = '7',
  ): Promise<HealthSummary> {
    const parsedDays = parseInt(days, 10) || 7;
    const clampedDays = Math.min(Math.max(parsedDays, 1), 30);
    return this.healthService.getSummary(clampedDays);
  }
}

