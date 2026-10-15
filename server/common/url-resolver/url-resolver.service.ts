import type { ResolvedItem, UrlPlatform, UrlProvider, UrlResolveResult } from './types';

/**
 * 公共链接解析器（注册表 + 分发）
 * - register：平台按顺序注册（靠前优先）；新增平台 = 写一个 provider + register 一行
 * - resolve：命中检测 → 平台解析 → 失败降级到 generic / 原地址
 * 无状态，可直接 new 或作为单例导出。
 */
export class UrlResolverService {
  private providers: UrlProvider[] = [];

  constructor(initial?: UrlProvider[]) {
    for (const p of initial ?? []) this.register(p);
  }

  /** 注册平台 provider（后注册的排在后面，靠前优先命中） */
  register(p: UrlProvider): this {
    this.providers.push(p);
    return this;
  }

  list(): UrlProvider[] {
    return [...this.providers];
  }

  /** 判断 URL 是否为直链（媒体扩展名 / m3u8），由 generic 兜底前先行 */
  private isDirectUrl(url: string): boolean {
    const MEDIA_EXTS = new Set([
      '.mp4', '.m3u8', '.webm', '.mkv', '.flv', '.mov',
      '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg',
    ]);
    try {
      const u = new URL(url);
      const ext = u.pathname.slice(u.pathname.lastIndexOf('.')).toLowerCase();
      return MEDIA_EXTS.has(ext);
    } catch {
      return false;
    }
  }

  /**
   * 解析入口：
   * 1. 直链 → 直接返回
   * 2. 逐个 provider detect → resolve（收集条目，成功即返回）
   * 3. 全部失败 → generic 兜底（页面内媒体正则，见 generic provider），仍无 → 返回原地址 + error
   */
  async resolve(url: string): Promise<UrlResolveResult> {
    const trimmed = url.trim();
    if (this.isDirectUrl(trimmed)) {
      return { platform: 'direct', isDirect: true, items: [{ url: trimmed }] };
    }
    for (const p of this.providers) {
      if (!p.detect(trimmed)) continue;
      try {
        const items = await p.resolve(trimmed);
        if (items.length > 0) {
          return { platform: p.name, isDirect: items.length === 1, items };
        }
      } catch {
        /* 该平台解析失败，继续尝试下一个 */
      }
    }
    return {
      platform: 'generic',
      isDirect: false,
      items: [{ url: trimmed }],
      error: '未从页面提取到视频地址，将按单个地址尝试播放（若为平台合集页，建议直接使用视频直链）',
    };
  }
}

/** 便于注入的工厂（Nest 之外也可直接 import 使用） */
export function createUrlResolver(extra?: UrlProvider[]): UrlResolverService {
  return new UrlResolverService(extra);
}

export type { ResolvedItem, UrlPlatform, UrlProvider, UrlResolveResult };
