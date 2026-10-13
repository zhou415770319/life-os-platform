import React, { useRef, useEffect, useState } from 'react';
import { X, Sparkles, Plug, Send, Square, Copy, RefreshCw, Cog, CheckCircle, XCircle, ShieldCheck, ShieldAlert, Settings2, Menu, Brain, BarChart3, BookMarked, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import type { DeepDataSnapshot, AiMemoryItem } from '@client/src/api/ai-chat';
import type { SuggestedAction, PluginConfig } from '@shared/api.interface';

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
  status: 'pending' | 'success' | 'error';
  result?: unknown;
  errorMessage?: string;
}

export interface PreflightCheckStep {
  step: 'plugin_enabled' | 'method_exists' | 'params_check';
  status: 'pass' | 'fail' | 'info';
  title: string;
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ChatToolCall[];
  preflightChecks?: PreflightCheckStep[];
}

interface ChatPanelProps {
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRegenerate: (messageId: string) => void;
  onCopyMessage: (content: string) => void;
  onClose: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  // AI 深度助手
  deepMode: boolean;
  onToggleDeepMode: () => void;
  deepContext: DeepDataSnapshot | null;
  onAskDeepAnalysis: () => void;
  memories: AiMemoryItem[];
  onAddMemory: (content: string) => void;
  onDeleteMemory: (id: string) => void;
  memorySaving?: boolean;
  /** 助手返回的快捷功能动作（动态渲染，不写死） */
  quickActions?: SuggestedAction[];
  /** 已启用插件（用于输入 @ 时弹出选择器） */
  mentionPlugins?: PluginConfig[];
}

