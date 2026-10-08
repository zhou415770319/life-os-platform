import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { PluginConfig } from '@shared/api.interface';
import { pluginsApi } from '@client/src/api';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface PluginsContextValue {
  plugins: PluginConfig[];
  enabledPlugins: PluginConfig[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const PluginsContext = createContext<PluginsContextValue | null>(null);

export function PluginsProvider({ children }: { children: React.ReactNode }) {
  const [plugins, setPlugins] = useState<PluginConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await pluginsApi.getPlugins();
      setPlugins(data.items);
      setError(null);
    } catch (err) {
      logger.error('Failed to load plugins', { error: String(err) });
      setError('插件列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handleUpdate = () => {
      refresh();
    };
    window.addEventListener('life-os:plugin-updated', handleUpdate);
    return () => {
      window.removeEventListener('life-os:plugin-updated', handleUpdate);
    };
  }, [refresh]);

  const enabledPlugins = plugins.filter(
    (p) =>
      p.enabled &&
      p.lifecycleStatus === 'active' &&
      p.pluginKey !== 'dsh-plugin-life-dashboard',
  );

  return (
    <PluginsContext.Provider value={{ plugins, enabledPlugins, loading, error, refresh }}>
      {children}
    </PluginsContext.Provider>
  );
}

export function usePlugins() {
  const ctx = useContext(PluginsContext);
  if (!ctx) {
    throw new Error('usePlugins must be used within PluginsProvider');
  }
  return ctx;
}
