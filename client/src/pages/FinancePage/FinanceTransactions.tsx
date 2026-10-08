import { useMemo } from 'react';
import type { FinanceAccount, FinanceTransaction } from '@shared/api.interface';
import { TrendingUp, TrendingDown, Wallet, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@client/src/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatMoney,
  getTodayStr,
} from './FinanceOverview';

export function FinanceTransactionsTab({
  transactions,
  loading,
  accounts,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  accountFilter,
  onAccountFilterChange,
  onEdit,
  onDelete,
}: {
  transactions: FinanceTransaction[];
  loading: boolean;
  accounts: FinanceAccount[];
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  accountFilter: string;
  onAccountFilterChange: (v: string) => void;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (tx: FinanceTransaction) => void;
}) {
  const accountMap = useMemo(() => {
    const m = new Map<string, FinanceAccount>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const grouped = useMemo(() => {
    const today = getTodayStr();
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);

    const groups: Record<string, FinanceTransaction[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };

    for (const tx of transactions) {
      const date = tx.transactionDate.slice(0, 10);
      if (date === today) groups.today.push(tx);
      else if (date === yesterday) groups.yesterday.push(tx);
      else groups.earlier.push(tx);
    }
    return groups;
  }, [transactions]);

  const typeOptions = [
    { value: '', label: '全部类型' },
    { value: 'income', label: '收入' },
    { value: 'expense', label: '支出' },
    { value: 'transfer', label: '转账' },
  ];

  const categoryOptions = useMemo(() => {
    const opts = [{ value: '', label: '全部分类' }];
    const cats =
      typeFilter === 'income'
        ? INCOME_CATEGORIES
        : typeFilter === 'expense'
          ? EXPENSE_CATEGORIES
          : [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
    for (const c of cats) {
      opts.push({ value: c, label: CATEGORY_LABELS[c] ?? c });
    }
    return opts;
  }, [typeFilter]);

  const groupLabels: Record<string, string> = {
    today: '今天',
    yesterday: '昨天',
    earlier: '更早',
  };

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-32 border-white/10 text-zinc-100 bg-white/[0.02] h-10">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-36 border-white/10 text-zinc-100 bg-white/[0.02] h-10">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={accountFilter} onValueChange={onAccountFilterChange}>
          <SelectTrigger className="w-40 border-white/10 text-zinc-100 bg-white/[0.02] h-10">
            <SelectValue placeholder="账户" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
            <SelectItem value="">全部账户</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 交易列表 */}
      {loading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">加载中...</div>
      ) : transactions.length === 0 ? (
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardContent className="p-10 text-center">
            <p className="text-zinc-500 text-sm">暂无交易记录</p>
            <p className="text-zinc-600 text-xs mt-1">点击右下角 + 记一笔</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(['today', 'yesterday', 'earlier'] as const).map((key) =>
            grouped[key].length > 0 ? (
              <div key={key}>
                <p className="text-xs text-zinc-500 mb-2 font-medium">
                  {groupLabels[key]}
                </p>
                <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {grouped[key].map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        accountName={
                          accountMap.get(tx.accountId ?? '')?.name ?? '未关联'
                        }
                        onEdit={() => onEdit(tx)}
                        onDelete={() => onDelete(tx)}
                      />
                    ))}
                  </div>
                </Card>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function TransactionRow({
  tx,
  accountName,
  onEdit,
  onDelete,
}: {
  tx: FinanceTransaction;
  accountName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = tx.type === 'income';
  const isExpense = tx.type === 'expense';
  const amountClass = isIncome
    ? 'text-emerald-400'
    : isExpense
      ? 'text-rose-400'
      : 'text-zinc-300';
  const amountPrefix = isIncome ? '+' : isExpense ? '-' : '';

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 flex-shrink-0">
        {isIncome ? (
          <TrendingUp className="w-4 h-4" />
        ) : isExpense ? (
          <TrendingDown className="w-4 h-4" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-100 truncate">
          {CATEGORY_LABELS[tx.category] ?? tx.category}
        </div>
        <div className="text-xs text-zinc-500 truncate">
          {accountName}
          {tx.subcategory ? ` · ${tx.subcategory}` : ''}
          {tx.note ? ` · ${tx.note}` : ''}
        </div>
      </div>
      <div className={`text-sm font-medium ${amountClass} flex-shrink-0`}>
        {amountPrefix}
        {formatMoney(tx.amount)}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
          aria-label="编辑"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-rose-400"
          aria-label="删除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
