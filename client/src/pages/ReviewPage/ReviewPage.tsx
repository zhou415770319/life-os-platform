import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Timer,
  Hourglass,
  Target,
  Loader2,
  Bell,
  NotebookPen,
  History,
  Sparkles,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getReviewToday,
  generateReview,
  listReviews,
  saveReviewSettings,
  type ReviewRecord,
  type ReviewSettings,
  type ReviewToday,
  type ReviewType,
} from '@client/src/api/review';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import BackgroundGlow from '@client/src/components/ui/background-glow';

const WEEK_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const CATEGORY_LABEL: Record<string, string> = {
  idle: '发呆',
  shortvideo: '刷短视频',
  gossip: '八卦闲聊',
  other: '其他',
};

function formatMinutes(min: number): string {
  if (min <= 0) return '0 分钟';
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

const ReviewPage = () => {
  const [today, setToday] = useState<ReviewToday | null>(null);
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<ReviewType | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, listRes] = await Promise.all([getReviewToday(), listReviews()]);
      setToday(todayRes);
      setRecords(listRes.items);
    } catch (err) {
      logger.error('Load review failed', String(err));
      toast.error('复盘数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async (type: ReviewType) => {
    setGenerating(type);
    try {
      const record = await generateReview(type);
      toast.success(record.source === 'ai' ? 'AI 复盘已生成' : '复盘已生成');
      const [todayRes, listRes] = await Promise.all([getReviewToday(), listReviews()]);
      setToday(todayRes);
      setRecords(listRes.items);
      setExpandedId(record.id);
    } catch (err) {
      logger.error('Generate review failed', String(err));
      toast.error('复盘生成失败，请稍后再试');
    } finally {
      setGenerating(null);
    }
  };

  const handleSaveSettings = async (patch: Partial<ReviewSettings>) => {
    setSaving(true);
    try {
      const next = await saveReviewSettings(patch);
      setToday((prev) => (prev ? { ...prev, settings: next } : prev));
      toast.success('提醒设置已保存');
    } catch (err) {
      logger.error('Save review settings failed', String(err));
      toast.error('设置保存失败');
    } finally {
      setSaving(false);
    }
  };

  const settings = today?.settings;
  const currentRecord = today?.record;

  const stats = useMemo(() => {
    const items = [
      {
        label: '习惯打卡',
        value: currentRecord
          ? `${currentRecord.stats.habitCompleted}${currentRecord.stats.habitTotal ? `/${currentRecord.stats.habitTotal}` : ''}`
          : '—',
        icon: CalendarCheck2,
        color: 'text-emerald-400',
      },
      {
        label: '番茄专注',
        value: currentRecord
          ? formatMinutes(currentRecord.stats.focusMinutes)
          : '—',
        icon: Timer,
        color: 'text-orange-400',
      },
      {
        label: '浪费时间',
        value: currentRecord
          ? formatMinutes(currentRecord.stats.wastedMinutes)
          : '—',
        icon: Hourglass,
        color: 'text-rose-400',
      },
      {
        label: '新增笔记',
        value: currentRecord ? String(currentRecord.stats.notesAdded) : '—',
        icon: NotebookPen,
        color: 'text-sky-400',
      },
    ];
    return items;
  }, [currentRecord]);

  if (loading) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <BackgroundGlow variant="page" />
        <div className="flex h-[60vh] items-center justify-center text-zinc-500 text-sm">
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-indigo-400" />
          正在加载复盘...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-400" />
          自动复盘
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          每日/每周自动汇总你的数据并生成复盘，到点自动提醒
        </p>
      </div>

      {/* 提醒设置 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 mb-6">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            复盘提醒设置
          </CardTitle>
          <CardDescription className="text-zinc-400">
            开启后到点自动生成复盘（无需打开页面），并在前端提示你查看
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 每日 */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300 font-medium">每日复盘提醒</span>
                  <button
                    onClick={() =>
                      handleSaveSettings({ dailyReminderEnabled: !settings.dailyReminderEnabled })
                    }
                    className={`relative w-10 h-5.5 rounded-full transition-colors ${
                      settings.dailyReminderEnabled ? 'bg-indigo-500' : 'bg-zinc-700'
                    }`}
                    style={{ height: 22, width: 40 }}
                  >
                    <span
                      className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all"
                      style={{
                        left: settings.dailyReminderEnabled ? 19 : 2,
                        width: 18,
                        height: 18,
                        top: 2,
                      }}
                    />
                  </button>
                </div>
                {settings.dailyReminderEnabled && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">提醒时间</span>
                    <input
                      type="time"
                      value={settings.dailyReminderTime}
                      onChange={(e) =>
                        handleSaveSettings({ dailyReminderTime: e.target.value || '21:00' })
                      }
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
              </div>

              {/* 每周 */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300 font-medium">每周复盘提醒</span>
                  <button
                    onClick={() =>
                      handleSaveSettings({ weeklyReminderEnabled: !settings.weeklyReminderEnabled })
                    }
                    className="relative rounded-full transition-colors"
                    style={{
                      height: 22,
                      width: 40,
                      backgroundColor: settings.weeklyReminderEnabled ? '#6366f1' : '#3f3f46',
                    }}
                  >
                    <span
                      className="absolute bg-white rounded-full transition-all"
                      style={{
                        left: settings.weeklyReminderEnabled ? 19 : 2,
                        width: 18,
                        height: 18,
                        top: 2,
                      }}
                    />
                  </button>
                </div>
                {settings.weeklyReminderEnabled && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-zinc-500">每周</span>
                    <select
                      value={settings.weeklyReminderDay}
                      onChange={(e) =>
                        handleSaveSettings({ weeklyReminderDay: Number(e.target.value) })
                      }
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-400"
                    >
                      {WEEK_LABEL.map((label, idx) => (
                        <option key={idx} value={idx} className="bg-zinc-900">
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={settings.weeklyReminderTime}
                      onChange={(e) =>
                        handleSaveSettings({ weeklyReminderTime: e.target.value || '20:00' })
                      }
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <div>
              <p className="text-sm text-zinc-300 font-medium">到点自动生成</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                到达提醒时间后自动生成复盘，无需手动操作
              </p>
            </div>
            <button
              onClick={() => handleSaveSettings({ autoGenerateEnabled: !settings?.autoGenerateEnabled })}
              className="relative rounded-full transition-colors"
              style={{
                height: 22,
                width: 40,
                backgroundColor: settings?.autoGenerateEnabled ? '#6366f1' : '#3f3f46',
              }}
            >
              <span
                className="absolute bg-white rounded-full transition-all"
                style={{
                  left: settings?.autoGenerateEnabled ? 19 : 2,
                  width: 18,
                  height: 18,
                  top: 2,
                }}
              />
            </button>
          </div>
          {saving && <p className="text-xs text-zinc-500 mt-2">保存中...</p>}
        </CardContent>
      </Card>

      {/* 今日复盘 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 mb-6">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            今日复盘 · {today?.date}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {today?.hasRecord
              ? `今日复盘已${currentRecord?.source === 'ai' ? '由 AI 生成' : '生成'}，可重新生成`
              : '今日还未生成复盘'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {today?.shouldRemind && !today.hasRecord && (
            <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              到复盘时间啦，点击下方按钮生成今日复盘
            </div>
          )}

          {/* 数据快照 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3"
                >
                  <div className={`flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5`}>
                    <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                    {item.label}
                  </div>
                  <div className="text-lg font-semibold text-zinc-50">{item.value}</div>
                </div>
              );
            })}
          </div>

          {currentRecord ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    currentRecord.source === 'ai'
                      ? 'text-indigo-300 border-indigo-400/30 bg-indigo-400/10'
                      : 'text-zinc-400 border-white/10 bg-white/5'
                  }`}
                >
                  {currentRecord.source === 'ai' ? '✨ AI 个性化总结' : '📋 数据模板'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleGenerate('daily')}
                  disabled={generating !== null}
                  className="text-zinc-400 hover:text-white"
                >
                  {generating === 'daily' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  )}
                  重新生成
                </Button>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">
                  {currentRecord.summary}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <FileText className="w-10 h-10 mb-3 text-zinc-600" />
              <p className="text-sm text-zinc-500 mb-4">
                汇总今日打卡、专注、浪费、笔记与目标数据，一键生成复盘
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleGenerate('daily')}
                  disabled={generating !== null}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white"
                >
                  {generating === 'daily' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  生成今日复盘
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleGenerate('weekly')}
                  disabled={generating !== null}
                  className="border-white/10 text-zinc-300 hover:text-white"
                >
                  {generating === 'weekly' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <History className="w-4 h-4 mr-1" />
                  )}
                  生成本周复盘
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 历史复盘 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            历史复盘
          </CardTitle>
          <CardDescription className="text-zinc-400">
            共 {records.length} 条记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              <History className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              还没有复盘记录，生成第一条吧
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => {
                const isOpen = expandedId === record.id;
                return (
                  <div
                    key={record.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(isOpen ? null : record.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                    >
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${
                          record.type === 'weekly'
                            ? 'text-indigo-300 border-indigo-400/30 bg-indigo-400/10'
                            : 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10'
                        }`}
                      >
                        {record.type === 'weekly' ? '周报' : '日报'}
                      </span>
                      <span className="text-sm text-zinc-300 flex-1">{record.title}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          record.source === 'ai'
                            ? 'text-indigo-300 border-indigo-400/30'
                            : 'text-zinc-500 border-white/10'
                        }`}
                      >
                        {record.source === 'ai' ? 'AI' : '模板'}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 mb-3">
                          <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">
                            {record.summary}
                          </pre>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-zinc-500">
                          <span>打卡 {record.stats.habitCompleted} 次</span>
                          <span>专注 {formatMinutes(record.stats.focusMinutes)}</span>
                          <span>浪费 {formatMinutes(record.stats.wastedMinutes)}</span>
                          <span>笔记 {record.stats.notesAdded} 条</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewPage;
