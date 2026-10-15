import { type ReactNode } from 'react';
import { BookOpen, X } from 'lucide-react';

/** 极简 Markdown 渲染（说明文档用）：标题 / 表格 / 列表 / 粗体 / 代码 */
export function renderUsageMarkdown(md: string): ReactNode[] {
  const lines = md.split('\n');
  const out: ReactNode[] = [];
  let tableBuf: string[] = [];
  let listBuf: ReactNode[] = [];
  const flushList = (key: string) => {
    if (listBuf.length) {
      out.push(
        <ul key={key} className="mb-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-zinc-300">
          {listBuf}
        </ul>,
      );
      listBuf = [];
    }
  };
  const flushTable = (key: string) => {
    if (tableBuf.length >= 2) {
      const rows = tableBuf.map((r) =>
        r
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c !== ''),
      );
      const head = rows[0];
      const body = rows.slice(2).filter((r) => r.length === head.length);
      out.push(
        <table key={key} className="mb-3 w-full border-collapse text-[11px] text-zinc-300">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={i}
                  className="border border-white/10 bg-white/[0.04] px-2 py-1 text-left font-medium text-zinc-100"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j} className="border border-white/10 px-2 py-1">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
    }
    tableBuf = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList(`l${i}`);
      tableBuf.push(line);
      return;
    }
    if (tableBuf.length) flushTable(`t${i}`);
    const key = `k${i}`;
    const bold = (s: string) =>
      s.split(/\*\*(.+?)\*\*/g).map((p, j) =>
        j % 2 === 1 ? (
          <b key={j} className="text-zinc-100">
            {p}
          </b>
        ) : (
          p
        ),
      );
    if (/^#{1,4}\s/.test(line)) {
      flushList(`l${i}`);
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#+\s*/, '');
      const Tag = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
      out.push(
        <Tag
          key={key}
          className="mb-2 mt-4 font-semibold text-zinc-50 first:mt-0"
          style={{ fontSize: level <= 2 ? '1.05rem' : level === 3 ? '0.95rem' : '0.85rem' }}
        >
          {text}
        </Tag>,
      );
    } else if (/^[-*]\s/.test(line)) {
      listBuf.push(<li key={key}>{bold(line.replace(/^[-*]\s/, ''))}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      flushList(`l${i}`);
      out.push(
        <p key={key} className="mb-1 pl-5 text-xs leading-relaxed text-zinc-300">
          <span className="text-zinc-500">{line.match(/^\d+\./)?.[0]}</span>{' '}
          {bold(line.replace(/^\d+\.\s*/, ''))}
        </p>,
      );
    } else if (line.startsWith('`') && line.endsWith('`')) {
      out.push(
        <code
          key={key}
          className="mb-2 block rounded bg-white/[0.05] px-2 py-1 font-mono text-[11px] text-indigo-300"
        >
          {line.slice(1, -1)}
        </code>,
      );
    } else if (line.trim() === '') {
      flushList(`l${i}`);
    } else {
      flushList(`l${i}`);
      out.push(
        <p key={key} className="mb-2 text-xs leading-relaxed text-zinc-300">
          {bold(line)}
        </p>,
      );
    }
  });
  flushList('l-end');
  flushTable('t-end');
  return out;
}

interface UsageDocModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  content?: string;
  /** 底部备注（如文档位置说明），可选 */
  footerNote?: string;
}

/** 使用说明弹窗：家长/儿童均可查看，只读渲染 Markdown 说明文档 */
export default function UsageDocModal({ open, onClose, title, content, footerNote }: UsageDocModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <BookOpen className="h-4 w-4 text-indigo-400" /> {title ?? '使用说明'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="rounded-xl bg-white/[0.02] p-4">
          {content ? (
            renderUsageMarkdown(content)
          ) : (
            <p className="text-xs text-zinc-500">加载中...</p>
          )}
        </div>
        {footerNote && (
          <div className="mt-3 rounded-lg bg-indigo-500/10 px-3 py-2 text-[11px] text-zinc-400">
            {footerNote}
          </div>
        )}
      </div>
    </div>
  );
}
