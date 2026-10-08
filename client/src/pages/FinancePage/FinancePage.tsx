import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, PieChart, Receipt, CreditCard, Target } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import {
  getFinanceSummary,
  getFinanceAccounts,
  getFinanceTransactions,
  getFinanceBudgets,
  createFinanceTransaction,
  updateFinanceTransaction,
  deleteFinanceTransaction,
  createFinanceAccount,
  updateFinanceAccount,
  deleteFinanceAccount,
  createFinanceBudget,
  updateFinanceBudget,
  deleteFinanceBudget,
} from '@client/src/api/finance';
import type {
  FinanceAccount,
  FinanceTransaction,
  FinanceBudget,
} from '@shared/api.interface';
import { FinanceOverviewTab, getThisMonthStr } from './FinanceOverview';
import { FinanceTransactionsTab } from './FinanceTransactions';
import { FinanceAccountsTab } from './FinanceAccounts';
import { FinanceBudgetsTab } from './FinanceBudgets';
import {
  TxFormDialog,
  AccFormDialog,
  BudFormDialog,
  ConfirmDialog,
} from './FinanceDialogs';

const FinancePage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // ---- 通用数据 ----
  const { data: summaryData } = useQuery({
    queryKey: ['financeSummary', { month: getThisMonthStr() }],
    queryFn: () => getFinanceSummary({ month: getThisMonthStr() }),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['financeAccounts'],
    queryFn: () => getFinanceAccounts(),
  });

  const { data: budgetsData } = useQuery({
    queryKey: ['financeBudgets'],
    queryFn: () => getFinanceBudgets(),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
    queryClient.invalidateQueries({ queryKey: ['financeAccounts'] });
    queryClient.invalidateQueries({ queryKey: ['financeTransactions'] });
    queryClient.invalidateQueries({ queryKey: ['financeBudgets'] });
  };

  // ---- 交易弹窗 & 删除 ----
  const [txFormOpen, setTxFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<FinanceTransaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<FinanceTransaction | null>(null);

  const txDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteFinanceTransaction(id),
    onSuccess: () => {
      toast.success('删除成功');
      invalidateAll();
      setDeleteTx(null);
    },
    onError: (err: Error) => toast.error('删除失败: ' + err.message),
  });

  const txSaveMutation = useMutation({
    mutationFn: (dto: {
      id?: string;
      type: string;
      amount: number;
      category: string;
      subcategory?: string;
      accountId?: string;
      note?: string;
      transactionDate: string;
    }) =>
      dto.id
        ? updateFinanceTransaction(dto.id, dto)
        : createFinanceTransaction(dto),
    onSuccess: () => {
      toast.success(editTx ? '更新成功' : '创建成功');
      invalidateAll();
      setTxFormOpen(false);
      setEditTx(null);
    },
    onError: (err: Error) => toast.error('操作失败: ' + err.message),
  });

  // ---- 账户弹窗 & 删除 ----
  const [accFormOpen, setAccFormOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<FinanceAccount | null>(null);
  const [deleteAcc, setDeleteAcc] = useState<FinanceAccount | null>(null);

  const accDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteFinanceAccount(id),
    onSuccess: () => {
      toast.success('删除成功');
      invalidateAll();
      setDeleteAcc(null);
    },
    onError: (err: Error) => toast.error('删除失败: ' + err.message),
  });

  const accSaveMutation = useMutation({
    mutationFn: (dto: {
      id?: string;
      name: string;
      type: string;
      balance: number;
      currency: string;
      color: string;
      icon: string;
      note: string;
    }) =>
      dto.id ? updateFinanceAccount(dto.id, dto) : createFinanceAccount(dto),
    onSuccess: () => {
      toast.success(editAcc ? '更新成功' : '创建成功');
      invalidateAll();
      setAccFormOpen(false);
      setEditAcc(null);
    },
    onError: (err: Error) => toast.error('操作失败: ' + err.message),
  });

  // ---- 预算弹窗 & 删除 ----
  const [budFormOpen, setBudFormOpen] = useState(false);
  const [editBud, setEditBud] = useState<FinanceBudget | null>(null);
  const [deleteBud, setDeleteBud] = useState<FinanceBudget | null>(null);

  const budDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteFinanceBudget(id),
    onSuccess: () => {
      toast.success('删除成功');
      invalidateAll();
      setDeleteBud(null);
    },
    onError: (err: Error) => toast.error('删除失败: ' + err.message),
  });

  const budSaveMutation = useMutation({
    mutationFn: (dto: {
      id?: string;
      category: string;
      amount: number;
      period: 'monthly';
      periodKey: string;
    }) =>
      dto.id ? updateFinanceBudget(dto.id, dto) : createFinanceBudget(dto),
    onSuccess: () => {
      toast.success(editBud ? '更新成功' : '创建成功');
      invalidateAll();
      setBudFormOpen(false);
      setEditBud(null);
    },
    onError: (err: Error) => toast.error('操作失败: ' + err.message),
  });

  // ---- 流水筛选 ----
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState('');
  const [txAccountFilter, setTxAccountFilter] = useState('');

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: [
      'financeTransactions',
      {
        type: txTypeFilter || undefined,
        category: txCategoryFilter || undefined,
        accountId: txAccountFilter || undefined,
      },
    ],
    queryFn: () =>
      getFinanceTransactions({
        type: txTypeFilter || undefined,
        category: txCategoryFilter || undefined,
        accountId: txAccountFilter || undefined,
        pageSize: 200,
      }),
  });

  const accounts = accountsData?.items ?? [];
  const budgets = budgetsData?.items ?? [];
  const transactions = txData?.items ?? [];

  // ---- 动作 ----
  const openCreateTx = () => {
    setEditTx(null);
    setTxFormOpen(true);
  };
  const openEditTx = (tx: FinanceTransaction) => {
    setEditTx(tx);
    setTxFormOpen(true);
  };
  const openDeleteTx = (tx: FinanceTransaction) => {
    setDeleteTx(tx);
  };

  const openCreateAcc = () => {
    setEditAcc(null);
    setAccFormOpen(true);
  };
  const openEditAcc = (acc: FinanceAccount) => {
    setEditAcc(acc);
    setAccFormOpen(true);
  };
  const openDeleteAcc = (acc: FinanceAccount) => {
    setDeleteAcc(acc);
  };

  const openCreateBud = () => {
    setEditBud(null);
    setBudFormOpen(true);
  };
  const openEditBud = (bud: FinanceBudget) => {
    setEditBud(bud);
    setBudFormOpen(true);
  };
  const openDeleteBud = (bud: FinanceBudget) => {
    setDeleteBud(bud);
  };

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      {/* 顶部标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          财务记账
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          管理账户、记录收支、追踪预算
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-white/[0.03] border border-white/5 p-1 flex-wrap h-auto">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-white/10 text-zinc-400 gap-1.5"
          >
            <PieChart className="w-4 h-4" />
            概览
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-white/10 text-zinc-400 gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            流水
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-white/10 text-zinc-400 gap-1.5"
          >
            <CreditCard className="w-4 h-4" />
            账户
          </TabsTrigger>
          <TabsTrigger
            value="budgets"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-white/10 text-zinc-400 gap-1.5"
          >
            <Target className="w-4 h-4" />
            预算
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <FinanceOverviewTab summary={summaryData} budgets={budgets} />
        </TabsContent>

        <TabsContent value="transactions">
          <FinanceTransactionsTab
            transactions={transactions}
            loading={txLoading}
            accounts={accounts}
            typeFilter={txTypeFilter}
            onTypeFilterChange={setTxTypeFilter}
            categoryFilter={txCategoryFilter}
            onCategoryFilterChange={setTxCategoryFilter}
            accountFilter={txAccountFilter}
            onAccountFilterChange={setTxAccountFilter}
            onEdit={openEditTx}
            onDelete={openDeleteTx}
          />
        </TabsContent>

        <TabsContent value="accounts">
          <FinanceAccountsTab
            accounts={accounts}
            onAdd={openCreateAcc}
            onEdit={openEditAcc}
            onDelete={openDeleteAcc}
          />
        </TabsContent>

        <TabsContent value="budgets">
          <FinanceBudgetsTab
            budgets={budgets}
            budgetUsage={summaryData?.budgetUsage ?? []}
            onAdd={openCreateBud}
            onEdit={openEditBud}
            onDelete={openDeleteBud}
          />
        </TabsContent>
      </Tabs>

      {/* 悬浮记一笔按钮 */}
      <button
        onClick={openCreateTx}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:scale-110 transition-all duration-300 z-40"
        aria-label="记一笔"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* 弹窗组件 */}
      <TxFormDialog
        open={txFormOpen}
        onOpenChange={setTxFormOpen}
        editTx={editTx}
        accounts={accounts}
        onSave={(dto) => txSaveMutation.mutate(dto)}
        saving={txSaveMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTx}
        onOpenChange={(open) => !open && setDeleteTx(null)}
        title="删除交易记录"
        description="删除后不可恢复，确认要删除这笔交易吗？"
        confirmText="确认删除"
        onConfirm={() => deleteTx && txDeleteMutation.mutate(deleteTx.id)}
        loading={txDeleteMutation.isPending}
        destructive
      />

      <AccFormDialog
        open={accFormOpen}
        onOpenChange={setAccFormOpen}
        editAcc={editAcc}
        onSave={(dto) => accSaveMutation.mutate(dto)}
        saving={accSaveMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteAcc}
        onOpenChange={(open) => !open && setDeleteAcc(null)}
        title="删除账户"
        description="删除账户将同时影响关联交易数据，确认删除？"
        confirmText="确认删除"
        onConfirm={() => deleteAcc && accDeleteMutation.mutate(deleteAcc.id)}
        loading={accDeleteMutation.isPending}
        destructive
      />

      <BudFormDialog
        open={budFormOpen}
        onOpenChange={setBudFormOpen}
        editBud={editBud}
        onSave={(dto) => budSaveMutation.mutate(dto)}
        saving={budSaveMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteBud}
        onOpenChange={(open) => !open && setDeleteBud(null)}
        title="删除预算"
        description="确认要删除此预算吗？"
        confirmText="确认删除"
        onConfirm={() => deleteBud && budDeleteMutation.mutate(deleteBud.id)}
        loading={budDeleteMutation.isPending}
        destructive
      />
    </div>
  );
};

export default FinancePage;
