import {
  filterPluginsByCategory,
  getPluginCategories,
  isPluginEnabled,
  sortPluginsByName,
} from '../../../client/src/utils/plugin-utils';
import type { AvailablePlugin, InstalledPlugin } from '@shared/api.interface';

function makeAvailable(overrides: Partial<AvailablePlugin> = {}): AvailablePlugin {
  return {
    pluginKey: 'test-plugin',
    name: '测试插件',
    description: '',
    version: '1.0.0',
    category: 'productivity',
    isCore: false,
    installed: false,
    config: {
      cardTitle: '',
      cardDescription: '',
      cardIcon: '',
      routePath: '/test',
      gradientFrom: '#000',
      gradientTo: '#fff',
    },
    ...overrides,
  };
}

function makeInstalled(pluginKey: string): InstalledPlugin {
  return {
    id: `id-${pluginKey}`,
    pluginKey,
    name: 'Installed',
    description: '',
    version: '1.0.0',
    enabled: true,
    isCore: false,
    installedAt: '2024-01-01T00:00:00Z',
    config: {
      cardTitle: '',
      cardDescription: '',
      cardIcon: '',
      routePath: '/x',
      gradientFrom: '#000',
      gradientTo: '#fff',
    },
  };
}

describe('plugin-utils', () => {
  describe('filterPluginsByCategory', () => {
    it('returns all plugins for "all" category', () => {
      const plugins = [
        makeAvailable({ pluginKey: 'a', category: 'education' }),
        makeAvailable({ pluginKey: 'b', category: 'productivity' }),
      ];
      expect(filterPluginsByCategory(plugins, 'all')).toHaveLength(2);
    });

    it('returns all plugins for empty category', () => {
      const plugins = [makeAvailable({ category: 'edu' })];
      expect(filterPluginsByCategory(plugins, '')).toHaveLength(1);
    });

    it('filters by exact category match', () => {
      const plugins = [
        makeAvailable({ pluginKey: 'a', category: 'education' }),
        makeAvailable({ pluginKey: 'b', category: 'productivity' }),
        makeAvailable({ pluginKey: 'c', category: 'education' }),
      ];
      const result = filterPluginsByCategory(plugins, 'education');
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.category === 'education')).toBe(true);
    });
  });

  describe('getPluginCategories', () => {
    it('returns unique sorted categories', () => {
      const plugins = [
        makeAvailable({ category: 'zebra' }),
        makeAvailable({ category: 'apple' }),
        makeAvailable({ category: 'apple' }),
      ];
      expect(getPluginCategories(plugins)).toEqual(['apple', 'zebra']);
    });

    it('returns empty array for empty input', () => {
      expect(getPluginCategories([])).toEqual([]);
    });
  });

  describe('isPluginEnabled', () => {
    it('returns true when plugin is in installed list', () => {
      const installed = [makeInstalled('plugin-a'), makeInstalled('plugin-b')];
      expect(isPluginEnabled(installed, 'plugin-a')).toBe(true);
    });

    it('returns false when plugin not installed', () => {
      const installed = [makeInstalled('plugin-a')];
      expect(isPluginEnabled(installed, 'plugin-z')).toBe(false);
    });

    it('returns false for empty installed list', () => {
      expect(isPluginEnabled([], 'any')).toBe(false);
    });
  });

  describe('sortPluginsByName', () => {
    it('sorts plugins by name alphabetically', () => {
      const plugins = [
        makeAvailable({ pluginKey: 'b', name: 'Banana' }),
        makeAvailable({ pluginKey: 'a', name: 'Apple' }),
      ];
      const result = sortPluginsByName(plugins);
      expect(result[0].pluginKey).toBe('a');
      expect(result[1].pluginKey).toBe('b');
    });

    it('does not mutate original array', () => {
      const plugins = [
        makeAvailable({ pluginKey: 'b', name: 'B' }),
        makeAvailable({ pluginKey: 'a', name: 'A' }),
      ];
      const original = [...plugins];
      sortPluginsByName(plugins);
      expect(plugins).toEqual(original);
    });
  });
});
