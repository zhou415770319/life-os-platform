import { Controller, Get, Req } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { DashboardService } from './dashboard.service';
import type { DashboardStats } from '@shared/api.interface';

@NeedLogin()
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(
    @Req() req: { userContext: { userId: string } },
  ): Promise<DashboardStats> {
    return this.dashboardService.getStats(req.userContext.userId);
  }
}
