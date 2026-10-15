/**
 * 公共链接解析器 · 类型定义
 * 供任意模块复用：识别平台 → 平台 provider 解析出可播放条目列表（标题 + URL）。
 * 支持「链接」（单个视频/声音）与「合集」（视频页分P/专辑/精选合集）两种形态。
 */

/** 已支持平台；新增平台时在此枚举追加 + 注册对应 provider */
export type UrlPlatform = 'douyin' | 'douyin-selected' | 'bilibili' | 'ximalaya' | 'generic' | 'direct';

/** 解析出的可播放条目（合集展开时一条一个视频/声音） */
export interface ResolvedItem {
  /** 条目名称：合集项来自平台标题（如 B 站分P名 / 抖音集标题），直链无标题 */
  title?: string;
  /** 可播放地址：直链或解析后的播放 URL */
  url: string;
}

/** 一次解析的完整结果 */
export interface UrlResolveResult {
  /** 命中平台：direct=直链；generic=通用兜底 */
  platform: UrlPlatform;
  /** 是否为直链（单个地址直接可播） */
  isDirect: boolean;
  /** 展开出的可播放条目（合集=多条目；单链接=一条） */
  items: ResolvedItem[];
  /** 失败/降级说明（空=成功） */
  error?: string;
}

/** 平台 provider 接口：新增平台只需实现并 register */
export interface UrlProvider {
  /** 平台标识，与 UrlPlatform 对应 */
  name: UrlPlatform;
  /** 是否命中该平台的地址形态（域名/路径特征） */
  detect(url: string): boolean;
  /**
   * 解析：返回可播放条目列表（直链/合集展开）。
   * 无法解析时抛错或返回空数组（由解析器统一降级为 generic/原地址）。
   * 实现方自行控制超时与请求头。
   */
  resolve(url: string): Promise<ResolvedItem[]>;
}
