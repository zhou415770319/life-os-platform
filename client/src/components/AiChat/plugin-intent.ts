/**
 * 安装/卸载插件意图识别。
 * 注意：动词与「插件」之间只允许极短间隔（≤4 个字符），避免长文本中
 * 「删除……插件」这类跨词误匹配（例如提交插件市场的指令文本里描述含「删除」、
 * 后文又出现「上传插件文件」时，宽松的 .* 会错误命中为「删除插件」）。
 */
const SHORT_GAP = '[\\s\\S]{0,4}';

const INSTALL_PATTERNS = [
  new RegExp(`安装${SHORT_GAP}插件`),
  new RegExp(`启用${SHORT_GAP}插件`),
  new RegExp(`加载${SHORT_GAP}插件`),
  new RegExp(`开启${SHORT_GAP}插件`),
  new RegExp(`装上${SHORT_GAP}插件`),
  /把[\s\S]{0,10}插件打开/,
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
  new RegExp(`卸载${SHORT_GAP}插件`),
  new RegExp(`禁用${SHORT_GAP}插件`),
  new RegExp(`关闭${SHORT_GAP}插件`),
  new RegExp(`移除${SHORT_GAP}插件`),
  new RegExp(`删掉${SHORT_GAP}插件`),
  new RegExp(`删除${SHORT_GAP}插件`),
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
