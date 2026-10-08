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
import { TasksService, type TaskStatsSummary } from './tasks.service';
import { CreateTaskDtoClass, UpdateTaskDtoClass } from './tasks.dto';
import type {
  LifeTask,
  CreateTaskDto,
  UpdateTaskDto,
  ListResponse,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('focus-stats')
  async getFocusStats(): Promise<Record<string, { count: number; minutes: number }>> {
    return this.tasksService.getFocusStats();
  }

  @Get('stats/summary')
  async getStatsSummary(): Promise<TaskStatsSummary> {
    return this.tasksService.getStatsSummary();
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('quadrant') quadrant?: string,
    @Query('project') project?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ListResponse<LifeTask>> {
    return this.tasksService.findAll({
      status,
      priority,
      quadrant,
      project,
      search,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LifeTask> {
    return this.tasksService.findOne(id);
  }

  @Post()
  async create(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateTaskDtoClass,
  ): Promise<LifeTask> {
    const { userId } = req.userContext;
    return this.tasksService.create(dto as CreateTaskDto, userId);
  }

  @Patch(':id')
  async update(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDtoClass,
  ): Promise<LifeTask> {
    const { userId } = req.userContext;
    return this.tasksService.update(id, dto as UpdateTaskDto, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.tasksService.remove(id);
  }
}

