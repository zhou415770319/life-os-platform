import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import {
  lifeFinanceAccounts,
  lifeFinanceTransactions,
  lifeFinanceBudgets,
} from '@server/database/schema';
import type {
  FinanceAccount,
  FinanceTransaction,
  FinanceBudget,
  FinanceSummary,
  ListResponse,
  AccountType,
  TransactionType,
} from '@shared/api.interface';

interface TransactionListQuery {
  type?: string;
  category?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

type AccountRow = typeof lifeFinanceAccounts.$inferSelect;
type TransactionRow = typeof lifeFinanceTransactions.$inferSelect;
type BudgetRow = typeof lifeFinanceBudgets.$inferSelect;

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  // ===== Mappers =====

  private mapAccount(row: AccountRow): FinanceAccount {
    return {
      id: row.id,
      name: row.name,
      type: row.type as AccountType,
      balance: Number(row.balance),
      currency: row.currency,
      color: row.color ?? null,
      icon: row.icon ?? null,
      note: row.note ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapTransaction(row: TransactionRow): FinanceTransaction {
    return {
      id: row.id,
      type: row.type as TransactionType,
      amount: Number(row.amount),
      category: row.category,
      subcategory: row.subcategory ?? null,
      accountId: row.accountId ?? null,
      targetAccountId: row.targetAccountId ?? null,
      note: row.note ?? null,
      transactionDate: row.transactionDate,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapBudget(row: BudgetRow): FinanceBudget {
    return {
      id: row.id,
      category: row.category,
      amount: Number(row.amount),
      period: row.period as FinanceBudget['period'],
      periodKey: row.periodKey,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ===== Account balance helpers =====

  private async adjustBalance(
    tx: LocalDatabase,
    accountId: string,
    delta: number,
  ): Promise<void> {
    if (delta === 0) return;
    const result = await tx
      .update(lifeFinanceAccounts)
      .set({
        balance: sql`${lifeFinanceAccounts.balance} + ${delta}`,
      })
      .where(eq(lifeFinanceAccounts.id, accountId))
      .returning({ id: lifeFinanceAccounts.id });

    if (result.length === 0) {
      throw new NotFoundException(`账户不存在: ${accountId}`);
    }
  }

  private async applyTransactionBalance(
    tx: LocalDatabase,
    type: TransactionType,
    amount: number,
    accountId: string | null,
    targetAccountId: string | null,
  ): Promise<void> {
    if (type === 'expense' && accountId) {
      await this.adjustBalance(tx, accountId, -amount);
    } else if (type === 'income' && accountId) {
      await this.adjustBalance(tx, accountId, amount);
    } else if (type === 'transfer') {
      if (!accountId || !targetAccountId) {
        throw new BadRequestException('转账交易必须同时提供 accountId 和 targetAccountId');
      }
      await this.adjustBalance(tx, accountId, -amount);
      await this.adjustBalance(tx, targetAccountId, amount);
    }
  }

  private async reverseTransactionBalance(
    tx: LocalDatabase,
    row: TransactionRow,
  ): Promise<void> {
    const type = row.type as TransactionType;
    const amount = Number(row.amount);
    // 反向操作：expense 变加回去，income 变减回来，transfer 方向互换
    if (type === 'expense' && row.accountId) {
      await this.adjustBalance(tx, row.accountId, amount);
    } else if (type === 'income' && row.accountId) {
      await this.adjustBalance(tx, row.accountId, -amount);
    } else if (type === 'transfer') {
      if (row.accountId) {
        await this.adjustBalance(tx, row.accountId, amount);
      }
      if (row.targetAccountId) {
        await this.adjustBalance(tx, row.targetAccountId, -amount);
      }
    }
  }

  // ===== Accounts =====

  async getAccounts(): Promise<FinanceAccount[]> {
    const rows = await this.db
      .select()
      .from(lifeFinanceAccounts)
      .orderBy(desc(lifeFinanceAccounts.createdAt));

    return rows.map((row) => this.mapAccount(row));
  }

  async createAccount(dto: {
    name: string;
    type: string;
    balance?: number;
    currency?: string;
    color?: string | null;
    icon?: string | null;
    note?: string | null;
  }, userId: string): Promise<FinanceAccount> {
    const [row] = await this.db
      .insert(lifeFinanceAccounts)
      .values({
        name: dto.name,
        type: dto.type,
        balance: String(dto.balance ?? 0),
        currency: dto.currency ?? 'CNY',
        color: dto.color ?? null,
        icon: dto.icon ?? null,
        note: dto.note ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`Account created: ${row.id} (${row.name})`);
    return this.mapAccount(row);
  }

  async updateAccount(
    id: string,
    dto: Partial<{
      name: string;
      type: string;
      balance: number;
      currency: string;
      color: string | null;
      icon: string | null;
      note: string | null;
    }>,
    userId: string,
  ): Promise<FinanceAccount> {
    const patch: Partial<typeof lifeFinanceAccounts.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.balance !== undefined) patch.balance = String(dto.balance);
    if (dto.currency !== undefined) patch.currency = dto.currency;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.note !== undefined) patch.note = dto.note;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const [row] = await this.db
      .update(lifeFinanceAccounts)
      .set(patch)
      .where(eq(lifeFinanceAccounts.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('账户不存在');
    }

    this.logger.log(`Account updated: ${id}`);
    return this.mapAccount(row);
  }

  async deleteAccount(id: string): Promise<{ success: boolean }> {
    const deleted = await this.db
      .delete(lifeFinanceAccounts)
      .where(eq(lifeFinanceAccounts.id, id))
      .returning({ id: lifeFinanceAccounts.id });

    if (deleted.length === 0) {
      throw new NotFoundException('账户不存在');
    }

    this.logger.log(`Account deleted: ${id}`);
    return { success: true };
  }

  // ===== Transactions =====

  async getTransactions(query: TransactionListQuery): Promise<ListResponse<FinanceTransaction>> {
    const { type, category, accountId, startDate, endDate, page, pageSize } = query;

    const conditions = [];
    if (type) {
      conditions.push(eq(lifeFinanceTransactions.type, type));
    }
    if (category) {
      conditions.push(eq(lifeFinanceTransactions.category, category));
    }
    if (accountId) {
      conditions.push(
        sql`(${lifeFinanceTransactions.accountId} = ${accountId} OR ${lifeFinanceTransactions.targetAccountId} = ${accountId})`
      );
    }
    if (startDate) {
      conditions.push(gte(lifeFinanceTransactions.transactionDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(lifeFinanceTransactions.transactionDate, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(lifeFinanceTransactions)
        .where(whereClause),
      this.db
        .select()
        .from(lifeFinanceTransactions)
        .where(whereClause)
        .orderBy(
          desc(lifeFinanceTransactions.transactionDate),
          desc(lifeFinanceTransactions.createdAt),
        )
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: FinanceTransaction[] = rows.map((row) => this.mapTransaction(row));

    return { items, total };
  }

  async getTransaction(id: string): Promise<FinanceTransaction> {
    const rows = await this.db
      .select()
      .from(lifeFinanceTransactions)
      .where(eq(lifeFinanceTransactions.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('交易不存在');
    }

    return this.mapTransaction(rows[0]);
  }

  async createTransaction(dto: {
    type: string;
    amount: number;
    category: string;
    subcategory?: string;
    accountId?: string;
    targetAccountId?: string;
    note?: string;
    transactionDate?: string;
  }, userId: string): Promise<FinanceTransaction> {
    if (dto.amount <= 0) {
      throw new BadRequestException('交易金额必须大于 0');
    }

    const result = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(lifeFinanceTransactions)
        .values({
          type: dto.type,
          amount: String(dto.amount),
          category: dto.category,
          subcategory: dto.subcategory ?? null,
          accountId: dto.accountId ?? null,
          targetAccountId: dto.targetAccountId ?? null,
          note: dto.note ?? null,
          transactionDate: dto.transactionDate,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      await this.applyTransactionBalance(
        tx,
        row.type as TransactionType,
        Number(row.amount),
        row.accountId,
        row.targetAccountId,
      );

      return row;
    });

    this.logger.log(`Transaction created: ${result.id} (${result.type} ${result.amount})`);
    return this.mapTransaction(result);
  }

  async updateTransaction(
    id: string,
    dto: Partial<{
      type: string;
      amount: number;
      category: string;
      subcategory: string;
      accountId: string;
      targetAccountId: string;
      note: string;
      transactionDate: string;
    }>,
    userId: string,
  ): Promise<FinanceTransaction> {
    const patch: Partial<typeof lifeFinanceTransactions.$inferInsert> = {};
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.amount !== undefined) {
      if (dto.amount <= 0) throw new BadRequestException('交易金额必须大于 0');
      patch.amount = String(dto.amount);
    }
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.subcategory !== undefined) patch.subcategory = dto.subcategory;
    if (dto.accountId !== undefined) patch.accountId = dto.accountId;
    if (dto.targetAccountId !== undefined) patch.targetAccountId = dto.targetAccountId;
    if (dto.note !== undefined) patch.note = dto.note;
    if (dto.transactionDate !== undefined) patch.transactionDate = dto.transactionDate;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const needsBalanceUpdate =
      dto.type !== undefined ||
      dto.amount !== undefined ||
      dto.accountId !== undefined ||
      dto.targetAccountId !== undefined;

    let updatedRow: TransactionRow;

    if (needsBalanceUpdate) {
      updatedRow = await this.db.transaction(async (tx) => {
        // 1. 查询原交易
        const existing = await tx
          .select()
          .from(lifeFinanceTransactions)
          .where(eq(lifeFinanceTransactions.id, id))
          .limit(1);

        if (existing.length === 0) {
          throw new NotFoundException('交易不存在');
        }

        // 2. 反向冲销原交易对余额的影响
        await this.reverseTransactionBalance(tx, existing[0]);

        // 3. 应用更新
        patch.updatedAt = new Date();
        patch.updatedBy = userId;

        const [row] = await tx
          .update(lifeFinanceTransactions)
          .set(patch)
          .where(eq(lifeFinanceTransactions.id, id))
          .returning();

        if (!row) {
          throw new NotFoundException('交易不存在');
        }

        // 4. 应用新交易对余额的影响
        await this.applyTransactionBalance(
          tx,
          row.type as TransactionType,
          Number(row.amount),
          row.accountId,
          row.targetAccountId,
        );

        return row;
      });
    } else {
      patch.updatedAt = new Date();
      patch.updatedBy = userId;

      const [row] = await this.db
        .update(lifeFinanceTransactions)
        .set(patch)
        .where(eq(lifeFinanceTransactions.id, id))
        .returning();

      if (!row) {
        throw new NotFoundException('交易不存在');
      }
      updatedRow = row;
    }

    this.logger.log(`Transaction updated: ${id}`);
    return this.mapTransaction(updatedRow);
  }

  async deleteTransaction(id: string): Promise<{ success: boolean }> {
    const deleted = await this.db.transaction(async (tx) => {
      // 1. 查询原交易
      const existing = await tx
        .select()
        .from(lifeFinanceTransactions)
        .where(eq(lifeFinanceTransactions.id, id))
        .limit(1);

      if (existing.length === 0) {
        throw new NotFoundException('交易不存在');
      }

      // 2. 反向冲销余额
      await this.reverseTransactionBalance(tx, existing[0]);

      // 3. 删除交易
      const result = await tx
        .delete(lifeFinanceTransactions)
        .where(eq(lifeFinanceTransactions.id, id))
        .returning({ id: lifeFinanceTransactions.id });

      return result;
    });

    this.logger.log(`Transaction deleted: ${id}`);
    return { success: deleted.length > 0 };
  }

  // ===== Budgets =====

  async getBudgets(): Promise<FinanceBudget[]> {
    const rows = await this.db
      .select()
      .from(lifeFinanceBudgets)
      .orderBy(desc(lifeFinanceBudgets.createdAt));

    return rows.map((row) => this.mapBudget(row));
  }

  async createBudget(dto: {
    category: string;
    amount: number;
    period: string;
    periodKey: string;
  }, userId: string): Promise<FinanceBudget> {
    const [row] = await this.db
      .insert(lifeFinanceBudgets)
      .values({
        category: dto.category,
        amount: String(dto.amount),
        period: dto.period,
        periodKey: dto.periodKey,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`Budget created: ${row.id} (${row.category})`);
    return this.mapBudget(row);
  }

  async updateBudget(
    id: string,
    dto: Partial<{
      category: string;
      amount: number;
      period: string;
      periodKey: string;
    }>,
    userId: string,
  ): Promise<FinanceBudget> {
    const patch: Partial<typeof lifeFinanceBudgets.$inferInsert> = {};
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.amount !== undefined) patch.amount = String(dto.amount);
    if (dto.period !== undefined) patch.period = dto.period;
    if (dto.periodKey !== undefined) patch.periodKey = dto.periodKey;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const [row] = await this.db
      .update(lifeFinanceBudgets)
      .set(patch)
      .where(eq(lifeFinanceBudgets.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('预算不存在');
    }

    this.logger.log(`Budget updated: ${id}`);
    return this.mapBudget(row);
  }

  async deleteBudget(id: string): Promise<{ success: boolean }> {
    const deleted = await this.db
      .delete(lifeFinanceBudgets)
      .where(eq(lifeFinanceBudgets.id, id))
      .returning({ id: lifeFinanceBudgets.id });

    if (deleted.length === 0) {
      throw new NotFoundException('预算不存在');
    }

    this.logger.log(`Budget deleted: ${id}`);
    return { success: true };
  }

  // ===== Summary =====

  async getSummary(month: string): Promise<FinanceSummary> {
    // 计算月度范围
    const startDate = `${month}-01`;
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? year + 1 : year;
    const endDate = `${nextYear.toString().padStart(4, '0')}-${nextMonth.toString().padStart(2, '0')}-01`;

    // 1. 收入/支出总额
    const statsRows = await this.db
      .select({
        type: lifeFinanceTransactions.type,
        total: sql<number>`sum(${lifeFinanceTransactions.amount})`,
      })
      .from(lifeFinanceTransactions)
      .where(
        and(
          gte(lifeFinanceTransactions.transactionDate, startDate),
          lt(lifeFinanceTransactions.transactionDate, endDate),
        ),
      )
      .groupBy(lifeFinanceTransactions.type);

    let totalIncome = 0;
    let totalExpense = 0;
    for (const row of statsRows) {
      const val = Number(row.total ?? 0);
      if (row.type === 'income') totalIncome = val;
      else if (row.type === 'expense') totalExpense = val;
    }

    const netBalance = totalIncome - totalExpense;

    // 2. 分类支出统计
    const categoryRows = await this.db
      .select({
        category: lifeFinanceTransactions.category,
        amount: sql<number>`sum(${lifeFinanceTransactions.amount})`,
      })
      .from(lifeFinanceTransactions)
      .where(
        and(
          eq(lifeFinanceTransactions.type, 'expense'),
          gte(lifeFinanceTransactions.transactionDate, startDate),
          lt(lifeFinanceTransactions.transactionDate, endDate),
        ),
      )
      .groupBy(lifeFinanceTransactions.category)
      .orderBy(sql`sum(${lifeFinanceTransactions.amount}) desc`);

    const categoryStats = categoryRows.map((row) => ({
      category: row.category,
      amount: Number(row.amount ?? 0),
      percentage: totalExpense > 0 ? (Number(row.amount ?? 0) / totalExpense) * 100 : 0,
    }));

    // 3. 预算使用情况（月度预算）
    const budgetRows = await this.db
      .select()
      .from(lifeFinanceBudgets)
      .where(
        and(
          eq(lifeFinanceBudgets.period, 'monthly'),
          eq(lifeFinanceBudgets.periodKey, month),
        ),
      );

    const budgetUsage = await Promise.all(
      budgetRows.map(async (budget) => {
        const [spentRow] = await this.db
          .select({
            spent: sql<number>`coalesce(sum(${lifeFinanceTransactions.amount}), 0)`,
          })
          .from(lifeFinanceTransactions)
          .where(
            and(
              eq(lifeFinanceTransactions.type, 'expense'),
              eq(lifeFinanceTransactions.category, budget.category),
              gte(lifeFinanceTransactions.transactionDate, startDate),
              lt(lifeFinanceTransactions.transactionDate, endDate),
            ),
          );

        const spent = Number(spentRow?.spent ?? 0);
        const budgetAmount = Number(budget.amount);

        return {
          category: budget.category,
          budget: budgetAmount,
          spent,
          percentage: budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0,
        };
      }),
    );

    return {
      totalIncome,
      totalExpense,
      netBalance,
      categoryStats,
      budgetUsage,
    };
  }
}


