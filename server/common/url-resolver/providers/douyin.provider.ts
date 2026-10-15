import type { ResolvedItem, UrlProvider } from '../types';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** 是否精选合集形态（iesdouyin share/playlet / douyin playlet） */
function isPlayletUrl(url: string): boolean {
  return /iesdouyin\.com\/share\/playlet|douyin\.com\/playlet/i.test(url);
}

/**
 * 抖音普通视频 provider：命中 douyin.com / iesdouyin.com 的非精选合集地址。
 * 普通视频 iteminfo 接口需签名/登录态，无法解析 → 抛错（由解析器降级）。
 */
export class DouyinProvider implements UrlProvider {
  name = 'douyin' as const;

  detect(url: string): boolean {
    return !isPlayletUrl(url) && /v\.douyin\.com/i.test(url) || !isPlayletUrl(url) && /iesdouyin\.com/i.test(url) || !isPlayletUrl(url) && /(^|\.)douyin\.com/i.test(url);
  }

  async resolve(): Promise<ResolvedItem[]> {
    throw new Error('普通抖音视频需登录态/签名，暂无法解析（请使用抖音精选合集或视频直链）');
  }
}

/**
 * 抖音精选合集 provider（短剧/精选）：v.douyin.com 短链 302 → playlet_id，
 * playlet item/list 分页拿全部集 video.vid + item_title，再经 aweme/v1/play 302 到 mp4 直链。
 */
export class DouyinSelectedProvider implements UrlProvider {
  name = 'douyin-selected' as const;

  detect(url: string): boolean {
    return isPlayletUrl(url) || /v\.douyin\.com/i.test(url);
  }

  async resolve(url: string): Promise<ResolvedItem[]> {
    let playletId = '';
    if (/v\.douyin\.com/i.test(url)) {
      // 短链：302 后判断是否精选合集详情页，是则取 playlet_id，否则说明是普通视频
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const rr = await fetch(url, {
        headers: { 'User-Agent': UA },
        redirect: 'manual',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const loc = rr.headers.get('location') || '';
      if (!/playlet/i.test(loc)) {
        throw new Error('该短链不是抖音精选合集（普通抖音视频需登录态，无法解析）');
      }
      playletId = (loc.match(/playlet\/detail\/(\d+)/) || [])[1] || '';
    } else {
      playletId = (url.match(/playlet\/detail\/(\d+)/) || [])[1] || '';
    }
    if (!playletId) throw new Error('未识别到抖音精选合集 id');

    const apiHeaders = { 'User-Agent': UA, Referer: 'https://www.iesdouyin.com/' };
    const items: ResolvedItem[] = [];
    let cursor = 0;
    for (let page = 0; page < 5; page += 1) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const lr = await fetch(
        `https://www.iesdouyin.com/web/api/playlet/item/list/?playlet_id=${playletId}&cursor=${cursor}&count=30`,
        { headers: apiHeaders, signal: ctrl.signal },
      );
      clearTimeout(timer);
      const lj = (await lr.json()) as {
        aweme_list?: { video?: { vid?: string }; item_title?: string; desc?: string }[];
        has_more?: boolean;
        cursor?: number;
      };
      const list = lj?.aweme_list ?? [];
      for (const it of list) {
        const vid = it?.video?.vid;
        if (!vid) continue;
        try {
          const pc = new AbortController();
          const pt = setTimeout(() => pc.abort(), 8000);
          const pr = await fetch(
            `https://www.iesdouyin.com/aweme/v1/play/?video_id=${encodeURIComponent(vid)}&ratio=720p&line=0`,
            { headers: { 'User-Agent': UA, Referer: 'https://www.douyin.com/' }, redirect: 'manual', signal: pc.signal },
          );
          clearTimeout(pt);
          const loc2 = pr.headers.get('location');
          if (loc2 && /^https?:/i.test(loc2)) {
            const rawTitle = it.item_title || it.desc || '';
            const title = rawTitle
              .split(/[\n，。]/)[0]
              .trim()
              .slice(0, 40);
            items.push({ title: title || undefined, url: loc2 });
          }
        } catch {
          /* 单集失败继续 */
        }
      }
      if (!lj?.has_more || list.length === 0) break;
      cursor = lj?.cursor ?? cursor + list.length;
    }
    if (items.length === 0) throw new Error('抖音精选合集解析失败（未获取到视频）');
    return items;
  }
}
