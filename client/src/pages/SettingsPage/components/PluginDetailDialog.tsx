import { useState, useEffect } from 'react';
import {
  X,
  Puzzle,
  Loader2,
  MessageCircle,
  Braces,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { aiChatApi, pluginsApi } from '@client/src/api';
import { toast } from 'sonner';
import type { AvailablePlugin, InstalledPlugin, PluginMethod } from '@shared/api.interface';
import { Badge } from '@client/src/components/ui/badge';
import { getPluginIcon } from '@client/src/utils/plugin-icons';

interface PluginDetailDialogProps {
  plugin: AvailablePlugin;
  installed?: InstalledPlugin | null;
  onClose: () => void;
}

/** 由方法描述与必填参数生成一句聊天示例（可直接发给 AI 助手的自然语言） */
function buildChatExample(method: PluginMethod): string {
  // 方法描述如「在儿童资料站中添加一条新的学习资料」→ 作为示例主干
  const base = method.description.replace(/[。.]+$/, '');
  const required = method.params.filter((p) => p.required);
  if (required.length === 0) {
    return `请帮我${base}`;
  }
  const sampleArgs = required.map((p) => `${p.name}=待填（${p.description}）`).join('，');
  return `${base}：${sampleArgs}`;
}

/** 方法调用示例（结构化） */
function buildCallExample(method: PluginMethod): string {
  const args = method.params
    .slice(0, 5)
    .map((p) => `${p.name}: ${p.type === 'string' ? '"..."' : p.type === 'number' ? '0' : p.type === 'boolean' ? 'true' : '[]'}`)
    .join(', ');
  return `${method.name}(${args}${method.params.length > 5 ? ', ...' : ''})`;
}

const PluginDetailDialog: React.FC<PluginDetailDialogProps> = ({
  plugin,
  installed,
  onClose,
}) => {
  const [methods, setMethods] = useState<PluginMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [analysisUpdating, setAnalysisUpdating] = useState(false);

  const analysisEnabled = installed?.config?.analysisEnabled ?? false;

  const handleToggleAnalysis = async () => {
    if (!installed || analysisUpdating) return;
    setAnalysisUpdating(true);
    try {
      const next = !analysisEnabled;
      await pluginsApi.updatePlugin(installed.id, {
        config: { ...installed.config, analysisEnabled: next },
      });
      toast.success(next ? '已开启数据分析，数据将纳入洞察与复盘' : '已关闭数据分析');
      window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
      // 通知父级刷新
      window.dispatchEvent(new CustomEvent('life-os:analysis-toggled'));
    } catch (err) {
      console.error('Failed to toggle analysis', err);
      toast.error('设置失败，请稍后重试');
    } finally {
      setAnalysisUpdating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await aiChatApi.getAvailableMethods();
        if (!cancelled) {
          setMethods(res.items.filter((m) => m.pluginKey === plugin.pluginKey));
        }
      } catch (err) {
        console.error('Failed to load plugin methods', err);
      } finally {
        if (!cancelled) setLoadingMethods(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plugin.pluginKey]);

  const Icon = getPluginIcon(plugin.config.cardIcon);
  const isEnabled = installed?.enabled ?? plugin.installed ?? false;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-white/10">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${plugin.config.gradientFrom}, ${plugin.config.gradientTo})`,
              }}
            >
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-zinc-50">{plugin.name}</h2>
                <Badge variant="outline" className="text-xs text-zinc-400 border-white/10">
                  v{plugin.version}
                </Badge>
                {plugin.isCore && (
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                    核心
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">{plugin.description}</p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <Badge
                  variant="outline"
                  className={
                    isEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                  }
                >
                  {isEnabled ? '已启用' : installed ? '已暂停/未启用' : '未安装'}
                </Badge>
                <span className="text-zinc-500">{plugin.category}</span>
                {installed && (
                  <span className="text-zinc-500">安装于 {installed.installedAt?.slice(0, 10)}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 暴露的方法 */}
        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Braces className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-zinc-200">
                暴露的方法（{loadingMethods ? '...' : methods.length} 个）
              </h3>
              <span className="text-xs text-zinc-500 ml-1">AI 助手可直接调用</span>
            </div>

            {loadingMethods ? (
              <div className="flex items-center gap-2 py-6 text-zinc-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                加载方法列表...
              </div>
            ) : methods.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500">
                <Puzzle className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                该插件暂未暴露可调用方法
              </div>
            ) : (
              <div className="space-y-3">
                {methods.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono text-indigo-300">{m.name}</code>
                      {m.dangerous && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> 危险操作
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">{m.description}</span>
                    </div>

                    {m.params.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.params.map((p) => (
                          <span
                            key={p.name}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${
                              p.required
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                : 'bg-white/5 text-zinc-400 border-white/10'
                            }`}
                            title={p.description}
                          >
                            {p.required ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            )}
                            {p.name}: {p.type}
                            {p.required && <span className="text-rose-400">*</span>}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 space-y-1.5">
                      <div className="text-xs text-zinc-500">方法调用：</div>
                      <code className="block text-xs font-mono text-zinc-400 bg-black/30 rounded-lg px-3 py-2 break-all">
                        {buildCallExample(m)}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 数据分析开关 */}
          {plugin.analyzable && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-zinc-200">参与数据分析</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      开启后，该插件数据（{plugin.analysisLabel ?? '相关数据'}）将纳入
                      「数据洞察」分析与「自动复盘」生成；未开启则不分析。
                    </div>
                    {!installed && (
                      <div className="text-xs text-amber-400/90 mt-1">请先启用插件，再设置数据分析</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleToggleAnalysis}
                  disabled={!installed || analysisUpdating}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40 ${
                    analysisEnabled ? 'bg-indigo-500' : 'bg-zinc-600'
                  }`}
                  aria-label="参与数据分析"
                  title={analysisEnabled ? '已开启' : '已关闭'}
                >
                  {analysisUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin absolute inset-0 m-auto" />
                  ) : (
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        analysisEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 聊天中使用 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-zinc-200">在聊天中怎么使用</h3>
            </div>
            {methods.length === 0 ? (
              <p className="text-sm text-zinc-500">
                打开右下角 AI 助手，直接描述你的需求即可；该插件暂无暴露方法，AI 只能回答与它相关的问题。
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  打开右下角「AI 助手」，直接输入下面的话（把「待填」替换成你的内容）：
                </p>
                {methods.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300 mb-1">
                      <MessageCircle className="w-3 h-3" />
                      试试这样说
                    </div>
                    <p className="text-sm text-zinc-200">「{buildChatExample(m)}」</p>
                  </div>
                ))}
                {methods.length > 4 && (
                  <p className="text-xs text-zinc-500">还有 {methods.length - 4} 个方法，方法名见上方列表，说出方法名即可调用。</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-zinc-500 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
            <span>
              插件方法由 AI 助手按「插件是否启用 → 方法是否存在 → 参数是否齐全」三步预检后调用；缺少参数时 AI 会先向你确认。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PluginDetailDialog;
