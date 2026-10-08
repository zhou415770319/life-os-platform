import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ScrollText,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import {
  getLifeLogEntries,
  getLifeLogCategories,
  exportLifeLog,
} from '@client/src/api/life-log';
import type { LifeLogEntry, LifeLogCategory } from '@shared/api.interface';

const CATEGORY_LABELS: Record<LifeLogCategory | 'all', string> = {
  all: '全部',
  goals: '目标',
  habits: '习惯',
  notes: '笔记',
  tasks: '任务',
  finance: '财务',
  health: '健康',
  plugins: '插件',
  system: '系统',
};

const CATEGORY_COLORS: Record<LifeLogCategory, string> = {
  goals: '#6366f1',
  habits: '#10b981',
  notes: '#a855f7',
  tasks: '#3b82f6',
  finance: '#14b8a6',
  health: '#f43f5e',
  plugins: '#f59e0b',
  system: '#71717a',
};

const CATEGORY_ORDER: LifeLogCategory[] = [
  'goals',
  'habits',
  'notes',
  'tasks',
  'finance',
  'health',
  'plugins',
  'system',
];

const PAGE_SIZE = 20;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

interface LogItemProps {
  entry: LifeLogEntry;
  color: string;
}

function LogItem({ entry, color }: LogItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta =
    entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div className="relative pl-8 pb-6 last:pb-0 group">
      {/* 时间轴竖线 */}
      <div className="absolute left-[11px] top-3 bottom-0 w-px bg-white/5" />
      {/* 圆点 */}
      <div
        className="absolute left-0 top-2.5 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${color}22` }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      <div
        className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
        onClick={() => hasMeta && setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge
                variant="outline"
                className="text-[10px] border-white/10 text-zinc-400 bg-white/[0.02]"
              >
                {CATEGORY_LABELS[entry.eventCategory]}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-mono"
                style={{
                  borderColor: `${color}44`,
                  backgroundColor: `${color}15`,
                  color,
                }}
              >
                {entry.eventType}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="w-3 h-3" />
                {formatTime(entry.createdAt)}
              </span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {entry.contentSummary}
            </p>
          </div>
          {hasMeta && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  收起
                </>
              ) : (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  详情
                </>
              )}
            </Button>
          )}
        </div>

        {hasMeta && expanded && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-xs font-medium text-zinc-400 mb-2">元数据</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(entry.metadata).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20 border border-white/5"
                >
                  <span className="text-xs text-zinc-500 font-mono">{k}</span>
                  <span className="text-xs text-zinc-300 font-mono truncate max-w-[60%]">
                    {String(v ?? 'null')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const LifeLogPage = () => {
  const [activeCategory, setActiveCategory] = useState<LifeLogCategory | 'all'>(
    'all',
  );
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['lifeLog', { category: activeCategory, eventType: searchQuery }],
    queryFn: ({ pageParam = 1 }) =>
      getLifeLogEntries({
        category: activeCategory,
        eventType: searchQuery || undefined,
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (sum: number, p) => sum + p.items.length,
        0,
      );
      if (loaded < lastPage.total) return allPages.length + 1;
      return undefined;
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['lifeLogCategories'],
    queryFn: () => getLifeLogCategories(),
  });

  const allItems = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((p) => p.items) as LifeLogEntry[];
  }, [data]);

  const total = data?.pages[0]?.total ?? 0;

  const handleExport = useCallback(async () => {
    try {
      const entries = await exportLifeLog();
      const blob = new Blob([JSON.stringify(entries, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life-log-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${entries.length} 条日志`);
    } catch (err) {
      logger.error('Export life log failed', { error: String(err) });
      toast.error('导出失败');
    }
  }, []);

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      {/* 顶部标题 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-purple-400" />
            人生日志 LifeLog
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            append-only 操作追溯 · 记录每一次关键操作事件
          </p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          className="border-white/10 text-zinc-200 hover:bg-white/5 hover:text-white"
        >
          <Download className="w-4 h-4" />
          导出 JSON
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索事件类型..."
            className="pl-10 border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02] h-10"
          />
        </div>
      </div>

      {/* 类别筛选标签 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveCategory('all')}
          className={`h-8 text-xs border-white/10 ${
            activeCategory === 'all'
              ? 'bg-white/10 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          全部
          <span className="ml-1 text-zinc-500">
            {categoriesData?.reduce((s, c) => s + c.count, 0) ?? 0}
          </span>
        </Button>
        {CATEGORY_ORDER.map((cat) => {
          const catInfo = categoriesData?.find((c) => c.category === cat);
          const active = activeCategory === cat;
          const color = CATEGORY_COLORS[cat];
          return (
            <Button
              key={cat}
              variant="outline"
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="h-8 text-xs border-white/10 hover:bg-white/5"
              style={{
                backgroundColor: active ? `${color}20` : undefined,
                borderColor: active ? `${color}44` : undefined,
                color: active ? color : '#a1a1aa',
              }}
            >
              {CATEGORY_LABELS[cat]}
              <span style={{ opacity: 0.6 }}>{catInfo?.count ?? 0}</span>
            </Button>
          );
        })}
      </div>

      {/* 日志列表 */}
      <div className="relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            正在加载日志...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-zinc-500 text-sm">
            加载失败，请刷新重试
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm">
            暂无符合条件的日志
          </div>
        ) : (
          <div className="space-y-0">
            {allItems.map((entry) => (
              <LogItem
                key={entry.id}
                entry={entry}
                color={CATEGORY_COLORS[entry.eventCategory]}
              />
            ))}
          </div>
        )}
      </div>

      {/* 加载更多 */}
      {allItems.length > 0 && (
        <div className="flex justify-center mt-8">
          {hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border-white/10 text-zinc-300 hover:bg-white/5"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载中...
                </>
              ) : (
                '加载更多'
              )}
            </Button>
          ) : (
            <span className="text-xs text-zinc-500">
              已加载全部 {total} 条日志
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default LifeLogPage;
