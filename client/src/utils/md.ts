/**
 * 轻量 Markdown 工具：粘贴 HTML→Markdown 转换 + Markdown 安全渲染（预览用）
 * 不依赖外部库，覆盖常用语法（标题/列表/任务/引用/代码/链接/加粗/斜体）
 */

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blockText(node: Element): string {
  // 获取块级元素的可读文本（表格单元格等也拼上）
  return Array.from(node.childNodes)
    .map((n) => {
      if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        if (el.tagName === 'BR') return '\n';
        if (el.tagName === 'P' || el.tagName === 'DIV') return `${blockText(el)}\n`;
        return blockText(el);
      }
      return '';
    })
    .join('')
    .replace(/\u00a0/g, ' ')
    .trim();
}

/** 将剪贴板 HTML 转为 Markdown（轻量实现，覆盖常见排版） */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const lines: string[] = [];
  let listStack: string[] = []; // 记录嵌套列表的序号

  const inline = (el: Element): string => {
    let out = '';
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        out += (node.textContent ?? '').replace(/\s+/g, ' ').trimStart();
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const e = node as Element;
        const tag = e.tagName.toLowerCase();
        if (tag === 'br') {
          out += '\n';
        } else if (tag === 'strong' || tag === 'b') {
          out += `**${inline(e)}**`;
        } else if (tag === 'em' || tag === 'i') {
          out += `*${inline(e)}*`;
        } else if (tag === 'code') {
          out += `\`${inline(e)}\``;
        } else if (tag === 'a') {
          const href = e.getAttribute('href') ?? '';
          out += `[${inline(e)}](${href})`;
        } else if (tag === 'img') {
          const src = e.getAttribute('src') ?? '';
          const alt = e.getAttribute('alt') ?? '';
          out += `![${alt}](${src})`;
        } else if (tag === 'span' || tag === 'font' || tag === 'mark') {
          out += inline(e);
        } else if (tag === 'li') {
          out += inline(e);
        } else {
          out += inline(e);
        }
      }
    }
    return out;
  };

  const liText = (li: Element, ordered: boolean, idx: number): string => {
    const cb = li.querySelector('input[type=checkbox]') as HTMLInputElement | null;
    const text = inline(li).trim();
    if (!text) return '';
    if (cb) {
      // 外部勾选清单 → 转成 [ ] / [x] 任务语法
      return cb.checked ? `[x] ${text}` : `[ ] ${text}`;
    }
    return ordered ? `${idx}. ${text}` : `- ${text}`;
  };

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        const text = inline(el).trim();
        if (text) lines.push(text);
        walk(el);
        continue;
      }
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        const text = inline(el).trim();
        if (text) lines.push(`${'#'.repeat(Number(tag[1]))} ${text}`);
        continue;
      }
      if (tag === 'blockquote') {
        const text = blockText(el);
        if (text) lines.push(`> ${text}`);
        continue;
      }
      if (tag === 'pre') {
        const code = (el.textContent ?? '').replace(/\n$/, '');
        lines.push('```', code, '```');
        continue;
      }
      if (tag === 'code') {
        lines.push(`\`${(el.textContent ?? '').trim()}\``);
        continue;
      }
      if (tag === 'ul' || tag === 'ol') {
        const ordered = tag === 'ol';
        let idx = 1;
        for (const li of Array.from(el.children)) {
          if (li.tagName.toLowerCase() !== 'li') continue;
          const text = liText(li, ordered, idx);
          if (!text) continue;
          lines.push(text);
          idx++;
          walk(li); // 嵌套列表/子内容
        }
        continue;
      }
      if (tag === 'table') {
        const rows = Array.from(el.querySelectorAll('tr'));
        rows.forEach((tr, ri) => {
          const cells = Array.from(tr.querySelectorAll('th,td')).map((c) => inline(c as Element).trim());
          lines.push(`| ${cells.join(' | ')} |`);
          if (ri === 0) {
            lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
          }
        });
        continue;
      }
      if (tag === 'hr') {
        lines.push('---');
        continue;
      }
      if (tag === 'br') {
        continue;
      }
      if (tag === 'li') {
        const text = liText(el, false, 1);
        if (text) lines.push(text);
        continue;
      }
      // 未知块级：递归
      walk(el);
    }
  };

  walk(body);
  return lines
    .map((l) => l.replace(/\s+$/g, ''))
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline decoration-sky-400/40 underline-offset-2">$1</a>');
}

/** Markdown → HTML（预览用，输出已转义，可安全 innerHTML） */
export function markdownToHtml(md: string): string {
  if (!md?.trim()) {
    return '<div class="text-zinc-600 text-sm py-8 text-center">暂无内容，粘贴或输入 Markdown 开始记录</div>';
  }
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      if (inCode) {
        out.push('<pre class="bg-black/30 border border-white/10 rounded-lg p-3 overflow-x-auto my-2"><code class="text-[13px] font-mono text-zinc-200">' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const task = line.match(/^\s*(?:[-*+]\s*)?\[( |x|X)\]\s+(.+)$/);
    if (task) {
      closeList();
      const done = task[1] !== ' ';
      out.push(
        `<div class="flex items-start gap-2 py-0.5 ${done ? 'opacity-70' : ''}">` +
          `<span class="mt-1 inline-flex w-4 h-4 flex-none rounded ${done ? 'bg-emerald-500/80' : 'border border-zinc-600'}"></span>` +
          `<span class="${done ? 'line-through text-zinc-500' : ''}">${inlineMd(task[2])}</span></div>`,
      );
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul class="list-disc pl-5 space-y-0.5 my-1">');
        listType = 'ul';
      }
      out.push(`<li>${inlineMd(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol class="list-decimal pl-5 space-y-0.5 my-1">');
        listType = 'ol';
      }
      out.push(`<li>${inlineMd(ol[1])}</li>`);
      continue;
    }
    closeList();
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const n = h[1].length;
      const cls = n === 1 ? 'text-xl' : n === 2 ? 'text-lg' : n === 3 ? 'text-base' : 'text-sm';
      out.push(`<h${n} class="${cls} font-semibold text-zinc-100 mt-4 mb-1.5">${inlineMd(h[2])}</h${n}>`);
      continue;
    }
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      out.push(`<blockquote class="border-l-3 border-l-indigo-500 pl-3 my-1 text-zinc-400">${inlineMd(q[1])}</blockquote>`);
      continue;
    }
    if (/^---+$/.test(line)) {
      out.push('<hr class="border-white/10 my-3" />');
      continue;
    }
    if (line.trim() === '') continue;
    out.push(`<p class="my-1">${inlineMd(line)}</p>`);
  }
  closeList();
  if (inCode) {
    out.push('<pre class="bg-black/30 border border-white/10 rounded-lg p-3 overflow-x-auto my-2"><code class="text-[13px] font-mono text-zinc-200">' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
  }
  return out.join('\n');
}

/** 从 Markdown 中提取任务清单行（用于统计） */
export function countTasks(md: string): { total: number; done: number } {
  if (!md) return { total: 0, done: 0 };
  let total = 0;
  let done = 0;
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*+]\s*)?\[( |x|X)\]\s+/);
    if (m) {
      total++;
      if (m[1] !== ' ') done++;
    }
  }
  return { total, done };
}
