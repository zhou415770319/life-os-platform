import { useState, useEffect } from 'react';
import {
  KeyRound,
  Link2,
  Cpu,
  Loader2,
  Save,
  PlugZap,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { aiSettingsApi } from '@client/src/api';
import type { AiSettingsView } from '@shared/api.interface';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';

const SOURCE_LABEL: Record<string, { text: string; cls: string }> = {
  user: { text: '使用用户配置', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  env: { text: '使用环境变量', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  none: { text: '未配置', cls: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
};

const AiSettingsTab = () => {
  const [settings, setSettings] = useState<AiSettingsView | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await aiSettingsApi.getAiSettings();
      setSettings(data);
      setBaseUrl(data.baseUrl);
      setModel(data.model);
      setTestResult(null);
    } catch (err) {
      logger.error('Load AI settings failed', { error: String(err) });
      toast.error('加载 AI 配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const data = await aiSettingsApi.saveAiSettings({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim(),
      });
      setSettings(data);
      setApiKey('');
      toast.success(apiKey.trim() ? 'AI 配置已保存' : '已保存（API Key 未修改）');
    } catch (err) {
      logger.error('Save AI settings failed', { error: String(err) });
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await aiSettingsApi.testAiSettings();
      setTestResult(result);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      logger.error('Test AI settings failed', { error: String(err) });
      toast.error('测试连接失败');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardContent className="flex items-center justify-center py-12 text-zinc-500 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载 AI 配置...
        </CardContent>
      </Card>
    );
  }

  const sourceMeta = SOURCE_LABEL[settings?.source ?? 'none'] ?? SOURCE_LABEL.none;

  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-zinc-400" />
          AI 助手 API 配置
        </CardTitle>
        <CardDescription className="text-zinc-400">
          配置你自己的大模型 API Key（兼容 OpenAI Chat Completions 协议，如 DeepSeek），AI 助手聊天将使用该配置调用模型
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 当前状态 */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={sourceMeta.cls}>
            {sourceMeta.text}
          </Badge>
          {settings?.configured && (
            <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Key：{settings.apiKeyMasked}
            </Badge>
          )}
          {!settings?.configured && settings?.source === 'none' && (
            <Badge variant="outline" className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
              未配置，AI 对话暂不可用
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm text-zinc-300">
              <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
              API Key
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.configured ? '已配置（留空表示不修改）' : 'sk-...'}
              className="bg-white/[0.03] border-white/10 text-zinc-200 placeholder:text-zinc-600"
              autoComplete="off"
            />
            <p className="text-xs text-zinc-600">
              Key 仅保存在本地 user-data/ai-settings.json，不会上传到任何服务器
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm text-zinc-300">
              <Link2 className="w-3.5 h-3.5 text-zinc-500" />
              API Base URL
            </label>
            <Input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/chat/completions"
              className="bg-white/[0.03] border-white/10 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              模型名称
            </label>
            <Input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
              className="bg-white/[0.03] border-white/10 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || testing}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存配置
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={saving || testing}
            className="border-white/10 text-zinc-300 hover:text-white hover:border-white/20"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <PlugZap className="w-4 h-4" />
                测试连接
              </>
            )}
          </Button>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${
              testResult.ok
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="break-all">{testResult.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiSettingsTab;
