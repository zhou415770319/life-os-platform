import type { BrowserAssistTrack, ResolvedItem, UrlProvider, UrlResolveOptions } from '../types';
import { RequireBrowserError } from '../types';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * 喜马拉雅 provider（2026-10 实测结论）：
 * - 列表接口（免登录，可用）：
 *   - 声音页 /sound/{id} → revision/play/v1/show?id={id} → 所在专辑 tracksAudioPlay（标题+trackId）
 *   - 专辑页 /album/{id} → mobile/v1/album/track?albumId={id} → 专辑声音列表（分页）
 * - 单曲直链接口 mobile-playpage/track/v3/baseInfo 有强风控：
 *   device=web + 真实浏览器登录态可返回 ret:0，但后端 Node 请求（即使带完整 Cookie）
 *   被 WAF 指纹拦截恒返回 ret:1001；且返回的 playUrlList[].url 为密文，
 *   需用页面内 DUCryptoJS 做 AES-128-ECB（key=aaad3e4fd540b0f79dca95606e72bf93）解密。
 * → 直链环节必须由「浏览器辅助」完成：本 provider 解析出列表后抛 RequireBrowserError，
 *   由调用方引导用户在已登录的喜马拉雅页面运行脚本（脚本取直链并回传）。
 * 旧接口 revision/play/v1/audio 等已全部废弃（404）。
 */
export class XimalayaProvider implements UrlProvider {
  name = 'ximalaya' as const;

  detect(url: string): boolean {
    return /(^|\.)ximalaya\.com/i.test(url) || /(^|\.)xmcdn\.com/i.test(url);
  }

  async resolve(url: string, _options?: UrlResolveOptions): Promise<ResolvedItem[]> {
    const soundId = this.extractSoundId(url);
    const albumId = this.extractAlbumId(url);
    if (!soundId && !albumId) return [];

    // 第一步：拿列表（免登录）。声音页 → 所在专辑列表；专辑页 → 专辑声音列表
    let tracks: BrowserAssistTrack[];
    if (soundId) {
      tracks = await this.fetchSoundList(soundId);
    } else {
      tracks = await this.fetchAlbumTracks(albumId!);
    }
    if (tracks.length === 0) {
      throw new RequireBrowserError(
        'ximalaya',
        '喜马拉雅解析失败：未能获取到声音列表，请确认链接有效后重试。',
        [],
      );
    }

    // 第二步：直链需浏览器辅助（后端请求被风控拦截，无法直连）
    throw new RequireBrowserError(
      'ximalaya',
      '喜马拉雅防盗链升级：解析需要「浏览器辅助」——请在弹出的窗口里打开已登录的喜马拉雅页面，粘贴解析脚本运行，脚本会自动获取音频直链并回传（约 1 分钟）。',
      tracks,
    );
  }

  private extractSoundId(url: string): string | null {
    const m = url.match(/(?:^|[\/.])ximalaya\.com\/(?:sound|s)\/(\d+)/i);
    return m ? m[1] : null;
  }

  private extractAlbumId(url: string): string | null {
    const m = url.match(/(?:^|[\/.])ximalaya\.com\/album\/(\d+)/i);
    return m ? m[1] : null;
  }

  /** 声音页 → 所在专辑的声音列表（revision/play/v1/show，免 Cookie） */
  private async fetchSoundList(soundId: string): Promise<BrowserAssistTrack[]> {
    try {
      const q = new URLSearchParams({ id: soundId, sort: '0', size: '30', ptype: '1' });
      const res = await this.get(
        `https://www.ximalaya.com/revision/play/v1/show?${q.toString()}`,
        undefined,
        'https://www.ximalaya.com/',
      );
      if (!res) return [];
      const json = JSON.parse(res) as {
        ret?: number;
        data?: { tracksAudioPlay?: Array<{ trackId?: number; trackName?: string }> };
      };
      if (json.ret !== 200) return [];
      const list = json.data?.tracksAudioPlay ?? [];
      return list
        .filter((t) => t.trackId != null)
        .map((t) => ({ id: String(t.trackId), title: (t.trackName ?? '').trim() }));
    } catch {
      return [];
    }
  }

  /** 专辑页 → 专辑声音列表（mobile/v1/album/track，免 Cookie，分页取，上限 5 页） */
  private async fetchAlbumTracks(albumId: string): Promise<BrowserAssistTrack[]> {
    const items: BrowserAssistTrack[] = [];
    for (let page = 1; page <= 5; page++) {
      const q = new URLSearchParams({ albumId, page: String(page), pagesize: '50' });
      let list: Array<{ trackId?: number | string; title?: string }> = [];
      try {
        const res = await this.get(
          `https://mobile.ximalaya.com/mobile/v1/album/track?${q.toString()}`,
          undefined,
          'https://www.ximalaya.com/',
        );
        if (!res) break;
        const json = JSON.parse(res) as {
          ret?: number;
          data?: { list?: Array<{ trackId?: number | string; title?: string }> };
        };
        if (json.ret !== 0) break;
        list = json.data?.list ?? [];
      } catch {
        break;
      }
      if (list.length === 0) break;
      for (const t of list) {
        if (t.trackId == null) continue;
        items.push({ id: String(t.trackId), title: (t.title ?? '').trim() });
      }
      if (list.length < 50) break;
    }
    return items;
  }

  private async get(url: string, _cookie?: string, referer?: string): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const headers: Record<string, string> = {
        'User-Agent': UA,
        Accept: 'application/json, text/plain, */*',
        Referer: referer || 'https://www.ximalaya.com/',
      };
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
