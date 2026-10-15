import type { ResolvedItem, UrlProvider } from '../types';

/**
 * B 站 provider：支持 b23.tv 短链、单视频（分P）、合集页。
 * 链路：跟随短链 → 页面 __INITIAL_STATE__ 拿 bvid + 分P cid → playurl API 拿每 P mp4 直链（带标题 part）。
 */
export class BilibiliProvider implements UrlProvider {
  name = 'bilibili' as const;

  detect(url: string): boolean {
    return /(^|\.)bilibili\.com/i.test(url) || /^https?:\/\/b23\.tv\//i.test(url);
  }

  async resolve(url: string): Promise<ResolvedItem[]> {
    // 1. b23.tv 短链 → 真实地址
    let target = url;
    if (/^https?:\/\/b23\.tv\//i.test(url)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const rr = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        },
        redirect: 'follow',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      target = rr.url || url;
    }

    // 2. 抓页面拿 __INITIAL_STATE__
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`B 站页面 HTTP ${res.status}`);
    const html = await res.text();

    // 3. 提取 INITIAL_STATE（含 bvid 与分P pages）
    const initMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});\s*\(function/);
    if (!initMatch) throw new Error('页面未找到 INITIAL_STATE（可能需要登录或视频失效）');
    let initState: Record<string, unknown>;
    try {
      initState = JSON.parse(initMatch[1]);
    } catch {
      throw new Error('INITIAL_STATE 解析失败');
    }
    const vd = (initState?.videoData ?? {}) as {
      bvid?: string;
      cid?: number;
      title?: string;
      pages?: { cid: number; part?: string }[];
    };
    const bvid = vd.bvid;
    const pages =
      Array.isArray(vd.pages) && vd.pages.length
        ? vd.pages
        : typeof vd.cid === 'number'
          ? [{ cid: vd.cid, part: vd.title ?? '视频' }]
          : [];
    if (!bvid || pages.length === 0) throw new Error('未获取到 bvid / cid（视频可能已失效）');

    // 4. 逐 P 调 playurl API
    const items: ResolvedItem[] = [];
    const apiHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Referer: 'https://www.bilibili.com',
      Origin: 'https://www.bilibili.com',
    };
    for (const p of pages) {
      try {
        const pc = new AbortController();
        const pt = setTimeout(() => pc.abort(), 8000);
        const pr = await fetch(
          `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${p.cid}&fnval=1`,
          { headers: apiHeaders, signal: pc.signal },
        );
        clearTimeout(pt);
        const pd = (await pr.json()) as { code?: number; data?: { durl?: { url?: string }[] } };
        const durl = pd?.data?.durl?.[0]?.url;
        if (pd?.code === 0 && durl) {
          items.push({ title: p.part?.trim() || `P${items.length + 1}`, url: durl });
        }
      } catch {
        /* 单个分 P 失败继续 */
      }
    }
    if (items.length === 0) throw new Error('B 站 playurl 解析失败');
    return items;
  }
}
