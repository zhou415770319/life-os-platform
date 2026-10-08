import { useState, useMemo } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Sparkles, Edit3 } from 'lucide-react';
import { notesApi } from '@client/src/api';
import { useConfirmDialog } from '@client/src/hooks/use-confirm-dialog';
import type { LifeNote, CreateNoteDto, UpdateNoteDto } from '@shared/api.interface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import NoteItem from './NoteItem';

interface NotesListTabProps {
  notes: LifeNote[];
  onCreated: (note: LifeNote) => void;
  onUpdated: (note: LifeNote) => void;
  onDeleted: (id: string) => void;
}

export default function NotesListTab({
  notes,
  onCreated,
  onUpdated,
  onDeleted,
}: NotesListTabProps) {
  const { openConfirm, ConfirmDialog } = useConfirmDialog();
  const [quickNote, setQuickNote] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<LifeNote | null>(null);
  const [form, setForm] = useState({ title: '', content: '', tags: '' });

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a: LifeNote, b: LifeNote) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes]);

  const handleQuickNote = async () => {
    const content = quickNote.trim();
    if (!content) return;
    try {
      const note = await notesApi.createNote({ content });
      onCreated(note);
      setQuickNote('');
      toast.success('已记录');
    } catch (err) {
      logger.error('Create quick note failed', JSON.stringify(err));
      toast.error('记录失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickNote();
    }
  };

  const openNewNote = () => {
    setEditingNote(null);
    setForm({ title: '', content: '', tags: '' });
    setDialogOpen(true);
  };

  const openEditNote = (note: LifeNote) => {
    setEditingNote(note);
    setForm({
      title: note.title || '',
      content: note.content,
      tags: note.tags.join(', '),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.content.trim()) {
      toast.error('内容不能为空');
      return;
    }
    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      if (editingNote) {
        const dto: UpdateNoteDto = {
          title: form.title || undefined,
          content: form.content,
          tags,
        };
        const updated = await notesApi.updateNote(editingNote.id, dto);
        onUpdated(updated);
        toast.success('已更新');
      } else {
        const dto: CreateNoteDto = {
          title: form.title || undefined,
          content: form.content,
          tags,
        };
        const created = await notesApi.createNote(dto);
        onCreated(created);
        toast.success('已创建');
      }
      setDialogOpen(false);
    } catch (err) {
      logger.error('Save note failed', JSON.stringify(err));
      toast.error('保存失败');
    }
  };

  const handleRequestDelete = async (id: string) => {
    const ok = await openConfirm({
      title: '确认删除笔记',
      description: '确定要删除这条笔记吗？此操作不可撤销。',
      confirmText: '确认删除',
      variant: 'destructive',
    });
    if (ok) {
      try {
        await notesApi.deleteNote(id);
        onDeleted(id);
        toast.success('已删除');
      } catch (err) {
        logger.error('Delete note failed', JSON.stringify(err));
        toast.error('删除失败');
      }
    }
  };

  const handleTogglePin = async (note: LifeNote) => {
    try {
      const updated = await notesApi.updateNote(note.id, {
        isPinned: !note.isPinned,
      });
      onUpdated(updated);
    } catch (err) {
      logger.error('Toggle pin failed', JSON.stringify(err));
      toast.error('操作失败');
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div
          className="glass-card rounded-2xl p-5"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <Input
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="捕捉每一个闪念，灵感稍纵即逝..."
              className="flex-1 bg-transparent"
            />
            <Button onClick={handleQuickNote} disabled={!quickNote.trim()}>
              记录
            </Button>
          </div>
          <div className="flex justify-end mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={openNewNote}
              className="text-xs text-zinc-500"
            >
              <Edit3 className="w-3 h-3 mr-1" />
              详细编辑
            </Button>
          </div>
        </div>

        {sortedNotes.length === 0 ? (
          <div
            className="glass-card rounded-2xl p-12 text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p className="text-zinc-400">捕捉每一个闪念，灵感稍纵即逝</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedNotes.map((note: LifeNote) => (
              <NoteItem
                key={note.id}
                note={note}
                onEdit={openEditNote}
                onDelete={handleRequestDelete}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="bg-[hsl(240_6%_8%_/_0.9)] border-white/10 text-zinc-50 backdrop-blur-xl"
        >
          <DialogHeader>
            <DialogTitle>{editingNote ? '编辑笔记' : '新建笔记'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">
                标题（可选）
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="给笔记起个标题"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">内容</label>
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm({ ...form, content: e.target.value })
                }
                placeholder="写下你的想法..."
                className="min-h-[120px]"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">
                标签（用逗号分隔）
              </label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="灵感, 工作, 想法"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </>
  );
}
