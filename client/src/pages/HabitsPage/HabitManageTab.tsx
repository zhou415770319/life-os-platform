import { useState } from 'react';
import { Plus, Trash2, Flame } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { habitsApi } from '@client/src/api';
import type { LifeHabit, CreateHabitDto } from '@shared/api.interface';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const HABIT_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
];

const HABIT_ICONS = ['🌅', '🏃', '📚', '💧', '🧘', '💪', '✍️', '🎯', '🌙', '☕'];

interface HabitManageTabProps {
  habits: LifeHabit[];
  onCreate: (habit: LifeHabit) => void;
  onDelete: (id: string) => void;
}

export default function HabitManageTab({
  habits,
  onCreate,
  onDelete,
}: HabitManageTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateHabitDto>({
    name: '',
    icon: '🌅',
    color: '#6366f1',
    frequency: 'daily',
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('请输入习惯名称');
      return;
    }
    try {
      const habit = await habitsApi.createHabit(form);
      onCreate(habit);
      setDialogOpen(false);
      setForm({ name: '', icon: '🌅', color: '#6366f1', frequency: 'daily' });
      toast.success('习惯添加成功');
    } catch (err) {
      logger.error('Create habit failed', JSON.stringify(err));
      toast.error('创建失败');
    }
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4" />
              添加习惯
            </Button>
          </DialogTrigger>
          <DialogContent
            className="bg-[hsl(240_6%_8%_/_0.8)] border-white/10 text-zinc-50 backdrop-blur-xl"
          >
            <DialogHeader>
              <DialogTitle>添加新习惯</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">
                  习惯名称 <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：每日阅读"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">
                  图标
                </label>
                <div className="flex flex-wrap gap-2">
                  {HABIT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setForm({ ...form, icon })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                        form.icon === icon
                          ? 'bg-primary/30 border border-primary/50'
                          : 'bg-white/5 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">
                  颜色
                </label>
                <div className="flex flex-wrap gap-2">
                  {HABIT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setForm({ ...form, color })}
                      className={`w-7 h-7 rounded-full transition-all ${
                        form.color === color
                          ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-transparent'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">
                  频率
                </label>
                <Select
                  value={form.frequency}
                  onValueChange={(val) => setForm({ ...form, frequency: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每日</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit}>确认添加</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {habits.length === 0 ? (
          <div
            className="glass-card rounded-2xl p-12 text-center col-span-full"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p className="text-zinc-400">还没有任何习惯，点击右上角添加</p>
          </div>
        ) : (
          habits.map((habit) => (
            <div
              key={habit.id}
              className="glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: habit.color || '#6366f1' }}
                >
                  <span>{habit.icon || '🎯'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-zinc-50">
                    {habit.name}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {habit.frequency === 'daily' ? '每日' : '每周'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs flex items-center gap-1"
                    >
                      <Flame className="w-3 h-3 text-orange-400" />
                      {habit.streakCount} 天
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(habit.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity"
                  aria-label="delete habit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
