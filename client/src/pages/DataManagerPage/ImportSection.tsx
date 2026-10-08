import { useState } from 'react';
import {
  Upload,
  Shield,
  ArrowUpFromLine,
  Loader2,
  Target,
  Clock,
  Brain,
  ScrollText,
  Puzzle,
  CheckCircle2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { dataManagerApi } from '@client/src/api';
import type { DataImportResult, BackupImportPayload } from '@shared/api.interface';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';

interface ImportSectionProps {
  onImportSuccess?: () => void;
}

const MODULE_LABELS: Record<string, string> = {
  goals: '愿景目标',
  habits: '微习惯',
  notes: '认知笔记',
  'life-log': '人生日志',
};

const ImportSection: React.FC<ImportSectionProps> = ({ onImportSuccess }) => {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<DataImportResult | null>(null);
  const [preview, setPreview] = useState<{
    isV2: boolean;
    modules: string[];
    plugins: string[];
  } | null>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    setImportResult(null);
    setPreview(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = String(ev.target?.result ?? '');
        const parsed = JSON.parse(text) as BackupImportPayload;
        const v2 = parsed as { version?: string; modules?: Record<string, unknown>; pluginData?: Record<string, unknown> };
        const isV2 = v2.version === '2.0.0';
        setPreview({
          isV2,
          modules: isV2 ? Object.keys(v2.modules ?? {}) : [],
          plugins: isV2 ? Object.keys(v2.pluginData ?? {}) : [],
        });
        toast.warning(
          isV2
            ? '导入将覆盖备份中对应模块与插件的数据，确定继续吗？'
            : '导入将覆盖现有数据，确定继续吗？',
          {
            action: {
              label: '确定导入',
              onClick: async () => {
                await doImport(parsed);
              },
            },
            cancel: {
              label: '取消',
              onClick: () => {
                setImportFile(null);
                setPreview(null);
              },
            },
          },
        );
      } catch (err) {
        logger.error('Parse import file failed', { error: String(err) });
        toast.error('文件解析失败，请确保是有效的 JSON 备份文件');
        setImportFile(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const doImport = async (data: BackupImportPayload) => {
    setImporting(true);
    try {
      const result = await dataManagerApi.importData(data);
      setImportResult(result);
      toast.success('数据导入成功');
      onImportSuccess?.();
    } catch (err) {
      logger.error('Import data failed', { error: String(err) });
      toast.error('导入失败，请检查文件格式');
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  };

  const imported = importResult?.imported;

  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
          <Upload className="w-4 h-4 text-zinc-400" />
          导入恢复
        </CardTitle>
        <CardDescription className="text-zinc-400">
          从 JSON 备份文件恢复数据（区分模块与插件，分别覆盖对应数据）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
          id="import-file-input"
        />
        <Button
          variant="outline"
          onClick={() => {
            document.getElementById('import-file-input')?.click();
          }}
          disabled={importing}
          className="w-full border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05]"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              导入中...
            </>
          ) : (
            <>
              <ArrowUpFromLine className="w-4 h-4" />
              选择备份文件
            </>
          )}
        </Button>

        {preview && (
          <div className="space-y-2 p-3 rounded-lg bg-white/[0.03] border border-white/10">
            <p className="text-xs text-zinc-300 font-medium">备份文件包含</p>
            {preview.isV2 ? (
              <>
                {preview.modules.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.modules.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {m === 'goals' ? <Target className="w-3 h-3" /> : m === 'habits' ? <Clock className="w-3 h-3" /> : m === 'notes' ? <Brain className="w-3 h-3" /> : <ScrollText className="w-3 h-3" />}
                        {MODULE_LABELS[m] ?? m}
                      </span>
                    ))}
                  </div>
                )}
                {preview.plugins.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.plugins.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        <Puzzle className="w-3 h-3" />
                        插件：{p.replace('dsh-plugin-', '')}
                      </span>
                    ))}
                  </div>
                )}
                {preview.modules.length === 0 && preview.plugins.length === 0 && (
                  <p className="text-xs text-zinc-500">备份中没有任何数据</p>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-400">
                旧版备份格式（v1），将覆盖全部核心模块数据
              </p>
            )}
          </div>
        )}

        {importResult && imported && (
          <div className="space-y-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              导入结果
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {Object.keys(imported.modules ?? {}).length > 0 ? (
                <>
                  {Object.entries(imported.modules ?? {}).map(([key, count]) => (
                    <span key={key} className="text-zinc-400">
                      模块「{MODULE_LABELS[key] ?? key}」：{count} 条
                    </span>
                  ))}
                  {Object.entries(imported.pluginData ?? {}).map(([key, count]) => (
                    <span key={key} className="text-zinc-400">
                      插件「{key.replace('dsh-plugin-', '')}」：{count} 条
                    </span>
                  ))}
                </>
              ) : (
                <>
                  <span className="text-zinc-400">目标：{imported.goals} 条</span>
                  <span className="text-zinc-400">笔记：{imported.notes} 条</span>
                  <span className="text-zinc-400">习惯：{imported.habits} 条</span>
                  <span className="text-zinc-400">原则：{imported.principles} 条</span>
                  <span className="text-zinc-400">打卡：{imported.habitRecords} 条</span>
                  <span className="text-zinc-400">链接：{imported.quickLinks} 条</span>
                  <span className="text-zinc-400">精力：{imported.energyRecords} 条</span>
                  <span className="text-zinc-400">插件：{imported.plugins} 条</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Shield className="w-3.5 h-3.5" />
          导入会覆盖备份中对应模块/插件的现有数据，其余数据不受影响
        </div>
      </CardContent>
    </Card>
  );
};

export default ImportSection;
