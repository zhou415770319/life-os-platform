import { useMemo, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import zh_CN from 'antd/locale/zh_CN';

/**
 * 本地 AppContainer 替代实现。
 *
 * 原 @lark-apaas/client-toolkit 的 AppContainer 是为「妙搭托管平台」设计的容器：
 * 挂载时会请求发布应用信息（getAppInfo）、权限角色（/spark/app/{appId}/runtime/api/v1/permissions/roles）、
 * 并启用 TEA/监控上报（mon.zijieapi.com）与 dev 截图（PageHoc）等。
 * 本项目是本地独立运行的应用（非平台应用），这些请求在本地会 404 / CORS 失败，
 * 在控制台产生以下噪音：
 *   - POST /spark/app/null/runtime/api/v1/permissions/roles 404
 *   - Error fetching published app info: Unexpected token '<'
 *   - POST https://mon.zijieapi.com/monitor_browser/collect/batch 被 CORS 拦截 + 502
 *   - [Violation] unload is not allowed（平台 SDK 注册的监听器被浏览器策略拒绝）
 *
 * 本组件只保留 AppContainer 对项目有实际价值的部分：antd 主题（读取项目自己的
 * CSS 变量），去掉平台请求 / 权限 / 监控 / 水印 / 截图等全部副作用。
 */
function readAllCssVarColors() {
  try {
    if (typeof document === 'undefined') return {};
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim() || undefined;
    return {
      background: read('--background'),
      destructive: read('--destructive'),
      primary: read('--primary'),
      foreground: read('--foreground'),
      warning: read('--warning'),
      success: read('--success'),
      muted: read('--muted'),
      mutedForeground: read('--muted-foreground'),
      border: read('--border'),
      popover: read('--popover'),
      accent: read('--accent'),
    };
  } catch {
    return {};
  }
}

export function AppContainer({ children }: { children: ReactNode }) {
  const cssColors = useMemo(() => readAllCssVarColors(), []);

  const antdThemeToken = {
    colorBgBase: cssColors.background,
    colorError: cssColors.destructive,
    colorInfo: cssColors.primary,
    colorLink: cssColors.primary,
    colorPrimary: cssColors.primary,
    colorSuccess: cssColors.primary,
    colorTextBase: cssColors.foreground,
    colorWarning: cssColors.destructive,
  };
  const antdTableToken = {
    bodySortBg: cssColors.muted,
    borderColor: cssColors.border,
    expandIconBg: cssColors.background,
    filterDropdownBg: cssColors.popover,
    filterDropdownMenuBg: cssColors.popover,
    fixedHeaderSortActiveBg: cssColors.muted,
    footerBg: cssColors.muted,
    footerColor: cssColors.mutedForeground,
    headerBg: cssColors.muted,
    headerColor: cssColors.mutedForeground,
    headerFilterHoverBg: cssColors.muted,
    headerSortActiveBg: cssColors.muted,
    headerSortHoverBg: cssColors.muted,
    headerSplitColor: cssColors.border,
    rowExpandedBg: cssColors.background,
    rowHoverBg: cssColors.muted,
    rowSelectedBg: cssColors.accent,
    rowSelectedHoverBg: cssColors.accent,
    stickyScrollBarBg: cssColors.muted,
  };
  const antdPaginationToken = {
    itemActiveBg: cssColors.background,
    itemActiveBgDisabled: cssColors.muted,
    itemActiveColor: cssColors.primary,
    itemActiveColorDisabled: cssColors.muted,
    itemActiveColorHover: cssColors.muted,
    itemBg: cssColors.background,
    itemInputBg: cssColors.background,
    itemLinkBg: cssColors.background,
  };

  return (
    <ConfigProvider
      locale={zh_CN}
      theme={{
        token: antdThemeToken,
        components: {
          Table: antdTableToken,
          Pagination: antdPaginationToken,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
