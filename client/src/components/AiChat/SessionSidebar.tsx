import React from 'react';
import { Plus, MessageSquare, Trash2, ChevronLeft } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';

export interface ChatSessionItem {
  id: string;
  title: string;
  updatedAt: string;
}

interface SessionSidebarProps {
  sessions: ChatSessionItem[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weeks[d.getDay()];
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  isLoading,
}) => {
  return (
    <div className="flex flex-col h-full bg-black/20 border-r border-white/5">
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          aria-label="返回"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-zinc-400">历史会话</span>
        <button
          onClick={onNew}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          aria-label="新建会话"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20 text-xs text-zinc-500">
            加载中...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-xs text-zinc-500 px-4 text-center">
            <MessageSquare className="w-6 h-6 text-zinc-600" />
            <span>暂无历史会话</span>
          </div>
        ) : (
          <div className="py-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-2 py-2 mx-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeSessionId === s.id
                    ? 'bg-indigo-500/20 text-zinc-100'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
                onClick={() => onSelect(s.id)}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs truncate">{s.title || '新对话'}</div>
                  <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {formatTime(s.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-rose-400 transition-all"
                  aria-label="删除会话"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-white/5">
        <Button
          onClick={onNew}
          variant="outline"
          size="sm"
          className="w-full text-xs border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新对话
        </Button>
      </div>
    </div>
  );
};

export default SessionSidebar;
