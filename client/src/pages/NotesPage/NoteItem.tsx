import { Pin, Edit3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@client/src/utils/date';
import type { LifeNote } from '@shared/api.interface';

interface NoteItemProps {
  note: LifeNote;
  onEdit: (note: LifeNote) => void;
  onDelete: (id: string) => void;
  onTogglePin: (note: LifeNote) => void;
}

export default function NoteItem({ note, onEdit, onDelete, onTogglePin }: NoteItemProps) {
  return (
    <div
      className={`glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group relative`}
      style={{
        background: note.isPinned
          ? 'rgba(251, 191, 36, 0.05)'
          : 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        border: note.isPinned
          ? '1px solid rgba(251, 191, 36, 0.2)'
          : '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {note.isPinned && (
        <div className="absolute top-3 right-3">
          <Pin className="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>
      )}
      <div className="pr-8">
        {note.title && (
          <h4 className="font-semibold text-zinc-50 mb-2">
            {note.title}
          </h4>
        )}
        <p className="text-sm text-zinc-300 line-clamp-4 whitespace-pre-wrap break-words">
          {note.content}
        </p>
      </div>
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {note.tags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <span className="text-xs text-zinc-500">
          {formatRelativeTime(note.createdAt)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onTogglePin(note)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-white/5"
            aria-label="toggle pin"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-400 hover:bg-white/5"
            aria-label="edit note"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-white/5"
            aria-label="delete note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
