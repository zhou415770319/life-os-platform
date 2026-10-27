import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  RotateCcw,
  RefreshCw,
  Settings2,
  ExternalLink,
  ArrowLeft,
  Check,
  Kanban,
  Search,
  Database,
  AlertTriangle,
  FolderKanban,
  Clock,
  ListChecks,
  Pencil,
} from 'lucide-react';
import { projectManagerApi } from '@client/src/api';
import type {
  ProjectBoardItem,
  InstructionBoardItem,
  InstructionStatus,
} from '@client/src/api/project-manager';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { markdownToHtml } from '@client/src/utils/md';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const STAGES = ['立项', '开始开发', '完成 MVP', '完整功能上线'] as const;

const STATUS_STYLE: Record<InstructionStatus, string> = {
  待执行: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
  执行中: 'bg-indigo-500/10 text-indigo-300 border-indigo-400/40 animate-pulse',
  完成: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
  失败: 'bg-red-500/10 text-red-300 border-red-400/40',
};

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 四阶段步骤条（方案 A：已完成打勾、当前高亮显示百分比、未开始灰显） */
function StageStepper({ stage, progress }: { stage: string; progress: number }) {
  const currentIndex = STAGES.indexOf(stage as (typeof STAGES)[number]);
  const activeIndex = currentIndex >= 0 ? currentIndex : progress >= 100 ? STAGES.length - 1 : 0;
  return (
    <div className="w-full">
      <div className="flex items-center">
        {STAGES.map((s, idx) => {
          const done = idx < activeIndex;
          const current = idx === activeIndex;
          return (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex min-w-[3.5rem] flex-col items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-all ${
                    done
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
                      : current
                        ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200 ring-2 ring-indigo-500/30'
                        : 'border-white/10 bg-white/[0.03] text-zinc-500'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span
                  className={`text-center text-[10px] leading-tight ${
                    current ? 'text-indigo-300' : done ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {s}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div className="mx-1 -mt-4 h-px flex-1">
                  <div
                    className={`h-px transition-all ${idx < activeIndex ? 'bg-emerald-400/50' : 'bg-white/10'}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-sm font-medium text-indigo-300">{stage || STAGES[activeIndex]}</span>
        <span className="text-xs text-zinc-500">当前阶段</span>
        <div className="w-40">
          <Progress value={progress} className="h-1.5 bg-white/10" />
        </div>
        <span className="text-sm font-semibold tabular-nums text-zinc-200">{progress}%</span>
      </div>
    </div>
  );
}

/** 注意事项编辑器：展示 Markdown / 编辑（无内容也显示输入入口） */
function NotesEditor({ recordId, notes }: { recordId: string; notes: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');

  useEffect(() => {
    setDraft(notes ?? '');
  }, [notes]);

  const saveMutation = useMutation({
    mutationFn: (value: string) => projectManagerApi.updateProjectNotes(recordId, value),
    onSuccess: (res) => {
      toast.success(res.message || '注意事项已保存');
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['project-manager-overview'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : '未知错误';
      toast.error(`保存失败：${msg}`);
    },
  });

  if (editing) {
    return (
      <div className="mt-5 rounded-xl border border-indigo-400/30 bg-indigo-500/[0.03] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={'填写注意事项，支持 Markdown 语法\n\n# 标题\n- 列表\n- [ ] 任务\n**加粗** `代码` [链接](https://...)\n> 引用'}
          autoFocus
          className="h-40 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-sm leading-relaxed text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-400/50"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600">保存后将写回飞书多维表格，并渲染为 Markdown</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(notes ?? '');
                setEditing(false);
              }}
              disabled={saveMutation.isPending}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500"
              onClick={() => saveMutation.mutate(draft)}
              disabled={saveMutation.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              {saveMutation.isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {notes ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-zinc-400 [&_a]:text-sky-400 [&_a]:underline [&_pre]:overflow-x-auto [&_code]:font-mono [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(notes) }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-sm text-zinc-500 transition-colors hover:border-indigo-400/40 hover:text-zinc-300"
        >
          + 填写注意事项（支持 Markdown）
        </button>
      )}
      {notes && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 gap-1.5 text-zinc-500 hover:text-indigo-300"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" /> 编辑注意事项
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: InstructionStatus }) {
  return (
    <Badge variant="outline" className={`shrink-0 border ${STATUS_STYLE[status]}`}>
      {status}
    </Badge>
  );
}

function InstructionRow({
  instruction,
  index,
  onRerun,
  rerunning,
}: {
  instruction: InstructionBoardItem;
  index: number;
  onRerun: (id: string) => void;
  rerunning: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3.5 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-xs font-medium text-zinc-400">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-200">
              {instruction.name || `指令 ${index + 1}`}
            </span>
            <StatusBadge status={instruction.status} />
            {instruction.platform && (
              <span className="text-xs text-zinc-500">平台：{instruction.platform}</span>
            )}
          </div>
          {instruction.content && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">{instruction.content}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
            {instruction.sortOrder > 0 && <span>排序 #{instruction.sortOrder}</span>}
            {instruction.triggeredAt && <span>触发 {formatTime(instruction.triggeredAt)}</span>}
            {instruction.completedAt && <span>完成 {formatTime(instruction.completedAt)}</span>}
            {instruction.shadowTaskId && <span>影刀任务 {instruction.shadowTaskId}</span>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-zinc-300"
          disabled={rerunning || instruction.status === '执行中'}
          onClick={() => onRerun(instruction.recordId)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重新执行
        </Button>
      </div>
      {(instruction.result || instruction.error) && (
        <div className="ml-9 space-y-1.5">
          {instruction.result && (
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
              <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-emerald-400/80">
                返回结果
              </span>
              <p className="whitespace-pre-wrap text-xs text-zinc-300">{instruction.result}</p>
            </div>
          )}
          {instruction.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-red-400/80">
                错误信息
              </span>
              <p className="whitespace-pre-wrap text-xs text-red-200/90">{instruction.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 项目卡片 */
function ProjectCard({
  project,
  onFocus,
  onOpenTable,
}: {
  project: ProjectBoardItem;
  onFocus: () => void;
  onOpenTable: (url: string) => void;
}) {
  const done = project.instructionTotal > 0 ? project.instructionCompleted : 0;
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={onFocus}
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-left backdrop-blur-xl transition-all duration-300 ease-out hover:scale-[1.02] hover:border-indigo-400/30 hover:shadow-2xl hover:shadow-indigo-500/10"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl transition-opacity duration-300 group-hover:bg-indigo-500/20" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-50">{project.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {project.platform && (
              <Badge variant="outline" className="border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
                {project.platform}
              </Badge>
            )}
            <Badge variant="outline" className="border-indigo-400/25 bg-indigo-500/10 text-indigo-300">
              {project.stage || '未设阶段'}
            </Badge>
          </div>
        </div>
        {project.tableUrl && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onOpenTable(project.tableUrl);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onOpenTable(project.tableUrl);
              }
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            title="打开飞书多维表格"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-zinc-400">{project.stage || '当前阶段'}</span>
          <span className="font-semibold tabular-nums text-indigo-300">{project.stageProgress}%</span>
        </div>
        <Progress value={project.stageProgress} className="h-1.5 bg-white/10" />
      </div>

      {project.notes && (
        <div className="mt-3">
          {notesOpen ? (
            <div
              className="max-h-52 overflow-y-auto rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-zinc-400 [&_a]:text-sky-400 [&_a]:underline [&_pre]:overflow-x-auto [&_code]:font-mono"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(project.notes) }}
            />
          ) : (
            <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">{project.notes}</p>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setNotesOpen((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                setNotesOpen((v) => !v);
              }
            }}
            className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[11px] text-indigo-400/90 transition-colors hover:text-indigo-300"
          >
            {notesOpen ? '收起' : '展开'}
            <span className={notesOpen ? 'rotate-180 transition-transform' : 'transition-transform'}>▾</span>
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
        <span className="text-zinc-500">
          指令 <span className="font-semibold text-emerald-400">{done}</span>
          <span className="text-zinc-600">/{project.instructionTotal}</span> 完成
          {project.instructionRunning > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-indigo-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              执行中 {project.instructionRunning}
            </span>
          )}
          {project.instructionFailed > 0 && (
            <span className="ml-1.5 text-red-400">{project.instructionFailed} 失败</span>
          )}
        </span>
        <span className="text-zinc-600">{formatTime(project.updatedAt) || '—'}</span>
      </div>
    </button>
  );
}

export default function ProjectManagerPage() {
  const queryClient = useQueryClient();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState('全部');
  const [stage, setStage] = useState('全部');
  const [status, setStatus] = useState('全部');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: overview, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['project-manager-overview'],
    queryFn: projectManagerApi.getOverview,
    refetchInterval: 60_000,
  });

  const rerunMutation = useMutation({
    mutationFn: (id: string) => projectManagerApi.rerunInstruction(id),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['project-manager-overview'] });
    },
    onError: (err) => {
      toast.error(`重执行失败：${err instanceof Error ? err.message : String(err)}`);
    },
    onSettled: () => setRerunningId(null),
  });

  const projects = useMemo(() => {
    const all = overview?.projects ?? [];
    const kw = keyword.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (platform !== '全部' && p.platform !== platform) return false;
      if (stage !== '全部' && p.stage !== stage) return false;
      if (status !== '全部') {
        const has = p.instructions.some((i) => i.status === status);
        if (!has) return false;
      }
      if (kw) {
        const hay = `${p.name} ${p.platform} ${p.stage} ${p.notes} ${p.instructions
          .map((i) => `${i.name} ${i.content}`)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    if (sortBy === 'progress') sorted.sort((a, b) => b.stageProgress - a.stageProgress);
    else if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    else sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return sorted;
  }, [overview, keyword, platform, stage, status, sortBy]);

  const focusedProject = useMemo(
    () => overview?.projects.find((p) => p.recordId === focusedId) ?? null,
    [overview, focusedId],
  );

  const platforms = useMemo(() => {
    const set = new Set((overview?.projects ?? []).map((p) => p.platform).filter(Boolean));
    return ['全部', ...Array.from(set)];
  }, [overview]);

  const configured = overview?.config.configured ?? false;
  const configError = overview?.config.error;

  const handleRerun = (id: string) => {
    setRerunningId(id);
    rerunMutation.mutate(id);
  };

  const selectCls =
    'rounded-lg border border-white/10 bg-zinc-950/80 px-2.5 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [&>option]:bg-zinc-950';

  // ===== 专注模式 / 项目详情 =====
  if (focusedProject) {
    const p = focusedProject;
    return (
      <div className="relative min-h-screen overflow-hidden p-6 md:p-10">
        <BackgroundGlow variant="page" />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-zinc-400"
            onClick={() => setFocusedId(null)}
          >
            <ArrowLeft className="h-4 w-4" /> 返回看板
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{p.name}</h1>
          {p.platform && (
            <Badge variant="outline" className="border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
              {p.platform}
            </Badge>
          )}
          {p.tableUrl && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-zinc-300"
              onClick={() => window.open(p.tableUrl, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" /> 打开表格
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-zinc-300"
            onClick={() =>
              document.getElementById('pm-instructions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <ListChecks className="h-3.5 w-3.5" /> 指令列表
            <span className="text-zinc-500">({p.instructions.length})</span>
          </Button>
        </div>

        {/* 阶段进度 */}
        <Card className="p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Kanban className="h-4 w-4 text-indigo-400" /> 项目阶段进度
          </h2>
          <StageStepper stage={p.stage} progress={p.stageProgress} />
          <NotesEditor recordId={p.recordId} notes={p.notes} />
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span>
              指令完成{' '}
              <span className="font-semibold text-emerald-400">{p.instructionCompleted}</span>/
              {p.instructionTotal}
            </span>
            <span className={p.instructionFailed > 0 ? 'text-red-400' : ''}>
              失败 {p.instructionFailed}
            </span>
            <span className="text-indigo-300">执行中 {p.instructionRunning}</span>
            {p.owner && <span>负责人：{p.owner}</span>}
            {p.priority && <span>优先级：{p.priority}</span>}
            {p.updatedAt && <span>更新于 {formatTime(p.updatedAt)}</span>}
          </div>
        </Card>

        {/* 指令列表 */}
        <Card id="pm-instructions" className="mt-6 scroll-mt-24 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <ListChecks className="h-4 w-4 text-emerald-400" /> 指令列表
            <span className="text-xs font-normal text-zinc-500">（按排序号顺序执行）</span>
          </h2>
          {p.instructions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ListChecks className="h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">
                该项目还没有指令，请在飞书多维表格「指令任务表」中新建
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {p.instructions.map((ins, idx) => (
                <InstructionRow
                  key={ins.recordId}
                  instruction={ins}
                  index={idx}
                  onRerun={handleRerun}
                  rerunning={rerunningId === ins.recordId}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ===== 看板 =====
  return (
    <div className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <BackgroundGlow variant="page" />
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
            <FolderKanban className="h-6 w-6 text-indigo-400" /> 项目管理
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            飞书多维表格为唯一数据源 · 本机影刀轮询执行 · 页面经聚合层展示
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-zinc-400"
            onClick={() => {
              void refetch();
            }}
            disabled={isFetching}
            title="从飞书多维表格重新拉取数据"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? '刷新中…' : '刷新'}
          </Button>
          <ConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
        </div>
      </div>

      {/* 未配置引导 */}
      {!configured && !isLoading && (
        <Card className="mb-6 border-amber-500/20 bg-amber-500/[0.03] p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-300">尚未配置飞书多维表格连接</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                本插件以飞书多维表格为唯一数据源（项目主表 + 指令任务表，一对多）。请点击右上角
                「连接配置」填写 <span className="text-zinc-300">app_token</span>、
                <span className="text-zinc-300">两张表的 table_id</span> 与
                <span className="text-zinc-300">API 凭证</span>（个人令牌或自建应用），保存后即可聚合展示。
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                表格字段约定：项目主表【项目名称 / 平台 / 当前阶段（立项、开始开发、完成
                MVP、完整功能上线）/ 当前阶段进度 % / 注意事项】，指令任务表【指令编号 /
                名称、所属项目（关联主表）、平台、对话 / 指令内容、执行状态（待执行、执行中、完成、失败）、返回结果、错误信息、排序号】。
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 连接错误提示 */}
      {configured && configError && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-200/90">{configError}</p>
        </div>
      )}

      {/* 筛选栏 */}
      {configured && (
        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索项目名 / 注意事项 / 指令内容..."
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <select className={selectCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p === '全部' ? '全部平台' : p}
              </option>
            ))}
          </select>
          <select className={selectCls} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="全部">全部阶段</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="全部">全部指令状态</option>
            <option value="待执行">有待执行</option>
            <option value="执行中">有执行中</option>
            <option value="完成">有已完成</option>
            <option value="失败">有失败</option>
          </select>
          <select className={selectCls} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="updatedAt">按更新时间</option>
            <option value="progress">按阶段进度</option>
            <option value="name">按项目名称</option>
          </select>
        </div>
      )}

      {/* 看板网格 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
          ))}
        </div>
      ) : configured ? (
        projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] py-16 text-center">
            <FolderKanban className="h-10 w-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">
              {keyword || platform !== '全部' || stage !== '全部' || status !== '全部'
                ? '没有符合筛选条件的项目'
                : '项目主表暂无数据，请在飞书多维表格中新建项目'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.recordId}
                project={p}
                onFocus={() => setFocusedId(p.recordId)}
                onOpenTable={(url) => window.open(url, '_blank')}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-zinc-500">
          <Clock className="h-4 w-4" /> 配置连接后，看板将自动聚合展示项目与指令数据（60 秒自动刷新）
        </div>
      )}
    </div>
  );
}

/** 连接配置弹窗 */
function ConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState({
    appToken: '',
    projectTableId: '',
    instructionTableId: '',
    apiToken: '',
    appId: '',
    appSecret: '',
    tableUrl: '',
    pollIntervalMin: 5,
    baseUrl: '',
  });
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ['project-manager-config'],
    queryFn: projectManagerApi.getConfig,
    enabled: open,
  });

  // 打开时回填现有配置（令牌不回显明文，仅标记是否已配置）
  const cfgJson = cfg ? JSON.stringify(cfg) : '';
  useMemo(() => {
    if (cfg && open) {
      setForm((prev) => ({
        ...prev,
        appToken: cfg.appToken ?? '',
        projectTableId: cfg.projectTableId ?? '',
        instructionTableId: cfg.instructionTableId ?? '',
        tableUrl: cfg.tableUrl ?? '',
        pollIntervalMin: cfg.pollIntervalMin || 5,
        baseUrl: cfg.baseUrl ?? '',
      }));
      setTestMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cfgJson, cfg]);

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (dto: Parameters<typeof projectManagerApi.saveConfig>[0]) =>
      projectManagerApi.saveConfig(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-manager-overview'] });
      toast.success('连接配置已保存');
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    },
  });

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [key]: key === 'pollIntervalMin' ? Number(e.target.value) : e.target.value,
      }));
    };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    const dto = {
      appToken: form.appToken.trim(),
      projectTableId: form.projectTableId.trim(),
      instructionTableId: form.instructionTableId.trim(),
      apiToken: form.apiToken.trim() || undefined,
      appId: form.appId.trim() || undefined,
      appSecret: form.appSecret.trim() || undefined,
      baseUrl: form.baseUrl.trim() || undefined,
    };
    const res = await projectManagerApi.testConnection(dto);
    setTestMsg({ ok: res.success, text: res.message });
    setTesting(false);
  };

  const handleSave = () => {
    const dto: Parameters<typeof projectManagerApi.saveConfig>[0] = {
      appToken: form.appToken.trim(),
      projectTableId: form.projectTableId.trim(),
      instructionTableId: form.instructionTableId.trim(),
      tableUrl: form.tableUrl.trim() || undefined,
      pollIntervalMin: form.pollIntervalMin || 5,
      baseUrl: form.baseUrl.trim() || undefined,
    };
    if (form.apiToken.trim()) dto.apiToken = form.apiToken.trim();
    if (form.appId.trim()) dto.appId = form.appId.trim();
    if (form.appSecret.trim()) dto.appSecret = form.appSecret.trim();
    if (!dto.appToken || !dto.projectTableId || !dto.instructionTableId) {
      toast.error('app_token 与两张表的 table_id 为必填项');
      return;
    }
    saveMutation.mutate(dto);
  };

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-zinc-300">
          <Settings2 className="h-4 w-4" /> 连接配置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-zinc-950/95 text-zinc-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-50">
            <Database className="h-4 w-4 text-indigo-400" /> 飞书多维表格连接
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            项目主表 + 指令任务表（唯一数据源）。本机影刀直接轮询该表，页面经聚合层展示。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">app_token *</label>
            <input
              className={inputCls}
              value={form.appToken}
              onChange={set('appToken')}
              placeholder="如 bascnXXXX（表格链接 base/ 后一段）"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">项目主表 table_id *</label>
              <input
                className={inputCls}
                value={form.projectTableId}
                onChange={set('projectTableId')}
                placeholder="tblXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">指令任务表 table_id *</label>
              <input
                className={inputCls}
                value={form.instructionTableId}
                onChange={set('instructionTableId')}
                placeholder="tblXXXX"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">
              个人令牌 {cfg?.hasApiToken ? '（已配置，留空保持不变）' : ''}
            </label>
            <input
              className={inputCls}
              value={form.apiToken}
              onChange={set('apiToken')}
              type="password"
              placeholder="飞书开放平台个人令牌（与下方自建应用二选一）"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">
                自建应用 App ID {cfg?.hasAppCredential ? '（已配置）' : ''}
              </label>
              <input className={inputCls} value={form.appId} onChange={set('appId')} placeholder="cli_XXXX" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">App Secret</label>
              <input
                className={inputCls}
                value={form.appSecret}
                onChange={set('appSecret')}
                type="password"
                placeholder="自建应用凭证"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">表格预览链接（可选，用于「打开表格」）</label>
            <input
              className={inputCls}
              value={form.tableUrl}
              onChange={set('tableUrl')}
              placeholder="https://xxx.feishu.cn/base/XXXX"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">轮询间隔（分钟，影刀侧参考）</label>
              <input
                className={inputCls}
                value={form.pollIntervalMin}
                onChange={set('pollIntervalMin')}
                type="number"
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">开放平台域名（可选）</label>
              <input
                className={inputCls}
                value={form.baseUrl}
                onChange={set('baseUrl')}
                placeholder="默认 https://open.feishu.cn"
              />
            </div>
          </div>
          {testMsg && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                testMsg.ok
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                  : 'border-red-500/20 bg-red-500/5 text-red-300'
              }`}
            >
              {testMsg.text}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
            {testing ? '测试中...' : '测试连接'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '保存中...' : '保存配置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
