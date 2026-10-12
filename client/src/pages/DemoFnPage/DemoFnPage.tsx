import { useCallback, useEffect, useMemo, useState } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import {
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Cloudy,
  AlertTriangle,
  Sparkles,
  X,
} from 'lucide-react';

interface DemoRecord {
  id: string;
  title: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdAtText?: string;
}

interface DemoStats {
  total: number;
  todayCount: number;
  noteChars: number;
  lastUpdatedAt?: string | null;
}

interface ExecResult<T = unknown> {
  success: boolean;
  error?: string;
  code?: string;
  data?: T;
  total?: number;
  items?: T;
  stats?: T;
}

const METHOD_BASE = '/api/plugins/methods/dsh-plugin-demo-fn.';

async function callMethod<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<ExecResult<T>> {
  const response = await axiosForBackend({
    url: `${METHOD_BASE}${name}/execute`,
    method: 'POST',
    data: { args },
  });
  return response.data as ExecResult<T>;
}

export default function DemoFnPage() {
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 添加表单
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  // 编辑弹框
  const [editing, setEditing] = useState<DemoRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  // 清空确认
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listRes, statsRes] = await Promise.all([
        callMethod<DemoRecord[]>('listDemoRecords', {}),
        callMethod<DemoStats>('getDemoStats', {}),
      ]);
      if (listRes.success) {
        setRecords(listRes.items ?? []);
      }
      if (statsRes.success) {
        setStats(statsRes.stats ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请确认插件已启用');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    if (!title.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await callMethod('addDemoRecord', { title, note });
      if (!res.success) {
        setError(res.error ?? '添加失败');
        return;
      }
      setTitle('');
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败');
    } finally {
      setAdding(false);
    }
  }, [title, note, load]);

  const openEdit = useCallback((rec: DemoRecord) => {
    setEditing(rec);
    setEditTitle(rec.title);
    setEditNote(rec.note ?? '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing || !editTitle.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await callMethod('updateDemoRecord', {
        id: editing.id,
        title: editTitle,
        note: editNote,
      });
      if (!res.success) {
        setError(res.error ?? '修改失败');
        return;
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '修改失败');
    } finally {
      setSaving(false);
    }
  }, [editing, editTitle, editNote, load]);

  const handleDelete = useCallback(
    async (id: string) => {
      setError('');
      try {
        const res = await callMethod('deleteDemoRecord', { id });
        if (!res.success) {
          setError(res.error ?? '删除失败');
          return;
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : '删除失败');
      }
    },
    [load],
  );

  const handleClearAll = useCallback(async () => {
    setError('');
    try {
      const res = await callMethod('demoDeleteAll', { confirm: 'DELETE' });
      if (!res.success) {
        setError(res.error ?? '清空失败');
        return;
      }
      setConfirmClear(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '清空失败');
    }
  }, [load]);

  const isEmpty = useMemo(() => records.length === 0, [records]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* 头部 */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20">
            <Cloudy className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">云函数示例插件</h1>
            <p className="text-sm text-zinc-400">
              演示插件云函数（server.js）机制：方法动态注册，AI 助手可直接调用
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            本插件暴露 7 个云函数方法（addDemoRecord / listDemoRecords / updateDemoRecord /
            deleteDemoRecord / getDemoStats / demoEcho / demoDeleteAll），启用后可在「人生系统助手」聊天中直接说：
            <em className="not-italic text-indigo-100">
              “在云函数示例插件中加一条记录，标题是 晨跑打卡，备注 跑了 3 公里”
            </em>
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 统计 */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: '记录总数', value: stats?.total ?? 0 },
          { label: '今日新增', value: stats?.todayCount ?? 0 },
          { label: '备注总字数', value: stats?.noteChars ?? 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
          >
            <div className="text-xs text-zinc-400">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* 添加表单 */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">添加记录</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="记录标题（必填）"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-sky-400/50"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注说明（可选）"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-sky-400/50"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding || !title.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {adding ? '添加中...' : '添加'}
          </button>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            记录列表
            <span className="ml-2 text-xs font-normal text-zinc-500">
              共 {records.length} 条
            </span>
          </h2>
          {!isEmpty && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空全部
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-zinc-500">加载中...</div>
        ) : isEmpty ? (
          <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
            暂无记录，在上方添加第一条
          </div>
        ) : (
          <div className="space-y-2.5">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-sky-400/30"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{rec.title}</div>
                  {rec.note && (
                    <div className="mt-0.5 truncate text-xs text-zinc-400">{rec.note}</div>
                  )}
                  <div className="mt-1 text-[11px] text-zinc-600">
                    {rec.createdAtText ?? ''}
                    {rec.createdBy ? ` · ${rec.createdBy}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5 opacity-60 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(rec)}
                    title="编辑"
                    className="rounded-lg border border-white/10 p-1.5 text-zinc-300 transition hover:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(rec.id)}
                    title="删除"
                    className="rounded-lg border border-white/10 p-1.5 text-red-300 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑弹框 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">编辑记录</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="标题"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-sky-400/50"
              />
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="备注"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-sky-400/50"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={saving || !editTitle.trim()}
                className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 清空确认弹框 */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-red-400/20 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">清空全部记录？</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  将删除该插件数据目录下的全部 {records.length} 条记录，此操作不可恢复（危险方法 demoDeleteAll 需要确认词）。
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
