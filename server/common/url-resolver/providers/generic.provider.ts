import type { ResolvedItem, UrlProvider } from '../types';

/**
 * 通用兜底 provider：对任意地址抓取页面，用正则提取内嵌媒体直链。
 * 命中任何 URL（注册顺序最后），提取不到返回空数组（由解析器降级为原地址）。
 */
export class GenericProvider implements UrlProvider {
  name = 'generic' as const;

  detect(): boolean {
    return true;
  }

  async resolve(url: string): Promise<ResolvedItem[]> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let html = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }
    const found = new Set<string>();
    const re =
      /https?:\/\/[^\s"'<>()]+?\.(?:mp4|m3u8|webm|mkv|flv|mov|mp3|flac|wav|m4a|aac|ogg)(?:\?[^\s"'<>()]*)?/gi;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(html)) !== null) {
      found.add(mm[0]);
    }
    return Array.from(found).map((u) => ({ url: u }));
  }
}
