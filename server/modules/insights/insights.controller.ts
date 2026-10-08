import { Controller, Get } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { InsightsService } from './insights.service';

@NeedLogin()
@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('summary')
  getSummary() {
    return this.insightsService.getSummary();
  }
}
