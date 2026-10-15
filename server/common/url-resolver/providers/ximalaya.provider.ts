import type { ResolvedItem, UrlProvider } from '../types';

/**
 * 喜马拉雅 provider：
 * 无 cookie 时 revision 接口返回 webtk缺失（ret 407），无法走接口；
 * 改为抓声音/专辑页面，正则 + INITIAL_STATE/NEXT_DATA 深度遍历提取内嵌 mp3/m4a 直链。
 * 提取不到抛错（由解析器降级，提示可提供可播放链接）。
 */
export class XimalayaProvider implements UrlProvider {
  name = 'ximalaya' as const;

  detect(url: string): boolean {
    return /(^|\.)ximalaya\.com/i.test(url) || /(^|\.)xmcdn\.com/i.test(url);
  }

  async resolve(url: string): Promise<ResolvedItem[]> {
    const UA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let html = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          Referer: 'https://www.ximalaya.com/',
        },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const items: ResolvedItem[] = [];
    // 1. 内嵌直链（mp3/m4a 等，含转义 \/）
    const mediaRe = /https?:\\?\/\\?\/[^"'\s<>]+?\.(?:mp3|m4a|aac|flac|wav)(?:\?[^"'\s<>]*)?/gi;
    let mm: RegExpExecArray | null;
    while ((mm = mediaRe.exec(html)) !== null) {
      const s = mm[0].replace(/\\\//g, '/').replace(/\\u002F/g, '/');
      if (!items.some((i) => i.url === s)) items.push({ url: s });
    }

    // 2. INITIAL_STATE / NEXT_DATA / __NEXT_DATA__ 深度遍历找音频字段
    if (items.length === 0) {
      const stateMatches =
        html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s) ||
        html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (stateMatches) {
        try {
          const obj = JSON.parse(stateMatches[1]);
          const found = new Set<string>();
          const walk = (v: unknown) => {
            if (typeof v === 'string') {
              if (/^https?:\/\//i.test(v) && /\.(?:mp3|m4a|aac|flac|wav)(?:\?|$)/i.test(v)) found.add(v);
            } else if (Array.isArray(v)) {
              v.forEach(walk);
            } else if (v && typeof v === 'object') {
              for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k]);
            }
          };
          walk(obj);
          for (const u of found) items.push({ url: u });
        } catch {
          /* JSON 解析失败忽略 */
        }
      }
    }

    if (items.length === 0) {
      throw new Error('喜马拉雅页面未提取到音频直链（接口需 webtk 登录态）');
    }
    return items;
  }
}
