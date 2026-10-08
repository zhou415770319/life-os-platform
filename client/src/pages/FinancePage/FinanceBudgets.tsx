import { useMemo } from 'react';
import type { FinanceBudget } from '@shared/api.interface';
import { Target, Pencil, Trash2, Plus } from 'lucide-react';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { CATEGORY_LABELS, formatMoney } from './FinanceOverview';

export function FinanceBudgetsTab({
  budgets,
  budgetUsage,
  onAdd,
  onEdit,
  onDelete,
}: {
  budgets: FinanceBudget[];
  budgetUsage: {
    category: string;
    budget: number;
    spent: number;
    percentage: number;
  }[];
  onAdd: () => void;
  onEdit: (bud: FinanceBudget) => void;
  onDelete: (bud: FinanceBudget) => void;
}) {
  const usageMap = useMemo(() => {
    const m = new Map<
      string,
      { spent: number; percentage: number; budget: number }
    >();
    for (const u of budgetUsage) {
      m.set(u.category, {
        spent: u.spent,
        percentage: u.percentage,
        budget: u.budget,
      });
    }
    return m;
  }, [budgetUsage]);

  return (
    <div className="space-y-6">
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
        <CardContent className="p-6">
          {budgets.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-zinc-500 text-sm">暂无预算</p>
              <p className="text-zinc-600 text-xs mt-1">
                点击下方按钮创建第一个预算
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {budgets.map((bud) => {
                const usage = usageMap.get(bud.category);
                const spent = usage?.spent ?? 0;
                const pct = usage?.percentage ?? 0;
                const remaining = bud.amount - spent;
                const isOver = pct >= 100;

                return (
                  <div key={bud.id} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-indigo-400">
                          <Target className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-zinc-100">
                            {CATEGORY_LABELS[bud.category] ?? bud.category}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {bud.periodKey} · 月预算
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-medium text-zinc-200">
                            {formatMoney(spent)} / {formatMoney(bud.amount)}
                          </div>
                          <div
                            className={`text-xs ${
                              isOver ? 'text-rose-400' : 'text-zinc-500'
                            }`}
                          >
                            {isOver
                              ? `超支 ${formatMoney(-remaining)}`
                              : `剩余 ${formatMoney(remaining)}`}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={() => onEdit(bud)}
                            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
                            aria-label="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(bud)}
                            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-rose-400"
                            aria-label="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver
                            ? 'bg-gradient-to-r from-rose-500 to-red-500'
                            : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button
          onClick={onAdd}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          新增预算
        </Button>
      </div>
    </div>
  );
}
