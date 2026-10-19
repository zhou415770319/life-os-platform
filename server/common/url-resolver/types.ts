/**
 * 公共链接解析器 · 类型定义
 * 供任意模块复用：识别平台 → 平台 provider 解析出可播放条目列表（标题 + URL）。
 * 支持「链接」（单个视频/声音）与「合集」（视频页分P/专辑/精选合集）两种形态。
 */

/** 已支持平台；新增平台时在此枚举追加 + 注册对应 provider */
export type UrlPlatform = 'douyin' | 'douyin-selected' | 'bilibili' | 'ximalaya' | 'generic' | 'direct';

/** 解析所需的额外条件（如平台接口需要登录 Cookie），由调用方在 UI 上收集后传入 */
export interface UrlResolveOptions {
  /** 登录态 Cookie（喜马拉雅等平台解析接口需要） */
  cookie?: string;
}

/** 解析出的可播放条目（合集展开时一条一个视频/声音） */
export interface ResolvedItem {
  /** 条目名称：合集项来自平台标题（如 B 站分P名 / 抖音集标题），直链无标题 */
  title?: string;
  /** 可播放地址：直链或解析后的播放 URL */
  url: string;
}

/** 浏览器辅助解析的待解析条目（喜马拉雅防盗链：需在已登录的浏览器页面运行脚本取直链） */
export interface BrowserAssistTrack {
  /** 平台侧的声音/视频 id */
  id: string;
  /** 标题 */
  title: string;
}

/** 平台需要调用方补充的条件 */
export interface ResolveRequirement {
  /** 平台标识 */
  platform: UrlPlatform;
  /** 需要什么条件：cookie=登录 Cookie；browser=需浏览器辅助（运行脚本取直链） */
  kind: 'cookie' | 'browser';
  /** 给用户看的提示文案（如何获取该条件） */
  hint: string;
  /** 附加数据（browser 模式：token + 待解析条目，用于前端弹框与脚本生成） */
  payload?: {
    /** 一次性令牌，脚本回传直链时校验 */
    token: string;
    /** 待解析条目列表 */
    trackIds: BrowserAssistTrack[];
    /** 后端 API 前缀（脚本回传直链的地址由调用方动态拼 baseUrl） */
    baseUrl?: string;
  };
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
  /** 解析需要用户补充条件（如 Cookie）时返回；调用方应先收集条件再带条件重试 */
  requires?: ResolveRequirement;
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
   * 需要调用方补充条件（Cookie）时抛 RequireCookieError，由解析器转为 requires 提示。
   * options：调用方收集到的额外条件（如 cookie）。
   */
  resolve(url: string, options?: UrlResolveOptions): Promise<ResolvedItem[]>;
}

/** 平台需要 Cookie 才能解析：解析器捕获后返回 requires 提示（不再降级 generic） */
export class RequireCookieError extends Error {
  constructor(
    public readonly platform: UrlPlatform,
    public readonly hint: string,
  ) {
    super(`平台 ${platform} 需要 Cookie`);
    this.name = 'RequireCookieError';
  }
}

/**
 * 平台需要浏览器辅助才能解析（如喜马拉雅防盗链：后端请求被风控拦截，
 * 需用户在已登录的浏览器页面运行脚本取直链并回传）：
 * 解析器捕获后返回 requires(kind='browser')，由调用方完成浏览器辅助流程。
 */
export class RequireBrowserError extends Error {
  constructor(
    public readonly platform: UrlPlatform,
    public readonly hint: string,
    public readonly trackIds: BrowserAssistTrack[],
  ) {
    super(`平台 ${platform} 需要浏览器辅助解析`);
    this.name = 'RequireBrowserError';
  }
}
