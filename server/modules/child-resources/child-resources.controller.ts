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
import { ChildResourcesService } from './child-resources.service';
import {
  CreateChildResourceDtoClass,
  UpdateChildResourceDtoClass,
} from './child-resources.dto';
import type {
  ChildResource,
  CreateChildResourceDto,
  UpdateChildResourceDto,
  ListResponse,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/child-resources')
export class ChildResourcesController {
  constructor(private readonly childResourcesService: ChildResourcesService) {}

  @Get('categories/list')
  async getCategories(): Promise<{ items: string[] }> {
    return this.childResourcesService.getCategories();
  }

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('resourceType') resourceType?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ListResponse<ChildResource>> {
    return this.childResourcesService.findAll({
      category,
      search,
      resourceType,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ChildResource> {
    return this.childResourcesService.findOne(id);
  }

  @Post()
  async create(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateChildResourceDtoClass,
  ): Promise<ChildResource> {
    const { userId } = req.userContext;
    return this.childResourcesService.create(dto as CreateChildResourceDto, userId);
  }

  @Patch(':id')
  async update(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateChildResourceDtoClass,
  ): Promise<ChildResource> {
    const { userId } = req.userContext;
    return this.childResourcesService.update(id, dto as UpdateChildResourceDto, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.childResourcesService.remove(id);
  }
}

