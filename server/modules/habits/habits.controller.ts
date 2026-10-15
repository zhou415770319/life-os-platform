import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { HabitsService } from './habits.service';
import {
  CreateHabitDtoClass,
  UpdateHabitDtoClass,
  ToggleRecordDtoClass,
  CreateEnergyDtoClass,
} from './habits.dto';
import type {
  LifeHabit,
  HabitRecord,
  EnergyRecord,
  ListResponse,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  private uid(req: { userContext: { userId: string } }): string {
    return req.userContext.userId;
  }

  @Get()
  async findAll(
    @Req() req: { userContext: { userId: string } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifeHabit>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.habitsService.findAllHabits(this.uid(req), pageNum, pageSizeNum);
  }

  @Post()
  async create(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateHabitDtoClass,
  ): Promise<LifeHabit> {
    return this.habitsService.createHabit(dto, this.uid(req));
  }

  @Delete(':id')
  async remove(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.habitsService.deleteHabit(id, this.uid(req));
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateHabitDtoClass,
  ): Promise<LifeHabit> {
    return this.habitsService.updateHabit(id, dto, this.uid(req));
  }

  @Get('records')
  async getRecords(
    @Req() req: { userContext: { userId: string } },
    @Query('date') date: string,
  ): Promise<ListResponse<HabitRecord>> {
    return this.habitsService.getRecordsByDate(this.uid(req), date);
  }

  @Post('records/toggle')
  async toggleRecord(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: ToggleRecordDtoClass,
  ): Promise<HabitRecord> {
    return this.habitsService.toggleRecord(dto.habitId, dto.date, this.uid(req));
  }

  @Get('energy')
  async getEnergyRecords(
    @Req() req: { userContext: { userId: string } },
  ): Promise<ListResponse<EnergyRecord>> {
    return this.habitsService.getEnergyRecords(this.uid(req));
  }

  @Post('energy')
  async createEnergyRecord(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateEnergyDtoClass,
  ): Promise<EnergyRecord> {
    return this.habitsService.createEnergyRecord(dto, this.uid(req));
  }
}
