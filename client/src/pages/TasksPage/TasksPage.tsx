import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Inbox,
  Play,
  CheckCircle2,
  ListTodo,
  Trash2,
  Pencil,
  CalendarDays,
  Tag,
  Folder,
  Hash,
  Search,
  Check,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import QuadrantMatrix from './QuadrantMatrix';
import TaskFormDialog, { EMPTY_TASK_FORM } from './TaskFormDialog';
import type { TaskFormState } from './TaskFormDialog';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
  getTaskFocusStats,
} from '@client/src/api/tasks';
import type {
  LifeTask,
  CreateTaskDto,
  UpdateTaskDto,
  TaskStatus,
  TaskPriority,
  TaskQuadrant,
} from '@shared/api.interface';

const STATUS_TABS: { value: TaskStatus | 'all'; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: '全部', icon: <ListTodo className="w-4 h-4" /> },
  { value: 'inbox', label: '收集箱', icon: <Inbox className="w-4 h-4" /> },
  { value: 'todo', label: '待办', icon: <ListTodo className="w-4 h-4" /> },
  { value: 'in_progress', label: '进行中', icon: <Play className="w-4 h-4" /> },
  { value: 'done', label: '已完成', icon: <CheckCircle2 className="w-4 h-4" /> },
  { value: 'archived', label: '已归档', icon: <Folder className="w-4 h-4" /> },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
  medium: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  high: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  urgent: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  inbox: '收集箱',
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  archived: '已归档',
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  inbox: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  todo: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  in_progress: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  done: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  archived: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
};

const TasksPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TaskStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<LifeTask | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_TASK_FORM);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTaskData, setDeleteTaskData] = useState<LifeTask | null>(null);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['tasks', { status: activeTab, search: searchQuery }],
    queryFn: () =>
      getTasks({
        status: activeTab === 'all' ? undefined : activeTab,
        search: searchQuery || undefined,
        pageSize: 100,
      }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['taskStats'],
    queryFn: () => getTaskStats(),
  });

  // GTD-番茄钟联动：各任务专注统计
  const { data: focusStats = {} } = useQuery({
    queryKey: ['taskFocusStats'],
    queryFn: () => getTaskFocusStats(),
  });

  const quadrantTasks = useMemo(() => {
    const items = listData?.items ?? [];
    const map: Record<TaskQuadrant, LifeTask[]> = {
      q1: [],
      q2: [],
      q3: [],
      q4: [],
    };
    for (const t of items) {
      if (t.quadrant) map[t.quadrant].push(t);
    }
    return map;
  }, [listData]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['taskStats'] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateTaskDto) => createTask(dto),
    onSuccess: () => {
      toast.success('任务创建成功');
      refreshAll();
      setFormOpen(false);
    },
    onError: (err: Error) =>
      toast.error('创建失败: ' + (err.message || '未知错误')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) =>
      updateTask(id, dto),
    onSuccess: () => {
      toast.success('任务更新成功');
      refreshAll();
      setFormOpen(false);
    },
    onError: (err: Error) =>
      toast.error('更新失败: ' + (err.message || '未知错误')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      toast.success('任务已删除');
      refreshAll();
      setDeleteOpen(false);
      setDeleteTaskData(null);
    },
    onError: (err: Error) =>
      toast.error('删除失败: ' + (err.message || '未知错误')),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateTask(id, { status: done ? 'done' : 'in_progress' }),
    onSuccess: () => refreshAll(),
    onError: (err: Error) =>
      toast.error('操作失败: ' + (err.message || '未知错误')),
  });

  const handleSearch = (val: string) => {
    setSearchInput(val);
    clearTimeout((handleSearch as unknown as { _t: number })._t);
    (handleSearch as unknown as { _t: ReturnType<typeof setTimeout> })._t =
      setTimeout(() => setSearchQuery(val.trim()), 300);
  };

  const openCreate = () => {
    setEditTask(null);
    setForm(EMPTY_TASK_FORM);
    setFormOpen(true);
  };

  const openEdit = (task: LifeTask) => {
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      quadrant: task.quadrant ?? '',
      dueDate: task.dueDate ?? '',
      tags: task.tags?.join(', ') ?? '',
      project: task.project ?? '',
      context: task.context ?? '',
    });
    setFormOpen(true);
  };

  const handleFormSubmit = (dto: CreateTaskDto) => {
    if (editTask) {
      updateMutation.mutate({ id: editTask.id, dto });
    } else {
      createMutation.mutate(dto);
    }
  };

  const handleDelete = (task: LifeTask) => {
    setDeleteTaskData(task);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTaskData) deleteMutation.mutate(deleteTaskData.id);
  };

  const toggleComplete = (task: LifeTask) => {
    completeMutation.mutate({ id: task.id, done: task.status !== 'done' });
  };

  const items = listData?.items ?? [];
  const statusStats = stats?.statusStats ?? ({} as Record<TaskStatus, number>);

  const statCards = [
    {
      label: '收集箱',
      value: statusStats.inbox ?? 0,
      icon: <Inbox className="w-5 h-5" />,
      color: 'text-purple-400',
    },
    {
      label: '进行中',
      value: statusStats.in_progress ?? 0,
      icon: <Play className="w-5 h-5" />,
      color: 'text-amber-400',
    },
    {
      label: '今日完成',
      value: stats?.todayCompleted ?? 0,
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'text-emerald-400',
    },
    {
      label: '总任务数',
      value: stats?.total ?? 0,
      icon: <ListTodo className="w-5 h-5" />,
      color: 'text-indigo-400',
    },
  ];

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      {/* 顶部标题区 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            任务管理 · GTD
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            收集箱 · 四象限矩阵 · 项目分解 · 上下文标签
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          新建任务
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <Card
            key={s.label}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-2xl"
          >
            <CardContent className="p-6">
              <div className={`${s.color} mb-3`}>{s.icon}</div>
              <div className="text-2xl font-semibold text-zinc-50">
                {statsLoading ? '—' : s.value}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 四象限矩阵 */}
      <QuadrantMatrix
        tasksByQuadrant={quadrantTasks}
        onEdit={openEdit}
        onToggleComplete={toggleComplete}
      />

      {/* 搜索 */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索任务..."
            className="pl-10 border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02] h-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TaskStatus | 'all')}
        className="mb-6"
      >
        <TabsList className="bg-white/[0.03] border border-white/5 p-1 flex-wrap h-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-white/10 text-zinc-400 gap-1.5"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 任务列表 */}
      <div className="space-y-3">
        {listLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-white/[0.02] border border-white/5 rounded-xl animate-pulse"
            />
          ))
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            暂无任务，点击「新建任务」开始
          </div>
        ) : (
          items.map((task) => (
            <Card
              key={task.id}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl transition-all duration-300 ease-out hover:scale-[1.01] hover:shadow-xl"
            >
              <CardContent className="p-4 flex items-center gap-3">
                <button onClick={() => toggleComplete(task)} className="flex-shrink-0">
                  <CheckCircle2
                    className={`w-5 h-5 transition-colors ${
                      task.status === 'done'
                        ? 'text-emerald-400'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium truncate ${
                        task.status === 'done'
                          ? 'text-zinc-500 line-through'
                          : 'text-zinc-100'
                      }`}
                    >
                      {task.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${PRIORITY_COLOR[task.priority]}`}
                    >
                      {PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_COLOR[task.status]}`}
                    >
                      {STATUS_LABEL[task.status]}
                    </Badge>
                    {task.quadrant && (
                      <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-500/30">
                        {task.quadrant.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500 flex-wrap">
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {task.dueDate}
                      </span>
                    )}
                    {task.project && (
                      <span className="flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        {task.project}
                      </span>
                    )}
                    {task.context && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {task.context}
                      </span>
                    )}
                    {task.tags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {task.tags.join(', ')}
                      </span>
                    )}
                    {/* GTD 联动：专注统计 */}
                    {focusStats[task.id] && focusStats[task.id].count > 0 && (
                      <span className="flex items-center gap-1 text-orange-300/90">
                        <Timer className="w-3 h-3" />
                        {focusStats[task.id].count} 次 · {focusStats[task.id].minutes} 分钟
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/pomodoro?task=${encodeURIComponent(task.id)}&title=${encodeURIComponent(task.title)}`,
                      )
                    }
                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 h-8"
                    title="开始专注（关联此任务）"
                  >
                    <Timer className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(task)}
                    className="text-zinc-400 hover:text-white hover:bg-white/10 h-8 w-8"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(task)}
                    className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editTask={editTask}
        form={form}
        onFormChange={setForm}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* 删除确认 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-zinc-900/95 border-white/10 text-zinc-100 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-50">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              确定要删除任务「{deleteTaskData?.title}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 bg-transparent">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 text-white hover:bg-red-600 border-0"
            >
              <Check className="w-4 h-4" />
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TasksPage;
