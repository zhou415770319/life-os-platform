import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { pluginsApi, aiChatApi } from '@client/src/api';
import type { DeepDataSnapshot, AiMemoryItem } from '@client/src/api/ai-chat';
import ChatPanel from './ChatPanel';
import SessionSidebar from './SessionSidebar';
import type { ChatMessage, ChatToolCall, PreflightCheckStep } from './ChatPanel';
import { detectPluginIntent } from './plugin-intent';
import type { AiChatSession, AiChatSessionMessage, SuggestedAction, PluginConfig } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const PLUGIN_CHILD_KEY = 'dsh-plugin-child-resources';
const PLUGIN_RPA_KEY = 'dsh-plugin-wechat-rpa';
const WELCOME_CONTENT =
  '你好！我是人生系统助手，你的 AI 生活管家 ✨\n\n' +
  '📊 我能基于你的真实数据做深度分析（习惯打卡、番茄专注、浪费时间、目标进度、任务），随时问我："分析一下我今天的效率"、"我这周状态怎么样"\n\n' +
  '🧠 长期记忆：告诉我你的偏好和目标（如"我晚上9点效率最高"），我会一直记住并在建议中体现\n\n' +
  '🔌 插件操作：用自然语言驱动插件，试试说"在儿童资料站添加一个 RAZ AA 级资料"\n\n' +
  '💬 历史会话：点击左上角菜单可查看、回显并继续之前的对话\n\n有什么我可以帮你的吗？';

const sessionMsgToChatMsg = (m: AiChatSessionMessage): ChatMessage => ({
  id: m.id,
  role: m.role,
  content: m.content,
  // 防御：历史消息字段可能为 JSON 字符串或非法值，仅保留真正的数组，避免渲染报错
  toolCalls:
    Array.isArray(m.toolCalls) && m.toolCalls.length > 0
      ? (m.toolCalls as ChatToolCall[])
      : undefined,
  preflightChecks:
    Array.isArray(m.preflightChecks) && m.preflightChecks.length > 0
      ? (m.preflightChecks as PreflightCheckStep[])
      : undefined,
});

const AiChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [quickActions, setQuickActions] = useState<SuggestedAction[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 实时消息引用：初始化加载最近会话时避免覆盖事件唤起（life-os:ai-chat:send）已填充的对话
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // 当前生成中 assistant 消息 id 与取消控制器（用于「停止生成」）
  const currentAssistantIdRef = useRef<string | null>(null);
  const stopControllerRef = useRef<AbortController | null>(null);
  // AI 深度助手
  const [deepMode, setDeepMode] = useState(true);
  const [deepContext, setDeepContext] = useState<DeepDataSnapshot | null>(null);
  const [memories, setMemories] = useState<AiMemoryItem[]>([]);
  const [memorySaving, setMemorySaving] = useState(false);
  // @插件名：已启用插件列表（用于 @ 选择器）
  const [mentionPlugins, setMentionPlugins] = useState<PluginConfig[]>([]);

  const loadPlugins = useCallback(async () => {
    try {
      const data = await pluginsApi.getPlugins();
      setMentionPlugins(data.items.filter((p) => p.enabled));
    } catch (err) {
      logger.error('Failed to load plugins for mention', { error: String(err) });
    }
  }, []);

  /** 从输入文本解析 @插件名 → targetPluginKey（找不到则自然语言兜底） */
  const parseMention = useCallback(
    (text: string): string | undefined => {
      const m = text.match(/@([\u4e00-\u9fa5A-Za-z0-9_-]+)/);
      if (!m) return undefined;
      const token = m[1];
      const found = mentionPlugins.find(
        (p) =>
          p.name === token ||
          p.pluginKey === token ||
          (p.name && p.name.includes(token)) ||
          p.pluginKey.includes(token),
      );
      return found?.pluginKey;
    },
    [mentionPlugins],
  );

  const loadDeepContext = useCallback(async () => {
    try {
      const snapshot = await aiChatApi.getDeepContext();
      setDeepContext(snapshot);
    } catch (err) {
      logger.error('Failed to load deep context', { error: String(err) });
    }
  }, []);

  const loadMemories = useCallback(async () => {
    try {
      const res = await aiChatApi.getMemories();
      setMemories(res.items);
    } catch (err) {
      logger.error('Failed to load memories', { error: String(err) });
    }
  }, []);

  const handleAddMemory = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      setMemorySaving(true);
      try {
        const item = await aiChatApi.addMemory(content, 'other');
        setMemories((prev) => [item, ...prev]);
        toast.success('已记住这条信息');
      } catch (err) {
        logger.error('Failed to add memory', { error: String(err) });
        toast.error('保存记忆失败');
      } finally {
        setMemorySaving(false);
      }
    },
    [],
  );

  const handleDeleteMemory = useCallback(async (id: string) => {
    try {
      await aiChatApi.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success('已删除记忆');
    } catch (err) {
      logger.error('Failed to delete memory', { error: String(err) });
      toast.error('删除失败');
    }
  }, []);

  const handleAskDeepAnalysis = useCallback(() => {
    setInputValue('基于我的数据，给我今天的洞察、发现和建议');
    textareaRef.current?.focus();
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const res = await aiChatApi.getSessions();
      setSessions(res.items);
    } catch (err) {
      logger.error('Failed to load chat sessions', { error: String(err) });
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await aiChatApi.getSessionMessages(sessionId);
      setQuickActions([]); // 历史会话不附带快捷功能建议
      if (res.items.length > 0) {
        setMessages(res.items.map(sessionMsgToChatMsg));
      } else {
        setMessages([
          { id: 'welcome', role: 'assistant', content: WELCOME_CONTENT },
        ]);
      }
      setActiveSessionId(sessionId);
    } catch (err) {
      logger.error('Failed to load session messages', { error: String(err) });
      toast.error('加载会话失败');
    }
  }, []);

  // 打开助手：默认加载最近一条历史会话（无会话则显示欢迎语）
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await aiChatApi.getSessions();
        if (cancelled) return;
        setSessions(res.items);
        // 事件唤起（life-os:ai-chat:send）已填充对话时，不覆盖
        if (messagesRef.current.length > 0) return;
        if (res.items.length > 0) {
          const latest = res.items[0];
          setActiveSessionId(latest.id);
          const msgs = await aiChatApi.getSessionMessages(latest.id);
          if (cancelled || messagesRef.current.length > 0) return;
          setMessages(
            msgs.items.length > 0
              ? msgs.items.map(sessionMsgToChatMsg)
              : [{ id: 'welcome', role: 'assistant', content: WELCOME_CONTENT }],
          );
        } else {
          setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME_CONTENT }]);
        }
      } catch (err) {
        logger.error('Failed to init chat sessions', { error: String(err) });
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadDeepContext();
      loadMemories();
      loadPlugins();
    }
  }, [isOpen, loadDeepContext, loadMemories, loadPlugins]);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME_CONTENT }]);
    setQuickActions([]);
    setShowSidebar(false);
    setInputValue('');
    textareaRef.current?.focus();
  }, []);

  const handleSelectSession = useCallback(
    async (id: string) => {
      setShowSidebar(false);
      if (id === activeSessionId) return;
      await loadSessionMessages(id);
    },
    [activeSessionId, loadSessionMessages],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      if (!await showConfirm('确定删除该会话吗？')) return;
      try {
        await aiChatApi.deleteSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          handleNewSession();
        }
        toast.success('已删除会话');
      } catch (err) {
        logger.error('Failed to delete session', { error: String(err) });
        toast.error('删除失败');
      }
    },
    [activeSessionId, handleNewSession],
  );

  const findPluginId = useCallback(async (pluginKey: string): Promise<string | null> => {
    try {
      const data = await pluginsApi.getPlugins();
      const found = data.items.find((p) => p.pluginKey === pluginKey);
      return found?.id ?? null;
    } catch (err) {
      logger.error('Failed to fetch plugins for plugin toggle', { error: String(err) });
      return null;
    }
  }, []);

  const togglePlugin = useCallback(
    async (plugin: 'child' | 'rpa', enable: boolean): Promise<boolean> => {
      const pluginKey = plugin === 'child' ? PLUGIN_CHILD_KEY : PLUGIN_RPA_KEY;
      const pluginName = plugin === 'child' ? '儿童资料站插件' : 'RPA 创作中心插件';
      const id = await findPluginId(pluginKey);
      if (!id) {
        toast.error(`未找到${pluginName}`);
        return false;
      }
      try {
        await pluginsApi.updatePlugin(id, { enabled: enable });
        toast.success(`${enable ? '已启用' : '已禁用'}${pluginName}`);
        return true;
      } catch (err) {
        logger.error('Failed to toggle plugin', { error: String(err) });
        toast.error(`操作失败：${pluginName}`);
        return false;
      }
    },
    [findPluginId],
  );

  /** 核心：请求 AI 回复并更新指定 assistant 消息（发送与重新生成共用） */
  const requestAssistantReply = useCallback(
    async (
      history: { role: 'user' | 'assistant'; content: string }[],
      assistantId: string,
      targetPluginKey?: string,
    ) => {
      setIsLoading(true);
      currentAssistantIdRef.current = assistantId;
      const controller = new AbortController();
      stopControllerRef.current = controller;
      try {
        const response = await aiChatApi.chat(
          {
            messages: history,
            sessionId: activeSessionId ?? undefined,
            deepMode,
            targetPluginKey,
          },
          controller.signal,
        );

        const toolCalls: ChatToolCall[] = response.toolCalls
          ? response.toolCalls.map((tc) => ({
              id: tc.id,
              type: tc.type,
              function: tc.function,
              status: tc.status,
              result: tc.result,
              errorMessage: tc.errorMessage,
            }))
          : [];

        const preflightChecks: PreflightCheckStep[] | undefined = response.preflightChecks;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: response.reply,
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                  preflightChecks:
                    preflightChecks && preflightChecks.length > 0 ? preflightChecks : undefined,
                }
              : m,
          ),
        );

        // 助手返回的快捷功能（动态渲染，不写死）
        if (Array.isArray(response.suggestedActions) && response.suggestedActions.length > 0) {
          setQuickActions(response.suggestedActions);
        }

        if (response.sessionId) {
          if (!activeSessionId) {
            setActiveSessionId(response.sessionId);
            loadSessions();
          } else {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === response.sessionId
                  ? { ...s, updatedAt: new Date().toISOString() }
                  : s,
              ),
            );
          }
        }

        if (toolCalls.some((tc) => tc.status === 'success')) {
          window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
        }
      } catch (err) {
        // 用户主动停止生成：保留已标记的「已停止」内容，不当作错误
        const isCanceled =
          (err as { code?: string })?.code === 'ERR_CANCELED' ||
          (err as { name?: string })?.name === 'CanceledError' ||
          (err as { message?: string })?.message?.includes('canceled');
        if (isCanceled) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || '⏹ 已停止生成。可点击消息上的「重新生成」继续。' }
                : m,
            ),
          );
          return;
        }
        logger.error('AI chat error', { error: String(err) });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: '⚠️ 抱歉，AI 服务暂时不可用，请稍后再试。' }
              : m,
          ),
        );
        toast.error('AI 对话失败');
      } finally {
        setIsLoading(false);
        stopControllerRef.current = null;
      }
    },
    [activeSessionId, loadSessions, deepMode],
  );

  const sendMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    const intent = detectPluginIntent(text);
    if (intent.action && intent.plugin) {
      const enable = intent.action === 'install';
      const success = await togglePlugin(intent.plugin, enable);
      const pluginName = intent.plugin === 'child' ? '儿童资料站插件' : 'RPA 创作中心插件';
      const replyContent = success
        ? `✅ 已${enable ? '启用' : '禁用'}${pluginName}。\n\n导航栏已同步更新，你可以在左侧菜单中找到新入口。`
        : `⚠️ ${pluginName}操作失败，请稍后重试。`;
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: replyContent },
      ]);
      setIsLoading(false);
      if (success) {
        window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
      }
      return;
    }

    const historyMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    const targetPluginKey = parseMention(text);
    await requestAssistantReply(
      [...historyMessages, { role: 'user', content: text }],
      assistantId,
      targetPluginKey,
    );
  }, [isLoading, messages, togglePlugin, requestAssistantReply, parseMention]);

  /** 停止当前生成中的回复 */
  const handleStop = useCallback(() => {
    const controller = stopControllerRef.current;
    if (controller) {
      controller.abort();
    } else {
      // 无进行中请求时兜底：将生成中的空消息标记为已停止
      const id = currentAssistantIdRef.current;
      if (id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id && !m.content
              ? { ...m, content: '⏹ 已停止生成。可点击消息上的「重新生成」继续。' }
              : m,
          ),
        );
      }
      setIsLoading(false);
    }
  }, []);

  /** 重新生成指定 assistant 消息（仅无工具调用的消息，避免重复执行插件操作） */
  const handleRegenerate = useCallback(
    async (assistantId: string) => {
      if (isLoading) return;
      const idx = messages.findIndex((m) => m.id === assistantId);
      if (idx <= 0) return;
      const userMsg = messages[idx - 1];
      if (userMsg.role !== 'user') return;

      const history = messages
        .slice(0, idx - 1)
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: '', toolCalls: undefined, preflightChecks: undefined }
            : m,
        ),
      );
      await requestAssistantReply(
        [...history, { role: 'user', content: userMsg.content }],
        assistantId,
      );
    },
    [isLoading, messages, requestAssistantReply],
  );

  /** 复制消息内容 */
  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('已复制到剪贴板');
    } catch (err) {
      logger.error('Copy message failed', { error: String(err) });
      toast.error('复制失败');
    }
  }, []);

  const handleSend = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  // 全局事件：其他页面（如插件中心「提交到市场」）可唤起聊天框并自动发送消息
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text ?? '';
      if (!text.trim()) return;
      setIsOpen(true);
      sendMessage(text);
    };
    window.addEventListener('life-os:ai-chat:send', handler);
    return () => window.removeEventListener('life-os:ai-chat:send', handler);
  }, [sendMessage]);

  const handleClose = () => {
    setIsOpen(false);
    setShowSidebar(false);
    // 关闭即重置会话状态：下次打开默认加载最近一条历史会话
    setMessages([]);
    setActiveSessionId(null);
    setQuickActions([]);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 hover:scale-110 transition-transform duration-300 animate-glow-pulse"
        aria-label="AI 助手"
      >
        <Sparkles className="w-6 h-6 text-white" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex animate-slide-up-fade">
          {showSidebar && (
            <div className="w-48 rounded-l-2xl border border-r-0 border-white/10 bg-slate-900/95 backdrop-blur-xl overflow-hidden">
              <SessionSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelect={handleSelectSession}
                onNew={handleNewSession}
                onDelete={handleDeleteSession}
                onClose={() => setShowSidebar(false)}
                isLoading={sessionsLoading}
              />
            </div>
          )}
          <ChatPanel
            messages={messages}
            inputValue={inputValue}
            isLoading={isLoading}
            onInputChange={setInputValue}
            onSend={handleSend}
            onStop={handleStop}
            onRegenerate={handleRegenerate}
            onCopyMessage={handleCopyMessage}
            onClose={handleClose}
            textareaRef={textareaRef}
            onToggleSidebar={() => setShowSidebar((v) => !v)}
            showSidebarToggle
            deepMode={deepMode}
            onToggleDeepMode={() => setDeepMode((v) => !v)}
            deepContext={deepContext}
            onAskDeepAnalysis={handleAskDeepAnalysis}
            memories={memories}
            onAddMemory={handleAddMemory}
            onDeleteMemory={handleDeleteMemory}
            memorySaving={memorySaving}
            quickActions={quickActions}
            mentionPlugins={mentionPlugins}
          />
        </div>
      )}
    </>
  );
};

export default AiChat;
