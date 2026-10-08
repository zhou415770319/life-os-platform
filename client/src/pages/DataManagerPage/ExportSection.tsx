import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Clock,
  Loader2,
  Target,
  Clock as ClockIcon,
  Brain,
  ScrollText,
  Puzzle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { dataManagerApi } from '@client/src/api';
import { formatDate, getTodayDateString } from '@client/src/utils/date';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import type { ExportOptionsResult, ExportOptionItem } from '@shared/api.interface';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  goals: <Target className="w-3.5 h-3.5" />,
  habits: <ClockIcon className="w-3.5 h-3.5" />,
  notes: <Brain className="w-3.5 h-3.5" />,
  'life-log': <ScrollText className="w-3.5 h-3.5" />,
};

const ExportSection = () => {
  const [options, setOptions] = useState<ExportOptionsResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const data = await dataManagerApi.getExportOptions();
      setOptions(data);
      // 默认勾选全部（核心模块 + 已装载插件）
      setSelected(
        new Set([
          ...data.modules.map((m) => m.key),
          ...data.plugins.map((p) => `plugin:${p.key}`),
        ]),
      );
    } catch (err) {
      logger.error('Load export options failed', { error: String(err) });
      toast.error('加载备份选项失败');
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const toggle = (scope: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const handleDownloadBackup = async () => {
    if (selected.size === 0) {
      toast.warning('请至少勾选一项要备份的数据');
      return;
    }
    setExporting(true);
    try {
      const blob = await dataManagerApi.downloadBackup([...selected]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life-os-backup-${getTodayDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastExportTime(formatDate(new Date().toISOString()));
      toast.success('备份文件已下载');
    } catch (err) {
      logger.error('Download backup failed', { error: String(err) });
      toast.error('导出备份失败');
    } finally {
      setExporting(false);
    }
  };

  const renderItem = (item: ExportOptionItem, scope: string, isPlugin: boolean) => {
    const checked = selected.has(scope);
    return (
      <label
        key={scope}
        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
          checked
            ? 'bg-indigo-500/10 border-indigo-500/30'
            : 'bg-white/[0.02] border-white/10 hover:border-white/20'
        }`}
      >
        <span
          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
            checked
              ? 'bg-indigo-500 border-indigo-500 text-white'
              : 'border-zinc-600 bg-transparent'
          }`}
        >
          {checked && <CheckCircle2 className="w-3.5 h-3.5" />}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggle(scope)}
          className="hidden"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            {isPlugin ? <Puzzle className="w-3.5 h-3.5 text-zinc-400" /> : MODULE_ICONS[item.key]}
            <span className="font-medium">{item.label}</span>
            <span className="ml-auto shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-400">
              {item.count} 条
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.description}</p>
        </div>
      </label>
    );
  };

  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
          <Download className="w-4 h-4 text-zinc-400" />
          导出备份
        </CardTitle>
        <CardDescription className="text-zinc-400">
          勾选要备份的数据，未勾选的模块与插件不会被导出
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingOptions ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载备份选项...
          </div>
        ) : options ? (
          <>
            <div>
              <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center justify-between">
                <span>核心模块</span>
                <button
                  type="button"
                  onClick={() => {
                    const all = new Set(selected);
                    options.modules.forEach((m) => all.add(m.key));
                    setSelected(all);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  全选
                </button>
              </div>
              <div className="space-y-2">
                {options.modules.map((m) => renderItem(m, m.key, false))}
              </div>
            </div>

            {options.plugins.length > 0 && (
              <div>
                <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center justify-between">
                  <span>已装载插件（{options.plugins.length}）</span>
                  <button
                    type="button"
                    onClick={() => {
                      const all = new Set(selected);
                      options.plugins.forEach((p) => all.add(`plugin:${p.key}`));
                      setSelected(all);
                    }}
                    className="text-zinc-500 hover:text-zinc-300 text-xs"
                  >
                    全选
                  </button>
                </div>
                <div className="space-y-2">
                  {options.plugins.map((p) => renderItem(p, `plugin:${p.key}`, true))}
                </div>
              </div>
            )}

            {options.plugins.length === 0 && (
              <p className="text-xs text-zinc-500">
                暂无已装载的插件（未装载的插件不会出现在备份选项中）
              </p>
            )}

            <Button
              onClick={handleDownloadBackup}
              disabled={exporting}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  导出勾选的数据（{selected.size} 项）
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-zinc-500">备份选项加载失败</p>
            <Button variant="outline" onClick={loadOptions} className="border-white/10 text-zinc-300">
              <RefreshCw className="w-4 h-4 mr-1.5" />
              重试
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="w-3.5 h-3.5" />
          上次导出：{lastExportTime ?? '暂无记录'}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExportSection;
