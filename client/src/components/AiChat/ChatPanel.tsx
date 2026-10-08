import React, { useRef, useEffect, useState } from 'react';
import { X, Sparkles, Plug, CheckCircle2, Send, Cog, CheckCircle, XCircle, ShieldCheck, ShieldAlert, Settings2, Menu, Brain, BarChart3, BookMarked, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import type { DeepDataSnapshot, AiMemoryItem } from '@client/src/api/ai-chat';

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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<'data' | 'memory' | null>(null);
  const [memoryInput, setMemoryInput] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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
    <div className="w-[380px] h-[520px] max-h-[80vh] flex flex-col rounded-2xl rounded-l-none border border-l-0 border-white/10 bg-slate-900/95 backdrop-blur-xl overflow-hidden">
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
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600/80 text-white rounded-br-sm'
                  : 'bg-slate-800/90 text-zinc-200 rounded-bl-sm border border-white/10'
              }`}
            >
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

      {/* 快捷指令 */}
      <div className="px-3 pt-1 pb-2 flex gap-2 flex-wrap">
        <button
          onClick={() => onInputChange('安装儿童资料站插件')}
          className="text-xs px-2 py-1 rounded-md bg-slate-800/80 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/10 transition-colors flex items-center gap-1"
        >
          <Plug className="w-3 h-3" />
          安装儿童资料站
        </button>
        <button
          onClick={() => onInputChange('安装 RPA 创作中心插件')}
          className="text-xs px-2 py-1 rounded-md bg-slate-800/80 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/10 transition-colors flex items-center gap-1"
        >
          <CheckCircle2 className="w-3 h-3" />
          安装 RPA 插件
        </button>
        <button
          onClick={() => onInputChange('在儿童资料站中添加一个 RAZ AA 级资料')}
          className="text-xs px-2 py-1 rounded-md bg-slate-800/80 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/10 transition-colors"
        >
          添加 RAZ 资料
        </button>
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={2}
            className="resize-none text-sm bg-slate-800/80 border-white/10 focus:border-indigo-500/50"
          />
          <Button
            onClick={onSend}
            disabled={isLoading || !inputValue.trim()}
            size="icon"
            className="shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 border-0 hover:opacity-90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
