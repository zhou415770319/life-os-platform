import type { FinanceAccount } from '@shared/api.interface';
import { Wallet, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Plus } from 'lucide-react';
import { ACCOUNT_TYPE_LABELS, formatMoney } from './FinanceOverview';

export function FinanceAccountsTab({
  accounts,
  onAdd,
  onEdit,
  onDelete,
}: {
  accounts: FinanceAccount[];
  onAdd: () => void;
  onEdit: (acc: FinanceAccount) => void;
  onDelete: (acc: FinanceAccount) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.length === 0 ? (
          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl sm:col-span-2 lg:col-span-3">
            <CardContent className="p-10 text-center">
              <p className="text-zinc-500 text-sm">暂无账户</p>
              <p className="text-zinc-600 text-xs mt-1">
                点击下方按钮添加第一个账户
              </p>
            </CardContent>
          </Card>
        ) : (
          accounts.map((acc) => (
            <Card
              key={acc.id}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl group hover:border-white/20 transition-all duration-300 cursor-default"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                      style={{
                        backgroundColor: acc.color ?? 'rgba(99,102,241,0.3)',
                      }}
                    >
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-100">
                        {acc.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                      </div>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={() => onEdit(acc)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
                      aria-label="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(acc)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-rose-400"
                      aria-label="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-2xl font-semibold tracking-tight ${
                      acc.balance < 0 ? 'text-rose-400' : 'text-zinc-50'
                    }`}
                  >
                    {formatMoney(acc.balance)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {acc.currency}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={onAdd}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          新增账户
        </Button>
      </div>
    </div>
  );
}
