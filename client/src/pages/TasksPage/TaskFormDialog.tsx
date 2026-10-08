import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { toast } from 'sonner';
import type {
  LifeTask,
  CreateTaskDto,
  TaskStatus,
  TaskPriority,
  TaskQuadrant,
} from '@shared/api.interface';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'inbox', label: '收集箱' },
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
];

const QUADRANT_OPTIONS: { value: TaskQuadrant; label: string }[] = [
  { value: 'q1', label: 'Q1 重要紧急' },
  { value: 'q2', label: 'Q2 重要不紧急' },
  { value: 'q3', label: 'Q3 不重要紧急' },
  { value: 'q4', label: 'Q4 不重要不紧急' },
];

export interface TaskFormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  quadrant: TaskQuadrant | '';
  dueDate: string;
  tags: string;
  project: string;
  context: string;
}

export const EMPTY_TASK_FORM: TaskFormState = {
  title: '',
  description: '',
  status: 'inbox',
  priority: 'medium',
  quadrant: '',
  dueDate: '',
  tags: '',
  project: '',
  context: '',
};

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTask: LifeTask | null;
  form: TaskFormState;
  onFormChange: (form: TaskFormState) => void;
  onSubmit: (dto: CreateTaskDto) => void;
  isLoading: boolean;
}

const TaskFormDialog = ({
  open,
  onOpenChange,
  editTask,
  form,
  onFormChange,
  onSubmit,
  isLoading,
}: TaskFormDialogProps) => {
  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error('请输入任务标题');
      return;
    }
    const tags = form.tags
      ? form.tags
          .split(/[,，]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    onSubmit({
      title: form.title.trim(),
      description: form.description || undefined,
      status: form.status,
      priority: form.priority,
      quadrant: form.quadrant || undefined,
      dueDate: form.dueDate || undefined,
      tags: tags.length > 0 ? tags : undefined,
      project: form.project || undefined,
      context: form.context || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-100 backdrop-blur-xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {editTask ? '编辑任务' : '新建任务'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">
              标题 <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder="输入任务标题"
              className="border-white/10 bg-white/[0.02] text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">描述</label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                onFormChange({ ...form, description: e.target.value })
              }
              placeholder="任务描述..."
              className="border-white/10 bg-white/[0.02] text-zinc-100 placeholder:text-zinc-600 min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">状态</label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  onFormChange({ ...form, status: v as TaskStatus })
                }
              >
                <SelectTrigger className="border-white/10 bg-white/[0.02] text-zinc-100 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">优先级</label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  onFormChange({ ...form, priority: v as TaskPriority })
                }
              >
                <SelectTrigger className="border-white/10 bg-white/[0.02] text-zinc-100 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">四象限</label>
              <Select
                value={form.quadrant}
                onValueChange={(v) =>
                  onFormChange({
                    ...form,
                    quadrant: v as TaskQuadrant | '',
                  })
                }
              >
                <SelectTrigger className="border-white/10 bg-white/[0.02] text-zinc-100 h-9">
                  <SelectValue placeholder="选择象限" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                  {QUADRANT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">到期日期</label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  onFormChange({ ...form, dueDate: e.target.value })
                }
                className="border-white/10 bg-white/[0.02] text-zinc-100 h-9 [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">标签（逗号分隔）</label>
            <Input
              value={form.tags}
              onChange={(e) => onFormChange({ ...form, tags: e.target.value })}
              placeholder="工作, 学习, 健康..."
              className="border-white/10 bg-white/[0.02] text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">项目</label>
              <Input
                value={form.project}
                onChange={(e) =>
                  onFormChange({ ...form, project: e.target.value })
                }
                placeholder="所属项目"
                className="border-white/10 bg-white/[0.02] text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">上下文</label>
              <Input
                value={form.context}
                onChange={(e) =>
                  onFormChange({ ...form, context: e.target.value })
                }
                placeholder="@home, @work..."
                className="border-white/10 bg-white/[0.02] text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
          >
            {editTask ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskFormDialog;
