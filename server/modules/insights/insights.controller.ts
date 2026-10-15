import { Controller, Get, Req } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { InsightsService } from './insights.service';

@NeedLogin()
@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('summary')
  getSummary(@Req() req: { userContext: { userId: string } }) {
    return this.insightsService.getSummary(req.userContext.userId);
  }
}
