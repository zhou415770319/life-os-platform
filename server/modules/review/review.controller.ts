import { Body, Controller, Get, Post } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { ReviewService, type ReviewSettings, type ReviewType } from './review.service';

@NeedLogin()
@Controller('api/review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /** 今日复盘状态（是否已生成 / 是否到提醒时间） */
  @Get('today')
  getToday() {
    return this.reviewService.getToday();
  }

  /** 生成复盘 */
  @Post('generate')
  generate(@Body() body: { type?: ReviewType; date?: string }) {
    const type: ReviewType = body?.type === 'weekly' ? 'weekly' : 'daily';
    return this.reviewService.generate(type, body?.date);
  }

  /** 历史复盘列表 */
  @Get('list')
  list() {
    return this.reviewService.list();
  }

  /** 提醒设置 */
  @Get('settings')
  getSettings() {
    return this.reviewService.getSettings();
  }

  @Post('settings')
  saveSettings(@Body() body: Partial<ReviewSettings>) {
    return this.reviewService.saveSettings(body ?? {});
  }
}
