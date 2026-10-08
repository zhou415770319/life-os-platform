import type { AvailablePlugin, InstalledPlugin } from '@shared/api.interface';

export function filterPluginsByCategory(
  plugins: AvailablePlugin[],
  category: string,
): AvailablePlugin[] {
  if (!category || category === 'all') return plugins;
  return plugins.filter((p) => p.category === category);
}

export function getPluginCategories(plugins: AvailablePlugin[]): string[] {
  const set = new Set<string>();
  for (const p of plugins) {
    if (p.category) set.add(p.category);
  }
  return Array.from(set).sort();
}

export function isPluginEnabled(
  installed: InstalledPlugin[],
  pluginKey: string,
): boolean {
  return installed.some((p) => p.pluginKey === pluginKey);
}

export function sortPluginsByName(
  plugins: AvailablePlugin[],
): AvailablePlugin[] {
  return [...plugins].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
