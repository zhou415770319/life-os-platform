import { ShieldAlert } from 'lucide-react';

/**
 * 免责声明：网站全局页脚（Layout）与插件中心/市场页共用
 * - compact：紧凑版（页脚），默认完整版（页面区块）
 */
export default function Disclaimer({ compact = false }: { compact?: boolean }) {
  const cls = compact
    ? 'flex flex-wrap items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-zinc-600'
    : 'flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-zinc-500';

  return (
    <div className={cls}>
      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
      <span>
        免责声明：Life-OS 为个人本地化工具，数据默认仅存储于本地（user-data/ 目录），请定期备份。
        插件可能来自第三方开发者或在线市场，安装前请确认来源与权限；涉及本地文件读写、定时播放、远程控制等系统级操作的插件请谨慎授权。
        AI 助手生成内容仅供参考，不构成任何专业建议。
      </span>
    </div>
  );
}
