const INSTALL_PATTERNS = [
  /安装.*插件/,
  /启用.*插件/,
  /加载.*插件/,
  /开启.*插件/,
  /装上.*插件/,
  /把.*插件打开/,
  /安装儿童资料站/,
  /安装RPA/,
  /安装 rpa/,
  /启用儿童资料站/,
  /启用RPA/,
  /启用 rpa/,
  /把儿童资料站打开/,
  /把RPA打开/,
  /把 rpa 打开/,
];

const UNINSTALL_PATTERNS = [
  /卸载.*插件/,
  /禁用.*插件/,
  /关闭.*插件/,
  /移除.*插件/,
  /删掉.*插件/,
  /删除.*插件/,
  /卸载儿童资料站/,
  /卸载RPA/,
  /卸载 rpa/,
  /禁用儿童资料站/,
  /禁用RPA/,
  /禁用 rpa/,
  /把儿童资料站关掉/,
  /把RPA关掉/,
];

const CHILD_PLUGIN_KEYWORDS =
  /儿童|资料站|child|启蒙|绘本|资源|raz|廖彩杏|牛津|海尼曼/i;

const RPA_PLUGIN_KEYWORDS =
  /rpa|微信|公众号|影刀|kimi|创作中心|自动/i;

interface PluginIntent {
  action: 'install' | 'uninstall' | null;
  plugin: 'child' | 'rpa' | null;
}

export function detectPluginIntent(text: string): PluginIntent {
  const isChild = CHILD_PLUGIN_KEYWORDS.test(text);
  const isRpa = RPA_PLUGIN_KEYWORDS.test(text);
  if (!isChild && !isRpa) return { action: null, plugin: null };

  const plugin: 'child' | 'rpa' = isChild ? 'child' : 'rpa';

  for (const pattern of INSTALL_PATTERNS) {
    if (pattern.test(text)) return { action: 'install', plugin };
  }
  for (const pattern of UNINSTALL_PATTERNS) {
    if (pattern.test(text)) return { action: 'uninstall', plugin };
  }

  return { action: null, plugin };
}
