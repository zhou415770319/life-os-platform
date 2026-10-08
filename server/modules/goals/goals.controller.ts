import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { GoalsService } from './goals.service';
import { CreateGoalDtoClass, UpdateGoalDtoClass } from './goals.dto';
import type { LifeGoal, ListResponse } from '@shared/api.interface';

@NeedLogin()
@Controller('api/goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifeGoal>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.goalsService.findAll(pageNum, pageSizeNum);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LifeGoal> {
    return this.goalsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateGoalDtoClass): Promise<LifeGoal> {
    return this.goalsService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateGoalDtoClass): Promise<LifeGoal> {
    return this.goalsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.goalsService.remove(id);
    return { success: true };
  }
}

