import { useState, useMemo } from 'react';
import type {
  FinanceAccount,
  FinanceTransaction,
  FinanceBudget,
} from '@shared/api.interface';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ACCOUNT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  getTodayStr,
  getThisMonthStr,
} from './FinanceOverview';

// ===== 交易表单弹窗 =====

export function TxFormDialog({
  open,
  onOpenChange,
  editTx,
  accounts,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTx: FinanceTransaction | null;
  accounts: FinanceAccount[];
  onSave: (dto: {
    id?: string;
    type: string;
    amount: number;
    category: string;
    subcategory?: string;
    accountId?: string;
    note?: string;
    transactionDate: string;
  }) => void;
  saving: boolean;
}) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayStr());

  // 打开时重置
  useMemo(() => {
    if (open) {
      setType(editTx?.type ?? 'expense');
      setAmount(editTx ? String(editTx.amount) : '');
      setCategory(editTx?.category ?? '');
      setSubcategory(editTx?.subcategory ?? '');
      setAccountId(editTx?.accountId ?? '');
      setNote(editTx?.note ?? '');
      setTransactionDate(
        editTx?.transactionDate?.slice(0, 10) ?? getTodayStr(),
      );
    }
  }, [open, editTx]);

  const categoryList =
    type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    if (!category) {
      toast.error('请选择分类');
      return;
    }
    onSave({
      id: editTx?.id,
      type,
      amount: amt,
      category,
      subcategory: subcategory || undefined,
      accountId: accountId || undefined,
      note: note || undefined,
      transactionDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-100 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {editTx ? '编辑交易' : '记一笔'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            记录一笔收入或支出
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 类型切换 */}
          <div className="flex gap-2">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setCategory('');
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === t
                    ? t === 'income'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : t === 'expense'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/[0.08]'
                }`}
              >
                {TRANSACTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* 金额 */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">金额</label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>

          {/* 分类 */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">分类</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full border-white/10 text-zinc-100 bg-white/[0.02]">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                {categoryList.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 子分类 */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">
              子分类（可选）
            </label>
            <Input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="如：午餐、地铁"
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>

          {/* 账户 */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">账户</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full border-white/10 text-zinc-100 bg-white/[0.02]">
                <SelectValue placeholder="选择账户" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 日期 */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">日期</label>
            <Input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>

          {/* 备注 */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">
              备注（可选）
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="添加备注..."
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-zinc-300 hover:bg-white/5"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
          >
            {saving ? '保存中...' : editTx ? '保存' : '记录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== 账户表单弹窗 =====

export function AccFormDialog({
  open,
  onOpenChange,
  editAcc,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editAcc: FinanceAccount | null;
  onSave: (dto: {
    id?: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
    color: string;
    icon: string;
    note: string;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('0');
  const [currency, setCurrency] = useState('CNY');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('wallet');
  const [note, setNote] = useState('');

  useMemo(() => {
    if (open) {
      setName(editAcc?.name ?? '');
      setType(editAcc?.type ?? 'bank');
      setBalance(editAcc ? String(editAcc.balance) : '0');
      setCurrency(editAcc?.currency ?? 'CNY');
      setColor(editAcc?.color ?? '#6366f1');
      setIcon(editAcc?.icon ?? 'wallet');
      setNote(editAcc?.note ?? '');
    }
  }, [open, editAcc]);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('请输入账户名称');
      return;
    }
    const bal = parseFloat(balance);
    if (isNaN(bal)) {
      toast.error('请输入有效余额');
      return;
    }
    onSave({
      id: editAcc?.id,
      name: name.trim(),
      type,
      balance: bal,
      currency: currency || 'CNY',
      color,
      icon,
      note,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-100 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {editAcc ? '编辑账户' : '新增账户'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            添加一个新的资金账户
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">
              账户名称
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：招商银行、微信钱包"
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">
              账户类型
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full border-white/10 text-zinc-100 bg-white/[0.02]">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                初始余额
              </label>
              <Input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="border-white/10 text-zinc-100 bg-white/[0.02]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">币种</label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border-white/10 text-zinc-100 bg-white/[0.02]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">颜色</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-9 p-0.5 border-white/10 bg-white/[0.02] cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="border-white/10 text-zinc-100 bg-white/[0.02] flex-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">图标</label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="wallet"
                className="border-white/10 text-zinc-100 bg-white/[0.02]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">
              备注（可选）
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注信息..."
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-zinc-300 hover:bg-white/5"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
          >
            {saving ? '保存中...' : editAcc ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== 预算表单弹窗 =====

export function BudFormDialog({
  open,
  onOpenChange,
  editBud,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editBud: FinanceBudget | null;
  onSave: (dto: {
    id?: string;
    category: string;
    amount: number;
    period: 'monthly';
    periodKey: string;
  }) => void;
  saving: boolean;
}) {
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [periodKey, setPeriodKey] = useState(getThisMonthStr());

  useMemo(() => {
    if (open) {
      setCategory(editBud?.category ?? '');
      setAmount(editBud ? String(editBud.amount) : '');
      setPeriodKey(editBud?.periodKey ?? getThisMonthStr());
    }
  }, [open, editBud]);

  const handleSubmit = () => {
    if (!category) {
      toast.error('请选择分类');
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error('请输入有效预算金额');
      return;
    }
    onSave({
      id: editBud?.id,
      category,
      amount: amt,
      period: 'monthly',
      periodKey,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-100 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {editBud ? '编辑预算' : '新增预算'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            为分类设置月度预算
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">分类</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full border-white/10 text-zinc-100 bg-white/[0.02]">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">
              预算金额
            </label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">周期</label>
              <Select value="monthly" disabled>
                <SelectTrigger className="w-full border-white/10 text-zinc-100 bg-white/[0.02] opacity-70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">每月</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">期段</label>
              <Input
                type="month"
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
                className="border-white/10 text-zinc-100 bg-white/[0.02]"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-zinc-300 hover:bg-white/5"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
          >
            {saving ? '保存中...' : editBud ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== 确认弹窗 =====

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  loading,
  destructive,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-100 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">{title}</DialogTitle>
          <DialogDescription className="text-zinc-500">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-zinc-300 hover:bg-white/5"
          >
            取消
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            variant={destructive ? 'destructive' : 'default'}
            className={
              destructive
                ? 'bg-rose-500/80 hover:bg-rose-500 text-white border-rose-500/50'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90'
            }
          >
            {loading ? '处理中...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
