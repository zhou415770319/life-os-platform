import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { HabitsService } from './habits.service';
import {
  CreateHabitDtoClass,
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

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifeHabit>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.habitsService.findAllHabits(pageNum, pageSizeNum);
  }

  @Post()
  async create(@Body() dto: CreateHabitDtoClass): Promise<LifeHabit> {
    return this.habitsService.createHabit(dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.habitsService.deleteHabit(id);
    return { success: true };
  }

  @Get('records')
  async getRecords(@Query('date') date: string): Promise<ListResponse<HabitRecord>> {
    return this.habitsService.getRecordsByDate(date);
  }

  @Post('records/toggle')
  async toggleRecord(
    @Body() dto: ToggleRecordDtoClass,
  ): Promise<HabitRecord> {
    return this.habitsService.toggleRecord(dto.habitId, dto.date);
  }

  @Get('energy')
  async getEnergyRecords(): Promise<ListResponse<EnergyRecord>> {
    return this.habitsService.getEnergyRecords();
  }

  @Post('energy')
  async createEnergyRecord(@Body() dto: CreateEnergyDtoClass): Promise<EnergyRecord> {
    return this.habitsService.createEnergyRecord(dto);
  }
}

