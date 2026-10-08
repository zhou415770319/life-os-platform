import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileDown,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  reviewBoardApi,
  type BoardLevel,
  type BoardView,
  type ReviewBoardItem,
  type ReviewBoardPublish,
  type ReviewBoardShare,
} from '@client/src/api/review-board';
import { htmlToMarkdown, markdownToHtml } from '@client/src/utils/md';
import { Card, CardContent } from '@client/src/components/ui/card';
import BackgroundGlow from '@client/src/components/ui/background-glow';

// ===== 工具 =====

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(weekNo)}`;
}

function weekKeyRangeLabel(weekKey: string): string {
  const [y, w] = weekKey.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() + (w - 1) * 7 - (dayNum - 4));
  const end = new Date(jan4);
  end.setUTCDate(end.getUTCDate() + 6);
  const f = (x: Date) => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  return `${f(jan4)} ~ ${f(end)}`;
}

function monthRangeLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-01 ~ ${monthKey}-${pad(last)}`;
}

function keyFor(level: BoardLevel, dateStr: string): string {
  if (level === 'daily') return dateStr;
  if (level === 'weekly') return isoWeekKey(new Date(`${dateStr}T00:00:00`));
  return dateStr.slice(0, 7);
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const LEVEL_TABS: { level: BoardLevel; label: string; hint: string }[] = [
  { level: 'daily', label: '每日面板', hint: '每天记录，按日期归档到周' },
  { level: 'weekly', label: '每周面板', hint: '汇总本周每日归档' },
  { level: 'monthly', label: '每月面板', hint: '每周日归档周数据' },
];

// ===== 子组件：任务列表 =====

function TaskList({
  items,
  editable,
  onToggle,
}: {
  items: ReviewBoardItem[];
  editable: boolean;
  onToggle: (item: ReviewBoardItem) => void;
}) {
  if (items.length === 0) {
    return <div className="text-sm text-zinc-600 py-6 text-center">暂无任务，在编辑区用 `- [ ] 任务名` 添加</div>;
  }
  return (
    <div className="space-y-1">
      {items.map((it) => (
        <button
          key={it.id}
          disabled={!editable}
          onClick={() => onToggle(it)}
          className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
            editable ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
          }`}
        >
          <span
            className={`mt-0.5 inline-flex h-4.5 w-4.5 flex-none items-center justify-center rounded ${
              it.done ? 'bg-emerald-500/90 text-emerald-950' : 'border border-zinc-600'
            }`}
          >
            {it.done && <CheckCircle2 className="h-3.5 w-3.5" />}
          </span>
          <span className="flex-1 text-sm">
            <span className={it.done ? 'line-through text-zinc-500' : 'text-zinc-200'}>{it.text}</span>
            {it.doneAt && (
              <span className="ml-2 text-[11px] text-emerald-500/90">✓ {formatTime(it.doneAt)} 完成</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

// ===== 主页面 =====

const ReviewBoardPage = () => {
  const [level, setLevel] = useState<BoardLevel>('daily');
  const [dateStr, setDateStr] = useState<string>(todayKey());
  const [view, setView] = useState<BoardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState<boolean>(true);
  const [draft, setDraft] = useState<string>('');
  const [archiving, setArchiving] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [shares, setShares] = useState<ReviewBoardShare[]>([]);
  const [publishes, setPublishes] = useState<ReviewBoardPublish[]>([]);
  const [selectedPublishIds, setSelectedPublishIds] = useState<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const panelKey = useMemo(() => keyFor(level, dateStr), [level, dateStr]);

  const loadView = useCallback(async (lv: BoardLevel, k: string) => {
    setLoading(true);
    try {
      const v = await reviewBoardApi.getView(lv, k);
      setView(v);
      setDraft(v.panel.content ?? '');
    } catch (e) {
      logger.error('加载复盘面板失败', e);
      toast.error('加载复盘面板失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初次挂载：自动归档兜底 + 加载今日
  useEffect(() => {
    reviewBoardApi.autoArchive().catch(() => undefined);
    loadView('daily', todayKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换面板：flush 未保存草稿 + 加载对应视图
  useEffect(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (dirtyRef.current) {
      // 切换时立即保存上一个面板
      void flushSave(level, panelKey);
    }
    void loadView(level, panelKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, dateStr]);

  async function flushSave(lv: BoardLevel, k: string) {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    try {
      await reviewBoardApi.savePanel(lv, k, draft);
    } catch (e) {
      logger.error('保存复盘面板失败', e);
    }
  }

  function scheduleSave(lv: BoardLevel, k: string, content: string) {
    dirtyRef.current = true;
    setDraft(content);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        try {
          await reviewBoardApi.savePanel(lv, k, content);
          const v = await reviewBoardApi.getView(lv, k);
          setView(v);
          setDraft(v.panel.content ?? '');
        } catch (e) {
          logger.error('自动保存失败', e);
          toast.error('自动保存失败，请检查服务');
        }
      })();
    }, 800);
  }

  async function handleToggle(item: ReviewBoardItem) {
    if (!view) return;
    try {
      await reviewBoardApi.toggleItem(level, panelKey, item.id, !item.done);
      // 重新拉取完整视图，刷新统计与归档明细
      const v = await reviewBoardApi.getView(level, panelKey);
      setView(v);
      setDraft(v.panel.content ?? draft);
    } catch (e) {
      logger.error('勾选失败', e);
      toast.error('勾选失败');
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await reviewBoardApi.archive(level, panelKey);
      toast.success(res.message);
      await loadView(level, panelKey);
    } catch (e) {
      logger.error('归档失败', e);
      toast.error('归档失败');
    } finally {
      setArchiving(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain');
    if (!html || !text) return; // 纯文本粘贴交给默认行为
    e.preventDefault();
    const md = htmlToMarkdown(html) || text;
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = draft.slice(0, start) + md + draft.slice(end);
    scheduleSave(level, panelKey, next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + md.length;
      ta.focus();
    });
    toast.success('已粘贴并转换为 Markdown');
  }

  // 分享 / 发布
  async function loadShareData() {
    try {
      const [s, p] = await Promise.all([reviewBoardApi.getShares(), reviewBoardApi.getPublishes()]);
      setShares(s);
      setPublishes(p);
    } catch (e) {
      logger.error('加载分享数据失败', e);
    }
  }

  async function handleCreateShare(mode: 'view' | 'edit') {
    try {
      const share = await reviewBoardApi.createShare(level, panelKey, mode);
      await loadShareData();
      const url = `${window.location.origin}/api/review-board/share/${share.token}`;
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      toast.success(mode === 'view' ? '只读链接已生成并复制' : '可编辑链接已生成并复制');
    } catch (e) {
      logger.error('生成分享链接失败', e);
      toast.error('生成分享链接失败');
    }
  }

  async function handleExport(mode: 'view' | 'edit') {
    try {
      // 发布前确保草稿已落盘，否则后端读到旧数据、生成的包还是旧内容
      if (dirtyRef.current) {
        dirtyRef.current = false;
        try {
          await reviewBoardApi.savePanel(level, panelKey, draft);
        } catch (e) {
          logger.error('发布前保存失败', e);
        }
      }
      const pub = await reviewBoardApi.exportPublish(level, panelKey, mode);
      await loadShareData();
      toast.success(`发布包已生成：${pub.fileName}`);
    } catch (e) {
      logger.error('生成发布包失败', e);
      toast.error('生成发布包失败');
    }
  }

  async function handleDeletePublishes(ids: string[]) {
    if (!ids.length) return;
    try {
      const res = await reviewBoardApi.deletePublishes(ids);
      await loadShareData();
      setSelectedPublishIds([]);
      toast.success(`已删除 ${res.deleted} 条发布记录`);
    } catch (e) {
      logger.error('删除发布记录失败', e);
      toast.error('删除发布记录失败');
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    toast.success(`${label}已复制`);
  }

  const rangeLabel =
    level === 'weekly' ? weekKeyRangeLabel(panelKey) : level === 'monthly' ? monthRangeLabel(panelKey) : panelKey;

  const allItems = view
    ? level === 'daily'
      ? view.panel.items
      : view.panel.sections.flatMap((s) => s.items)
    : [];

  return (
    <div className="min-h-full p-4 md:p-8">
      <BackgroundGlow variant="page" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
            <ClipboardList className="h-6 w-6 text-emerald-400" />
            复盘面板
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Markdown 复盘 · 每日归档到周 · 每周日归档到月 · 可发布分享
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            立即归档
          </button>
          <button
            onClick={() => {
              setShowShare(true);
              void loadShareData();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10"
          >
            <Share2 className="h-4 w-4" />
            分享链接
          </button>
          <button
            onClick={() => {
              setShowPublish(true);
              void loadShareData();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Globe className="h-4 w-4" />
            发布
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {LEVEL_TABS.map((t) => (
          <button
            key={t.level}
            onClick={() => setLevel(t.level)}
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              level === t.level
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 border border-transparent hover:bg-white/5 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(`${dateStr}T00:00:00`);
              d.setDate(d.getDate() - 1);
              setDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
          >
            ‹
          </button>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => e.target.value && setDateStr(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 [color-scheme:dark]"
          />
          <button
            onClick={() => {
              const d = new Date(`${dateStr}T00:00:00`);
              d.setDate(d.getDate() + 1);
              setDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
          >
            ›
          </button>
          <button
            onClick={() => setDateStr(todayKey())}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
          >
            今天
          </button>
        </div>
      </div>

      {/* 范围与统计 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-zinc-300">
          <Calendar className="h-3.5 w-3.5 text-emerald-400" />
          {rangeLabel}
        </span>
        {view && (
          <span className="text-zinc-500">
            已完成 <b className="text-emerald-400">{view.doneCount}</b> / {view.totalCount} 项
          </span>
        )}
        {view?.panel.archivedAt && (
          <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500">
            <Archive className="h-3 w-3" />
            {formatTime(view.panel.archivedAt)} 已归档
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex h-[50vh] items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-400" />
          加载中...
        </div>
      ) : !view ? (
        <div className="text-sm text-zinc-500">面板不存在</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 左：任务 + 编辑/预览 */}
          <div className="space-y-4">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-zinc-300">任务清单（点击勾选）</h2>
                  <span className="text-xs text-zinc-500">支持 - [ ] 语法</span>
                </div>
                <TaskList
                  items={allItems}
                  editable={level === 'daily'}
                  onToggle={handleToggle}
                />
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-zinc-300">
                    {level === 'daily' ? '每日复盘内容' : level === 'weekly' ? '周总结' : '月总结'}
                  </h2>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditMode(true)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                        editMode ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Pencil className="h-3 w-3" /> 编辑
                    </button>
                    <button
                      onClick={() => {
                        if (dirtyRef.current) {
                          void flushSave(level, panelKey);
                        }
                        setEditMode(false);
                      }}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                        !editMode ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Eye className="h-3 w-3" /> 预览
                    </button>
                  </div>
                </div>

                {editMode ? (
                  <textarea
                    value={draft}
                    onChange={(e) => scheduleSave(level, panelKey, e.target.value)}
                    onPaste={handlePaste}
                    placeholder={'从外部复制 Markdown 或富文本直接粘贴，自动转换\n\n任务清单：\n- [ ] 晨跑 30 分钟\n- [x] 阅读 20 页\n\n支持标题、列表、引用、代码块等语法'}
                    className="h-[380px] w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-[13px] leading-6 text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/50"
                  />
                ) : (
                  <div
                    className="h-[380px] w-full overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-4 text-[13px] leading-6 text-zinc-300"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(draft) }}
                  />
                )}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Sparkles className="h-3 w-3 text-emerald-500/70" />
                  修改后自动保存（800ms）；粘贴富文本自动转为 Markdown
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右：归档明细 */}
          <div className="space-y-4">
            {level !== 'daily' && (
              <>
                {view.pending.length > 0 && (
                  <Card className="border-amber-500/25 bg-amber-500/[0.04] backdrop-blur-xl">
                    <CardContent className="p-4">
                      <h2 className="mb-2 text-sm font-medium text-amber-300">待归档（未归档子面板）</h2>
                      <div className="space-y-2">
                        {view.pending.map((p) => (
                          <div key={p.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="mb-1 text-xs font-medium text-zinc-300">{p.title}</div>
                            {p.content ? (
                              <div
                                className="max-h-36 overflow-y-auto text-xs text-zinc-400"
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(p.content.slice(0, 500)) }}
                              />
                            ) : (
                              <div className="text-xs text-zinc-600">（无内容）</div>
                            )}
                            <button
                              onClick={() => {
                                void (async () => {
                                  await reviewBoardApi.archive(level === 'weekly' ? 'daily' : 'weekly', p.key);
                                  toast.success(`已归档 ${p.key}`);
                                  await loadView(level, panelKey);
                                })();
                              }}
                              className="mt-2 inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
                            >
                              <Archive className="h-3 w-3" /> 归档
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl">
                  <CardContent className="p-4">
                    <h2 className="mb-3 text-sm font-medium text-zinc-300">
                      📁 归档明细（{view.panel.sections.length} 条）
                    </h2>
                    {view.panel.sections.length === 0 ? (
                      <div className="py-8 text-center text-sm text-zinc-600">
                        还没有归档数据，每日面板归档后显示在这里
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {view.panel.sections.map((s) => (
                          <div key={s.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-xs font-medium text-emerald-300">{s.title}</span>
                              <span className="text-[10px] text-zinc-600">{formatTime(s.archivedAt)} 归档</span>
                            </div>
                            {s.content ? (
                              <div
                                className="max-h-44 overflow-y-auto text-xs text-zinc-400"
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(s.content) }}
                              />
                            ) : (
                              <div className="text-xs text-zinc-600">（无正文内容）</div>
                            )}
                            {s.items.length > 0 && (
                              <div className="mt-2 border-t border-white/5 pt-2">
                                <TaskList
                                  items={s.items}
                                  editable={level === 'weekly' && view.panel.level === 'weekly'}
                                  onToggle={handleToggle}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {level === 'daily' && (
              <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl">
                <CardContent className="p-4 text-sm leading-6 text-zinc-400">
                  <h2 className="mb-2 text-sm font-medium text-zinc-300">💡 使用说明</h2>
                  <ul className="list-disc space-y-1 pl-5 text-[13px]">
                    <li>每日面板记录当天复盘（Markdown + 任务清单），修改后自动保存</li>
                    <li>点「立即归档」把今天内容归档到所在周面板；每周日归档周数据到月面板</li>
                    <li>归档后可在「每周面板 / 每月面板」查看汇总明细，并补充周/月总结</li>
                    <li>「分享链接」生成本地可访问的只读/可编辑链接</li>
                    <li>「发布」生成自包含 HTML 发布包，可交给 AI 发布到 ShareOne 公网短链</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 分享弹窗 */}
      {showShare && (
        <Modal title="分享链接" onClose={() => setShowShare(false)}>
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-zinc-400">
              <b className="text-zinc-200">只读链接</b>：外网仅查看，不能修改<br />
              <b className="text-zinc-200">可编辑链接</b>：外网可勾选任务，状态写回本机
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleCreateShare('view')} className="flex-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-300 hover:bg-sky-500/20">
                生成只读链接
              </button>
              <button onClick={() => handleCreateShare('edit')} className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20">
                生成可编辑链接
              </button>
            </div>
            {shares.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-400">已生成链接</div>
                {shares.map((s) => {
                  const url = `${window.location.origin}/api/review-board/share/${s.token}`;
                  return (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                      <span className={`flex-none rounded px-1.5 py-0.5 text-[10px] ${s.mode === 'edit' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'}`}>
                        {s.mode === 'edit' ? '可编辑' : '只读'}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-400">{url}</span>
                      <button onClick={() => copyText(url, '链接')} className="flex-none rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { void reviewBoardApi.deleteShare(s.id).then(loadShareData); }} className="flex-none rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-rose-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 发布弹窗 */}
      {showPublish && (
        <Modal title="发布到 ShareOne" onClose={() => setShowPublish(false)}>
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-zinc-400">
              生成自包含 HTML 发布包（当前「{view?.panel.title}」），可发给 AI 一句话发布到 ShareOne 公网短链：
              <br />「帮我把这个文件发布到 ShareOne」<br />
              <b className="text-zinc-200">只读包</b>：外网查看；<b className="text-zinc-200">可编辑包</b>：外网勾选后复制状态文本，粘贴到 ShareOne 评论区提交，本机侧拉取评论应用状态。
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleExport('view')} className="flex-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-300 hover:bg-sky-500/20">
                生成只读发布包
              </button>
              <button onClick={() => handleExport('edit')} className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20">
                生成可编辑发布包
              </button>
            </div>
            {publishes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                    <span>发布包记录（{publishes.length}）</span>
                    {publishes.some((p) => !selectedPublishIds.includes(p.id)) && (
                      <button
                        onClick={() => setSelectedPublishIds(publishes.map((p) => p.id))}
                        className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                      >
                        全选
                      </button>
                    )}
                  </div>
                  {selectedPublishIds.length > 0 && (
                    <button
                      onClick={() => void handleDeletePublishes(selectedPublishIds)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      删除选中（{selectedPublishIds.length}）
                    </button>
                  )}
                </div>
                {publishes.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                      selectedPublishIds.includes(p.id)
                        ? 'border-sky-500/40 bg-sky-500/10'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPublishIds.includes(p.id)}
                      onChange={(e) =>
                        setSelectedPublishIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                        )
                      }
                      className="h-3.5 w-3.5 flex-none accent-sky-500"
                    />
                    <FileDown className="h-4 w-4 flex-none text-zinc-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-zinc-300">{p.fileName}</span>
                      <span className="text-[10px] text-zinc-500">
                        {p.mode === 'edit' ? '可编辑' : '只读'} · {formatTime(p.createdAt)}
                        {p.shareUrl ? ` · ShareOne: ${p.shareUrl}` : ' · 未发布'}
                      </span>
                    </span>
                    <button
                      onClick={() =>
                        copyText(
                          p.shareUrl ?? `${window.location.origin}/api/review-board/publish/${p.fileName}`,
                          '文件名',
                        )
                      }
                      className="flex-none rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-xs leading-5 text-emerald-300/90">
              💡 发布包保存在 <code className="rounded bg-black/30 px-1">user-data/publish/</code> 目录。对 AI 说「帮我把 user-data/publish/下的 xxx.html 发布到 ShareOne」，即可拿到公网链接。
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1117] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default ReviewBoardPage;