const formatArgs = (args: Record<string, unknown>): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}: ${String(value)}`);
  }
  return parts.length > 0 ? parts.join(', ') : '无参数';
};

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  inputValue,
  isLoading,
  onInputChange,
  onSend,
  onStop,
  onRegenerate,
  onCopyMessage,
  onClose,
  textareaRef,
  onToggleSidebar,
  showSidebarToggle,
  deepMode,
  onToggleDeepMode,
  deepContext,
  onAskDeepAnalysis,
  memories,
  onAddMemory,
  onDeleteMemory,
  memorySaving,
  quickActions,
  mentionPlugins,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<'data' | 'memory' | null>(null);
  const [memoryInput, setMemoryInput] = useState('');
  // @插件名 选择器状态
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  /** 检测输入中是否正在输入 @（光标前最后一个 token 以 @ 开头） */
  const detectMention = (ta: HTMLTextAreaElement) => {
    const pos = ta.selectionStart ?? inputValue.length;
    const before = ta.value.slice(0, pos);
    const m = before.match(/@([\u4e00-\u9fa5A-Za-z0-9_-]*)$/);
    setShowMention(!!m);
    setMentionQuery(m ? m[1] : '');
  };

  /** 选中插件：在光标处插入 @插件名 */
  const handlePickPlugin = (name: string) => {
    const ta = textareaRef?.current;
    const pos = ta?.selectionStart ?? inputValue.length;
    const before = inputValue.slice(0, pos);
    const after = inputValue.slice(pos);
    const stripped = before.replace(/@([\u4e00-\u9fa5A-Za-z0-9_-]*)$/, '');
    const next = `${stripped}@${name} ${after}`;
    onInputChange(next);
    setShowMention(false);
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        const caret = stripped.length + name.length + 2;
        ta.selectionStart = ta.selectionEnd = caret;
      }
    });
  };

  const mentionList = (mentionPlugins ?? []).filter(
    (p) =>
      !mentionQuery ||
      p.name?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      p.pluginKey.toLowerCase().includes(mentionQuery.toLowerCase()),
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && showMention) {
      setShowMention(false);
      return;
    }
    // @ 选择器打开时：回车选中第一个匹配插件，避免误发送「@」
    if (showMention && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mentionList.length > 0) {
        handlePickPlugin(mentionList[0].name || mentionList[0].pluginKey);
      } else {
        setShowMention(false);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setShowMention(false);
      onSend();
    }
  };

  const renderToolCalls = (toolCalls: ChatToolCall[]) => {
    return (
      <div className="mt-2 space-y-2">
        {toolCalls.map((tc) => (
          <div
            key={tc.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-xs"
          >
            {tc.status === 'pending' && (
              <Cog className="w-3.5 h-3.5 text-zinc-500 mt-0.5 animate-spin shrink-0" />
            )}
            {tc.status === 'success' && (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            )}
            {tc.status === 'error' && (
              <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-zinc-300 truncate">
                {tc.status === 'pending' && '正在调用 '}
                {tc.status === 'success' && '调用成功 '}
                {tc.status === 'error' && '调用失败 '}
                <span className="text-indigo-400">{tc.function.name}</span>
              </div>
              <div className="text-zinc-500 truncate mt-0.5">
                {formatArgs(tc.function.arguments)}
              </div>
              {tc.status === 'error' && tc.errorMessage && (
                <div className="text-rose-400 mt-1 break-words">{tc.errorMessage}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPreflightChecks = (checks: PreflightCheckStep[]) => {
    return (
      <div className="mt-2 mb-1 pt-2 border-t border-white/5">
        <div className="text-[11px] text-zinc-500 mb-1.5 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          能力预检
        </div>
        <div className="space-y-1">
          {checks.map((check, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              {check.status === 'pass' && (
                <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
              )}
              {check.status === 'fail' && (
                <XCircle className="w-3 h-3 text-rose-400 mt-0.5 shrink-0" />
              )}
              {check.status === 'info' && (
                <Settings2 className="w-3 h-3 text-zinc-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`font-medium ${
                    check.status === 'pass'
                      ? 'text-emerald-400/90'
                      : check.status === 'fail'
                        ? 'text-rose-400/90'
                        : 'text-zinc-300'
                  }`}
                >
                  {check.title}
                </div>
                {check.detail && (
                  <div className="text-zinc-500 mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {check.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-[480px] max-w-[92vw] h-[calc(100vh-7rem)] max-h-none flex flex-col rounded-2xl rounded-l-none border border-l-0 border-white/10 bg-slate-900/95 backdrop-blur-xl overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          {showSidebarToggle && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors mr-1"
              aria-label="历史会话"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-50">人生系统助手</div>
            <div className="text-xs text-zinc-500">懂你数据的 AI 生活管家</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* AI 深度助手控制条 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-slate-900/60">
        <button
          onClick={onToggleDeepMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            deepMode
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
          }`}
          aria-pressed={deepMode}
          title="开启后 AI 会自动参考你的习惯、专注、浪费时间、目标与任务数据做深度分析"
        >
          <Brain className="w-3.5 h-3.5" />
          深度模式
        </button>
        <button
          onClick={() => setActivePanel(activePanel === 'data' ? null : 'data')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            activePanel === 'data'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
          }`}
          title="查看 AI 正在参考的实时数据"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          我的数据
          {deepContext && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActivePanel(activePanel === 'memory' ? null : 'memory')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            activePanel === 'memory'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
          }`}
          title="管理 AI 长期记住的信息"
        >
          <BookMarked className="w-3.5 h-3.5" />
          记忆
          {memories.length > 0 && (
            <span className="px-1 rounded bg-amber-500/30 text-amber-200 text-[10px]">
              {memories.length}
            </span>
          )}
        </button>
        <div className="ml-auto text-[10px] text-zinc-600">
          {deepMode ? 'AI 已连接你的数据' : '标准模式'}
        </div>
      </div>

      {/* 深度助手面板 */}
      {activePanel === 'data' && (
        <div className="max-h-40 overflow-y-auto px-3 py-2 border-b border-white/5 bg-slate-900/70">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              AI 正在参考的数据（{deepContext?.date ?? '...'}）
            </div>
            <button
              onClick={onAskDeepAnalysis}
              className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
            >
              让 AI 分析 →
            </button>
          </div>
          {deepContext ? (
            <div className="space-y-1 text-xs text-zinc-400">
              <div>✅ 今日打卡 {deepContext.todayCheckIns} 次 · 🍅 {deepContext.pomodoro}</div>
              <div className="text-rose-300/80">⏳ 浪费时间：{deepContext.timeWasted}</div>
              <div className="text-indigo-300/80">🎯 目标：{deepContext.goals.split('\n').slice(0, 2).join(' ')}</div>
              <div className="truncate">📋 待办：{deepContext.openTasks.split('\n').slice(0, 2).join(' ')}</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在加载实时数据…
            </div>
          )}
        </div>
      )}

      {activePanel === 'memory' && (
        <div className="max-h-44 overflow-y-auto px-3 py-2 border-b border-white/5 bg-slate-900/70">
          <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1 mb-1.5">
            <BookMarked className="w-3 h-3" />
            长期记忆（AI 会记住这些信息，跨会话使用）
          </div>
          <div className="flex gap-1.5 mb-2">
            <input
              value={memoryInput}
              onChange={(e) => setMemoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = memoryInput.trim();
                  if (v) {
                    onAddMemory(v);
                    setMemoryInput('');
                  }
                }
              }}
              placeholder="例如：我喜欢在晚上 9 点专注工作"
              className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={() => {
                const v = memoryInput.trim();
                if (v) {
                  onAddMemory(v);
                  setMemoryInput('');
                }
              }}
              disabled={!memoryInput.trim() || memorySaving}
              className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
              aria-label="添加记忆"
            >
              {memorySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
          {memories.length === 0 ? (
            <div className="text-xs text-zinc-600">还没有记忆。可以告诉我你的偏好、目标或重要信息，我会一直记住。</div>
          ) : (
            <div className="space-y-1">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-slate-800/70 border border-white/5 text-xs text-zinc-300"
                >
                  <div className="flex-1 min-w-0 break-words">{m.content}</div>
                  <button
                    onClick={() => onDeleteMemory(m.id)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors shrink-0"
                    aria-label="删除记忆"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`group relative max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600/80 text-white rounded-br-sm'
                  : 'bg-slate-800/90 text-zinc-200 rounded-bl-sm border border-white/10'
              }`}
            >
              {/* 悬停操作：复制 + 重新生成（仅无工具调用的助手消息，避免重复执行插件操作） */}
              <div className="absolute -top-2.5 right-2 hidden group-hover:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => onCopyMessage(msg.content || '')}
                  className="p-1 rounded-md bg-slate-700/90 border border-white/10 text-zinc-300 hover:text-white hover:bg-slate-600/90 transition-colors"
                  title="复制消息"
                  aria-label="复制消息"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {msg.role === 'assistant' &&
                  !msg.toolCalls?.length &&
                  !(isLoading && messages[messages.length - 1]?.id === msg.id) && (
                    <button
                      onClick={() => onRegenerate(msg.id)}
                      className="p-1 rounded-md bg-slate-700/90 border border-white/10 text-zinc-300 hover:text-white hover:bg-slate-600/90 transition-colors"
                      title="重新生成回复"
                      aria-label="重新生成回复"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
              </div>
              {msg.content || (
                <span className="inline-block w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
              )}
              {msg.preflightChecks && msg.preflightChecks.length > 0 && renderPreflightChecks(msg.preflightChecks)}
              {msg.toolCalls && msg.toolCalls.length > 0 && renderToolCalls(msg.toolCalls)}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-xl text-sm bg-slate-800/90 text-zinc-200 rounded-bl-sm border border-white/10">
              <span className="inline-block w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 快捷功能（动态：由助手返回的 suggestedActions 渲染，不写死；单行横向滚动） */}
      <div className="px-3 pt-1 pb-2 flex gap-2 overflow-x-auto flex-nowrap no-scrollbar">
        {quickActions && quickActions.length > 0 ? (
          quickActions.map((a) => (
            <button
              key={a.id}
              onClick={() => onInputChange(a.prompt)}
              className="text-xs px-2 py-1 rounded-md bg-slate-800/80 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/10 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
              title={a.prompt}
            >
              <Plug className="w-3 h-3" />
              {a.label}
            </button>
          ))
        ) : (
          <span className="text-xs text-zinc-600 px-1 py-1">
            试试问我：分析一下我今天的效率
          </span>
        )}
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t border-white/5 relative">
        {/* @插件名 选择器 */}
        {showMention && (
          <div className="absolute bottom-full left-3 right-3 mb-1 max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-slate-800/95 backdrop-blur-xl shadow-xl z-20">
            <div className="px-3 py-1.5 text-[11px] text-zinc-500 border-b border-white/5">
              {mentionList.length > 0 ? '选择要操作的插件（@指定后仅调用该插件方法）' : '没有匹配的插件'}
            </div>
            {mentionList.map((p) => (
              <button
                key={p.pluginKey}
                onClick={() => handlePickPlugin(p.name || p.pluginKey)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Plug className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-200 truncate">{p.name || p.pluginKey}</div>
                  <div className="text-[11px] text-zinc-600 truncate">{p.description || p.pluginKey}</div>
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">{p.pluginKey}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onInput={(e) => detectMention(e.currentTarget)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... 输入 @ 可指定插件 (Enter 发送, Shift+Enter 换行)"
            rows={2}
            className="resize-none text-sm bg-slate-800/80 border-white/10 focus:border-indigo-500/50"
          />
          {isLoading ? (
            <Button
              onClick={onStop}
              size="icon"
              className="shrink-0 bg-rose-500/90 border-0 hover:bg-rose-500 transition-colors"
              title="停止生成"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={!inputValue.trim()}
              size="icon"
              className="shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 border-0 hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
