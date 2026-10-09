import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';
import { habitsApi } from '@client/src/api';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { useConfirmDialog } from '@client/src/hooks/use-confirm-dialog';
import { getTodayDateString, formatDateShort } from '@client/src/utils/date';
import type { LifeHabit, HabitRecord, UpdateHabitDto } from '@shared/api.interface';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import HabitCheckInTab from './HabitCheckInTab';
import HabitManageTab from './HabitManageTab';

export default function HabitsPage() {
  const queryClient = useQueryClient();
  const { openConfirm, ConfirmDialog } = useConfirmDialog();
  const today = getTodayDateString();

  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await habitsApi.getHabits();
      return res.items;
    },
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['habit-records', today],
    queryFn: async () => {
      const res = await habitsApi.getHabitRecords(today);
      return res.items;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (habitId: string) =>
      habitsApi.toggleHabitRecord(habitId, today),
    onMutate: async (habitId: string) => {
      await queryClient.cancelQueries({ queryKey: ['habit-records', today] });
      const prev = queryClient.getQueryData<HabitRecord[]>(['habit-records', today]) || [];
      const target = prev.find((r: HabitRecord) => r.habitId === habitId);
      const newCompleted = !target?.completed;
      const next = [
        ...prev.filter((r: HabitRecord) => r.habitId !== habitId),
        { ...(target || { id: '', habitId, createdAt: '' }), completed: newCompleted } as HabitRecord,
      ];
      queryClient.setQueryData(['habit-records', today], next);
      return { prev, newCompleted };
    },
    onError: (err: unknown, _habitId: string, ctx: any) => {
      queryClient.setQueryData(['habit-records', today], ctx?.prev);
      logger.error('Toggle habit failed', JSON.stringify(err));
      toast.error('操作失败');
    },
    onSuccess: (updated: HabitRecord) => {
      queryClient.setQueryData(['habit-records', today], (prev: HabitRecord[] = []) => [
        ...prev.filter((r: HabitRecord) => r.habitId !== updated.habitId),
        updated,
      ]);
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success(updated.completed ? '打卡成功 🎉' : '已取消打卡');
    },
  });

  const deleteHabitMutation = useMutation({
    mutationFn: (id: string) => habitsApi.deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('已删除');
    },
    onError: (err: unknown) => {
      logger.error('Delete habit failed', JSON.stringify(err));
      toast.error('删除失败');
    },
  });

  const updateHabitMutation = useMutation({
    mutationFn: (payload: { id: string; dto: UpdateHabitDto }) =>
      habitsApi.updateHabit(payload.id, payload.dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('习惯已更新');
    },
    onError: (err: unknown) => {
      logger.error('Update habit failed', JSON.stringify(err));
      toast.error('更新失败');
    },
  });

  const isLoading = habitsLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">加载中...</div>
      </div>
    );
  }

  const handleToggle = (habitId: string) => {
    toggleMutation.mutate(habitId);
  };

  const handleCreateHabit = (_habit: LifeHabit) => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
  };

  const handleUpdateHabit = (id: string, dto: UpdateHabitDto) => {
    updateHabitMutation.mutate({ id, dto });
  };

  const handleRequestDeleteHabit = async (id: string) => {
    const ok = await openConfirm({
      title: '确认删除习惯',
      description: '确定要删除这个习惯吗？删除后相关的打卡记录和连续天数将被清除，此操作不可撤销。',
      confirmText: '确认删除',
      variant: 'destructive',
    });
    if (ok) {
      deleteHabitMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">微习惯</h1>
        <p className="text-sm text-zinc-400 mt-1">
          把大目标拆成小到不可能失败的动作，每天坚持一点点
        </p>
        <div className="flex items-center gap-2 mt-3 text-sm text-zinc-500">
          <CalendarDays className="w-4 h-4" />
          <span>{formatDateShort(new Date().toISOString())}</span>
        </div>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="today">今日打卡</TabsTrigger>
          <TabsTrigger value="manage">微习惯管理</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <HabitCheckInTab habits={habits} records={records} onToggle={handleToggle} />
        </TabsContent>

        <TabsContent value="manage">
          <HabitManageTab
            habits={habits}
            onCreate={handleCreateHabit}
            onUpdate={handleUpdateHabit}
            onDelete={handleRequestDeleteHabit}
          />
        </TabsContent>
      </Tabs>

      {ConfirmDialog}
    </div>
  );
}
