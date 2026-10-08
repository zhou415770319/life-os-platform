import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import type { LifeGoal, Milestone, CreateGoalDto, UpdateGoalDto } from '@shared/api.interface';

interface FormState {
  title: string;
  description: string;
  category: string;
  deadline: string;
  progress: number;
  milestones: Milestone[];
}

function emptyForm(): FormState {
  return {
    title: '',
    description: '',
    category: '',
    deadline: '',
    progress: 0,
    milestones: [],
  };
}

interface GoalFormDialogProps {
  editingGoal: LifeGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dto: CreateGoalDto | UpdateGoalDto) => Promise<void>;
  submitting: boolean;
  trigger?: React.ReactNode;
}

export function GoalFormDialog({
  editingGoal,
  open,
  onOpenChange,
  onSubmit,
  submitting,
  trigger,
}: GoalFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [newMilestone, setNewMilestone] = useState('');

  function resetForm() {
    if (editingGoal) {
      setForm({
        title: editingGoal.title,
        description: editingGoal.description ?? '',
        category: editingGoal.category ?? '',
        deadline: editingGoal.deadline ?? '',
        progress: editingGoal.progress,
        milestones: editingGoal.milestones ? [...editingGoal.milestones] : [],
      });
    } else {
      setForm(emptyForm());
    }
    setNewMilestone('');
  }

  // 弹窗打开（含程序化打开）时同步表单数据，保证编辑时正确回显
  useEffect(() => {
    if (open) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingGoal]);

  function handleOpenChange(open: boolean) {
    if (open) resetForm();
    onOpenChange(open);
  }

  function addMilestone() {
    const title = newMilestone.trim();
    if (!title) return;
    const ms: Milestone = {
      id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      completed: false,
    };
    setForm((prev) => ({ ...prev, milestones: [...prev.milestones, ms] }));
    setNewMilestone('');
  }

  function removeMilestone(id: string) {
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m: Milestone) => m.id !== id),
    }));
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;
    const dto: CreateGoalDto | UpdateGoalDto = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      deadline: form.deadline || undefined,
      progress: form.progress,
      milestones: form.milestones,
      status: form.progress >= 100 ? 'completed' : 'active',
    };
    await onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="glass-card !bg-background/90 backdrop-blur-xl max-h-[85vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingGoal ? '编辑目标' : '新增目标'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              标题 <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="例如：今年读完 24 本书"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">描述</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="更详细的目标说明..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">分类</label>
              <Input
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="如：成长 / 健康"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">截止日期</label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-zinc-400">进度</label>
              <span className="text-xs text-zinc-300">{form.progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) =>
                setForm((p) => ({ ...p, progress: Number(e.target.value) }))
              }
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">里程碑</label>
            <div className="flex gap-2">
              <Input
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addMilestone();
                  }
                }}
                placeholder="输入里程碑后按回车添加"
              />
              <Button type="button" variant="secondary" onClick={addMilestone}>
                添加
              </Button>
            </div>
            {form.milestones.length > 0 && (
              <ul className="space-y-1.5 mt-2">
                {form.milestones.map((ms: Milestone) => (
                  <li
                    key={ms.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/[0.02] border border-white/5"
                  >
                    <span className="text-sm text-zinc-300">{ms.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMilestone(ms.id)}
                      className="h-6 w-6"
                    >
                      <X className="h-3.5 w-3.5 text-zinc-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : editingGoal ? '保存更改' : '创建目标'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
