import type { FinanceAccount, FinanceBudget, FinanceSummary } from '@shared/api.interface';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@client/src/components/ui/card';

export const CATEGORY_LABELS: Record<string, string> = {
  food: '餐饮',
  transport: '交通',
  shopping: '购物',
  entertainment: '娱乐',
  housing: '住房',
  utilities: '水电煤',
  healthcare: '医疗',
  education: '教育',
  salary: '工资',
  bonus: '奖金',
  investment_income: '投资收益',
  other_income: '其他收入',
  other_expense: '其他支出',
};

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'entertainment',
  'housing',
  'utilities',
  'healthcare',
  'education',
  'other_expense',
];

export const INCOME_CATEGORIES = [
  'salary',
  'bonus',
  'investment_income',
  'other_income',
];

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: '现金',
  bank: '银行卡',
  credit_card: '信用卡',
  investment: '投资',
  other: '其他',
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
};

export function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getThisMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

// ===== 概览 Tab =====

export function FinanceOverviewTab({
  summary,
  budgets,
}: {
  summary: FinanceSummary | undefined;
  budgets: FinanceBudget[];
}) {
  const categoryStats = summary?.categoryStats ?? [];
  const topCategories = categoryStats.slice(0, 8);
  const maxAmount = topCategories.length > 0 ? topCategories[0].amount : 1;

  return (
    <div className="space-y-6">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          label="本月收入"
          value={summary?.totalIncome ?? 0}
          icon={<TrendingUp className="w-5 h-5" />}
          tone="income"
        />
        <SummaryCard
          label="本月支出"
          value={summary?.totalExpense ?? 0}
          icon={<TrendingDown className="w-5 h-5" />}
          tone="expense"
        />
        <SummaryCard
          label="本月结余"
          value={summary?.netBalance ?? 0}
          icon={<Wallet className="w-5 h-5" />}
          tone="balance"
        />
      </div>

      {/* 分类支出统计 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-zinc-50 mb-4">
            分类支出统计
          </h3>
          {topCategories.length === 0 ? (
            <p className="text-sm text-zinc-500">暂无支出数据</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map((stat) => {
                const pct = (stat.amount / maxAmount) * 100;
                return (
                  <div key={stat.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-zinc-300">
                        {CATEGORY_LABELS[stat.category] ?? stat.category}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400 text-xs">
                          {stat.percentage.toFixed(1)}%
                        </span>
                        <span className="text-zinc-200 font-medium">
                          {formatMoney(stat.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 预算使用情况 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-zinc-50 mb-4">
            预算使用情况
          </h3>
          {budgets.length === 0 ? (
            <p className="text-sm text-zinc-500">暂无预算</p>
          ) : (
            <div className="space-y-4">
              {(summary?.budgetUsage ?? []).map((item) => {
                const isOver = item.percentage >= 100;
                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-zinc-300">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                      <span
                        className={
                          isOver
                            ? 'text-rose-400 font-medium'
                            : 'text-zinc-400 text-xs'
                        }
                      >
                        {formatMoney(item.spent)} / {formatMoney(item.budget)}
                        {isOver && (
                          <span className="ml-1">
                            <AlertTriangle className="w-3 h-3 inline" />
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isOver
                            ? 'bg-gradient-to-r from-rose-500 to-red-500'
                            : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        }`}
                        style={{
                          width: `${Math.min(item.percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'income' | 'expense' | 'balance';
}) {
  const toneClasses = {
    income: 'text-emerald-400',
    expense: 'text-rose-400',
    balance: 'text-indigo-400',
  };
  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${toneClasses[tone]}`}
          >
            {icon}
          </div>
          <span className="text-sm text-zinc-400">{label}</span>
        </div>
        <div
          className={`text-2xl font-semibold tracking-tight ${toneClasses[tone]}`}
        >
          {formatMoney(value)}
        </div>
      </CardContent>
    </Card>
  );
}
