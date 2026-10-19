import { UrlResolverService } from './url-resolver.service';
import { BilibiliProvider } from './providers/bilibili.provider';
import { DouyinProvider, DouyinSelectedProvider } from './providers/douyin.provider';
import { XimalayaProvider } from './providers/ximalaya.provider';
import { GenericProvider } from './providers/generic.provider';

/**
 * 平台注册表：内置 5 类平台，命中顺序 = 注册顺序（douyin 先于 generic 等）。
 * 新增平台：在 providers/ 下新增文件实现 UrlProvider，并在此 register 一行即可。
 */
export const defaultUrlResolver: UrlResolverService = new UrlResolverService([
  new DouyinProvider(),
  new DouyinSelectedProvider(),
  new BilibiliProvider(),
  new XimalayaProvider(),
  new GenericProvider(),
]);

/** 供需要独立实例的调用方使用 */
export { UrlResolverService } from './url-resolver.service';
export type {
  ResolvedItem,
  UrlPlatform,
  UrlProvider,
  UrlResolveOptions,
  UrlResolveResult,
} from './types';
