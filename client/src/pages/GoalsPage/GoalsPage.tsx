import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Plus, Target, Sparkles } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Card } from '@client/src/components/ui/card';
import { Skeleton } from '@client/src/components/ui/skeleton';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { goalsApi } from '@client/src/api';
import type { LifeGoal, CreateGoalDto, UpdateGoalDto, Milestone } from '@shared/api.interface';
import { GoalCard } from './GoalCard';
import { GoalFormDialog } from './GoalFormDialog';

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <Card className="glass-card p-5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    </Card>
  );
}

function GoalCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-4 w-1/4" />
    </div>
  );
}

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<LifeGoal | null>(null);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await goalsApi.getGoals();
      return res.items;
    },
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateGoalDto) => goalsApi.createGoal(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setDialogOpen(false);
      toast.success('目标已创建');
    },
    onError: (err: unknown) => {
      logger.error('Failed to create goal', JSON.stringify(err));
      toast.error('创建目标失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateGoalDto }) =>
      goalsApi.updateGoal(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setDialogOpen(false);
      toast.success('目标已更新');
    },
    onError: (err: unknown) => {
      logger.error('Failed to update goal', JSON.stringify(err));
      toast.error('更新目标失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('目标已删除');
    },
    onError: (err: unknown) => {
      logger.error('Failed to delete goal', JSON.stringify(err));
      toast.error('删除目标失败');
    },
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: ({
      goalId,
      milestones,
      progress,
    }: {
      goalId: string;
      milestones: Milestone[];
      progress: number;
    }) =>
      goalsApi.updateGoal(goalId, {
        milestones,
        progress,
        status: progress >= 100 ? 'completed' : 'active',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
    onError: (err: unknown) => {
      logger.error('Failed to toggle milestone', JSON.stringify(err));
      toast.error('更新里程碑失败');
    },
  });

  const { totalGoals, activeGoals, avgProgress } = useMemo(() => {
    const total = goals.length;
    const active = goals.filter(
      (g: LifeGoal) => g.status === 'active' || g.progress < 100,
    ).length;
    const avg =
      total > 0
        ? Math.round(
            goals.reduce((sum: number, g: LifeGoal) => sum + g.progress, 0) /
              total,
          )
        : 0;
    return { totalGoals: total, activeGoals: active, avgProgress: avg };
  }, [goals]);

  function openCreate() {
    setEditingGoal(null);
    setDialogOpen(true);
  }

  function openEdit(goal: LifeGoal) {
    setEditingGoal(goal);
    setDialogOpen(true);
  }

  async function handleSubmit(dto: CreateGoalDto | UpdateGoalDto) {
    if (!('title' in dto) || !dto.title) {
      toast.warning('请输入目标标题');
      return;
    }
    if (editingGoal) {
      await updateMutation.mutateAsync({ id: editingGoal.id, dto: dto as UpdateGoalDto });
    } else {
      await createMutation.mutateAsync(dto as CreateGoalDto);
    }
  }

  function handleDelete(goal: LifeGoal) {
    deleteMutation.mutate(goal.id);
  }

  function handleToggleMilestone(
    goalId: string,
    milestoneId: string,
    completed: boolean,
  ) {
    const goal = goals.find((g: LifeGoal) => g.id === goalId);
    if (!goal) return;

    const updatedMilestones = goal.milestones.map((m: Milestone) =>
      m.id === milestoneId ? { ...m, completed } : m,
    );

    const completedCount = updatedMilestones.filter((m: Milestone) => m.completed).length;
    const newProgress =
      updatedMilestones.length > 0
        ? Math.round((completedCount / updatedMilestones.length) * 100)
        : goal.progress;

    toggleMilestoneMutation.mutate({
      goalId,
      milestones: updatedMilestones,
      progress: newProgress,
    });
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="relative min-h-screen p-6 md:p-10">
      <BackgroundGlow variant="page" />

      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
            <Target className="h-7 w-7 text-indigo-400" />
            愿景与目标
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            个人长期 OKR、人生核心里程碑追踪与可视化看板
          </p>
        </div>
        <GoalFormDialog
          editingGoal={editingGoal}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          submitting={submitting}
          trigger={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增目标
            </Button>
          }
        />
      </header>

      <section className="grid gap-4 grid-cols-3 mb-8">
        <StatCard label="总目标数" value={totalGoals} accent="text-zinc-50" />
        <StatCard label="进行中" value={activeGoals} accent="text-indigo-300" />
        <StatCard label="平均进度" value={`${avgProgress}%`} accent="text-cyan-300" />
      </section>

      <section>
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <GoalCardSkeleton />
            <GoalCardSkeleton />
          </div>
        ) : goals.length === 0 ? (
          <Card className="glass-card border-dashed p-12 text-center">
            <Sparkles className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 text-sm">
              还没有设定目标，点击右上角创建第一个目标
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {goals.map((goal: LifeGoal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleMilestone={handleToggleMilestone}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
