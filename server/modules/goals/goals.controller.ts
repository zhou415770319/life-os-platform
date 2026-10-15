import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { GoalsService } from './goals.service';
import { CreateGoalDtoClass, UpdateGoalDtoClass } from './goals.dto';
import type { LifeGoal, ListResponse } from '@shared/api.interface';

@NeedLogin()
@Controller('api/goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  private uid(req: { userContext: { userId: string } }): string {
    return req.userContext.userId;
  }

  @Get()
  async findAll(
    @Req() req: { userContext: { userId: string } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponse<LifeGoal>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.goalsService.findAll(this.uid(req), pageNum, pageSizeNum);
  }

  @Get(':id')
  async findOne(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<LifeGoal> {
    return this.goalsService.findOne(id, this.uid(req));
  }

  @Post()
  async create(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateGoalDtoClass,
  ): Promise<LifeGoal> {
    return this.goalsService.create(dto, this.uid(req));
  }

  @Patch(':id')
  async update(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateGoalDtoClass,
  ): Promise<LifeGoal> {
    return this.goalsService.update(id, dto, this.uid(req));
  }

  @Delete(':id')
  async remove(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.goalsService.remove(id, this.uid(req));
    return { success: true };
  }
}
