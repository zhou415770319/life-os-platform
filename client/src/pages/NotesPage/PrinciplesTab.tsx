import { useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Plus, Trash2, Lightbulb, BookOpen } from 'lucide-react';
import { notesApi } from '@client/src/api';
import { useConfirmDialog } from '@client/src/hooks/use-confirm-dialog';
import type { LifePrinciple, CreatePrincipleDto } from '@shared/api.interface';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = ['人生原则', '工作方法', '认知升级', '财富思维', '健康生活'];

interface PrinciplesTabProps {
  principles: LifePrinciple[];
  onCreated: (p: LifePrinciple) => void;
  onDeleted: (id: string) => void;
}

export default function PrinciplesTab({
  principles,
  onCreated,
  onDeleted,
}: PrinciplesTabProps) {
  const { openConfirm, ConfirmDialog } = useConfirmDialog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreatePrincipleDto>({
    title: '',
    content: '',
    category: '人生原则',
  });

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('标题和内容不能为空');
      return;
    }
    try {
      const created = await notesApi.createPrinciple(form);
      onCreated(created);
      setDialogOpen(false);
      setForm({ title: '', content: '', category: '人生原则' });
      toast.success('原则已添加');
    } catch (err) {
      logger.error('Create principle failed', JSON.stringify(err));
      toast.error('创建失败');
    }
  };

  const handleRequestDelete = async (id: string) => {
    const ok = await openConfirm({
      title: '确认删除原则',
      description: '确定要删除这条人生原则吗？此操作不可撤销。',
      confirmText: '确认删除',
      variant: 'destructive',
    });
    if (ok) {
      try {
        await notesApi.deletePrinciple(id);
        onDeleted(id);
        toast.success('已删除');
      } catch (err) {
        logger.error('Delete principle failed', JSON.stringify(err));
        toast.error('删除失败');
      }
    }
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4" />
              添加原则
            </Button>
          </DialogTrigger>
          <DialogContent
            className="bg-[hsl(240_6%_8%_/_0.9)] border-white/10 text-zinc-50 backdrop-blur-xl"
          >
            <DialogHeader>
              <DialogTitle>添加人生原则</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">标题</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="原则标题"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">内容</label>
                <Textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                  placeholder="详细描述这条原则..."
                  className="min-h-[100px]"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">分类</label>
                <Select
                  value={form.category || ''}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
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

      {principles.length === 0 ? (
        <div
          className="glass-card rounded-2xl p-12 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Lightbulb className="w-10 h-10 text-amber-400/60 mx-auto mb-3" />
          <p className="text-zinc-400">
            还没有任何原则，开始构建你的人生原则体系吧
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {principles.map((p: LifePrinciple) => (
            <div
              key={p.id}
              className="glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.01] group"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <BookOpen className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <h4 className="font-semibold text-zinc-50">{p.title}</h4>
                    {p.category && (
                      <Badge variant="outline" className="text-xs">
                        {p.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed pl-7">
                    {p.content}
                  </p>
                </div>
                <button
                  onClick={() => handleRequestDelete(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity flex-shrink-0"
                  aria-label="delete principle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {ConfirmDialog}
    </>
  );
}
