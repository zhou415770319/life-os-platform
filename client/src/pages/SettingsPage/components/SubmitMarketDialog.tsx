import { useState } from 'react';
import { X, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { InstalledPlugin } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';

interface SubmitMarketDialogProps {
  plugin: InstalledPlugin;
  onClose: () => void;
}

/**
 * 提交插件到市场的确认弹框：
 * 可确认并修改「插件描述」与「版本号」；确认后唤起 AI 聊天框自动提交。
 * 版本号/描述会由后端同步写回本地 manifest.json，并随插件文件一起提交（PR 由管理员 review）。
 */
const SubmitMarketDialog: React.FC<SubmitMarketDialogProps> = ({ plugin, onClose }) => {
  const [description, setDescription] = useState(plugin.description ?? '');
  const [version, setVersion] = useState(plugin.version ?? '1.0.0');

  const handleConfirm = () => {
    const v = version.trim();
    if (!/^\d+\.\d+\.\d+$/.test(v)) {
      toast.error('版本号格式应为 x.y.z（如 1.2.0）');
      return;
    }
    const desc = description.trim();
    if (!desc) {
      toast.error('插件描述不能为空');
      return;
    }
    // 唤起 AI 聊天框并自动发送提交指令（携带描述与版本号，AI 调用提交方法时同步写回 manifest）
    // skipIntent=true：系统生成的确定性指令，跳过聊天框本地「安装/卸载插件」关键词拦截，直接交给 AI 执行提交
    window.dispatchEvent(
      new CustomEvent('life-os:ai-chat:send', {
        detail: {
          text: `请把插件「${plugin.name}」（${plugin.pluginKey}）提交到插件市场：pluginKey="${plugin.pluginKey}"，version="${v}"，description="${desc}"。基于 main 新建分支、上传插件文件并更新市场清单、创建 Pull Request 请求仓库管理员 review 审核，不要自动合并。`,
          skipIntent: true,
        },
      }),
    );
    toast.success('已唤起 AI 助手提交，请留意聊天框进度');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Send className="h-4 w-4 text-indigo-400" /> 提交「{plugin.name}」到插件市场
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-zinc-400">
          插件 key：<span className="font-mono text-indigo-300">{plugin.pluginKey}</span>
          <span className="mx-2 text-zinc-600">·</span>当前版本：
          <span className="font-mono text-zinc-200">v{plugin.version}</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">插件描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-indigo-500/50"
              placeholder="填写插件功能说明，将写入 manifest.json 并展示在插件市场"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">版本号</label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-200 outline-none transition focus:border-indigo-500/50"
              placeholder="x.y.z，如 1.2.0"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              提交时会同步写回本地 manifest.json（manifest.json + 市场清单 + PR 均使用此版本号）
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-400/80 mt-0.5" />
          <span>
            确认后将唤起 AI 助手，自动基于 main 新建分支、上传插件文件并创建 Pull
            Request，由仓库管理员 review 审核后合并，不会自动合并。
          </span>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            <Send className="mr-1 h-3.5 w-3.5" /> 确认提交
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubmitMarketDialog;
