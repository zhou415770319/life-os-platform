import { useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Plus, Trash2, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { notesApi } from '@client/src/api';
import { useConfirmDialog } from '@client/src/hooks/use-confirm-dialog';
import type { QuickLink, CreateQuickLinkDto } from '@shared/api.interface';
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

const CATEGORIES = ['工作', '生活', '学习', '灵感', '其他'];
const LINK_ICONS = [
  '🌐', '📝', '🎨', '📊', '🎵', '🎬', '📚', '💻', '⚡', '🔧',
];

interface QuickLinksTabProps {
  links: QuickLink[];
  onCreated: (link: QuickLink) => void;
  onDeleted: (id: string) => void;
}

export default function QuickLinksTab({
  links,
  onCreated,
  onDeleted,
}: QuickLinksTabProps) {
  const { openConfirm, ConfirmDialog } = useConfirmDialog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateQuickLinkDto>({
    title: '',
    url: '',
    icon: '🌐',
    category: '工作',
  });

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      toast.error('标题和 URL 不能为空');
      return;
    }
    const trimmedUrl = form.url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      toast.error('URL 必须以 http:// 或 https:// 开头');
      return;
    }
    try {
      const created = await notesApi.createQuickLink({
        ...form,
        url: trimmedUrl,
      });
      onCreated(created);
      setDialogOpen(false);
      setForm({ title: '', url: '', icon: '🌐', category: '工作' });
      toast.success('链接已添加');
    } catch (err) {
      logger.error('Create quick link failed', JSON.stringify(err));
      toast.error('创建失败');
    }
  };

  const handleRequestDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await openConfirm({
      title: '确认删除链接',
      description: '确定要删除这个快速链接吗？此操作不可撤销。',
      confirmText: '确认删除',
      variant: 'destructive',
    });
    if (ok) {
      try {
        await notesApi.deleteQuickLink(id);
        onDeleted(id);
        toast.success('已删除');
      } catch (err) {
        logger.error('Delete quick link failed', JSON.stringify(err));
        toast.error('删除失败');
      }
    }
  };

  const handleOpen = (url: string) => {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (newWindow) newWindow.opener = null;
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4" />
              添加链接
            </Button>
          </DialogTrigger>
          <DialogContent
            className="bg-[hsl(240_6%_8%_/_0.9)] border-white/10 text-zinc-50 backdrop-blur-xl"
          >
            <DialogHeader>
              <DialogTitle>添加快速链接</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">标题</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="链接名称"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">URL</label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">图标</label>
                <div className="flex flex-wrap gap-2">
                  {LINK_ICONS.map((icon) => (
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

      {links.length === 0 ? (
        <div
          className="glass-card rounded-2xl p-12 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <LinkIcon className="w-10 h-10 text-indigo-400/60 mx-auto mb-3" />
          <p className="text-zinc-400">还没有快速链接，添加常用网站吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {links.map((link: QuickLink) => (
            <div
              key={link.id}
              className="glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer group relative"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
              onClick={() => handleOpen(link.url)}
            >
              <button
                onClick={(e) => handleRequestDelete(link.id, e)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity z-10"
                aria-label="delete link"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="text-3xl mb-3">{link.icon || '🌐'}</div>
              <h4 className="font-semibold text-zinc-50 mb-1 flex items-center gap-1.5">
                {link.title}
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-500 truncate">{link.url}</p>
              {link.category && (
                <Badge variant="outline" className="text-xs mt-3">
                  {link.category}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {ConfirmDialog}
    </>
  );
}
