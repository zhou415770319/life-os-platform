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
import { FinanceService } from './finance.service';
import {
  CreateAccountDtoClass,
  UpdateAccountDtoClass,
  CreateTransactionDtoClass,
  UpdateTransactionDtoClass,
  CreateBudgetDtoClass,
  UpdateBudgetDtoClass,
} from './finance.dto';
import type {
  FinanceAccount,
  FinanceTransaction,
  FinanceBudget,
  FinanceSummary,
  ListResponse,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  private uid(req: { userContext: { userId: string } }): string {
    return req.userContext.userId;
  }

  // ===== Accounts =====

  @Get('accounts')
  async getAccounts(
    @Req() req: { userContext: { userId: string } },
  ): Promise<FinanceAccount[]> {
    return this.financeService.getAccounts(this.uid(req));
  }

  @Post('accounts')
  async createAccount(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateAccountDtoClass,
  ): Promise<FinanceAccount> {
    const { userId } = req.userContext;
    return this.financeService.createAccount(dto, userId);
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAccountDtoClass,
  ): Promise<FinanceAccount> {
    const { userId } = req.userContext;
    return this.financeService.updateAccount(id, dto, userId);
  }

  @Delete('accounts/:id')
  async deleteAccount(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.financeService.deleteAccount(id, this.uid(req));
  }

  // ===== Transactions =====

  @Get('transactions')
  async getTransactions(
    @Req() req: { userContext: { userId: string } },
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('accountId') accountId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ListResponse<FinanceTransaction>> {
    return this.financeService.getTransactions(
      {
        type,
        category,
        accountId,
        startDate,
        endDate,
        page: parseInt(page, 10) || 1,
        pageSize: parseInt(pageSize, 10) || 20,
      },
      this.uid(req),
    );
  }

  @Get('transactions/:id')
  async getTransaction(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<FinanceTransaction> {
    return this.financeService.getTransaction(id, this.uid(req));
  }

  @Post('transactions')
  async createTransaction(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateTransactionDtoClass,
  ): Promise<FinanceTransaction> {
    const { userId } = req.userContext;
    return this.financeService.createTransaction(dto, userId);
  }

  @Patch('transactions/:id')
  async updateTransaction(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDtoClass,
  ): Promise<FinanceTransaction> {
    const { userId } = req.userContext;
    return this.financeService.updateTransaction(id, dto, userId);
  }

  @Delete('transactions/:id')
  async deleteTransaction(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.financeService.deleteTransaction(id, this.uid(req));
  }

  // ===== Budgets =====

  @Get('budgets')
  async getBudgets(
    @Req() req: { userContext: { userId: string } },
  ): Promise<FinanceBudget[]> {
    return this.financeService.getBudgets(this.uid(req));
  }

  @Post('budgets')
  async createBudget(
    @Req() req: { userContext: { userId: string } },
    @Body() dto: CreateBudgetDtoClass,
  ): Promise<FinanceBudget> {
    const { userId } = req.userContext;
    return this.financeService.createBudget(dto, userId);
  }

  @Patch('budgets/:id')
  async updateBudget(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDtoClass,
  ): Promise<FinanceBudget> {
    const { userId } = req.userContext;
    return this.financeService.updateBudget(id, dto, userId);
  }

  @Delete('budgets/:id')
  async deleteBudget(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.financeService.deleteBudget(id, this.uid(req));
  }

  // ===== Summary =====

  @Get('summary')
  async getSummary(
    @Req() req: { userContext: { userId: string } },
    @Query('month') month?: string,
  ): Promise<FinanceSummary> {
    // 默认当月
    let targetMonth = month;
    if (!targetMonth) {
      const now = new Date();
      targetMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    return this.financeService.getSummary(targetMonth, this.uid(req));
  }
}
