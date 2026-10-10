import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { PluginConfig } from '@shared/api.interface';

interface RegisteredPlugin {
  key: string;
  mount: (el: HTMLElement, ctx: { api: (path: string) => string }) => void;
  unmount?: () => void;
}

type LifePluginRegistry = Record<string, RegisteredPlugin>;

interface LifePluginWindow extends Window {
  __lifePlugins?: LifePluginRegistry;
  __lifePluginRegister?: (plugin: RegisteredPlugin) => void;
}

/** 在线市场插件宿主：加载插件入口 JS 并挂载到容器 */
export default function PluginHost({ plugin }: { plugin: PluginConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<RegisteredPlugin | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      setState('loading');
      try {
        const win = window as LifePluginWindow;

        // 确保注册函数存在：插件 JS 调用 __lifePluginRegister 时存入全局注册表
        if (!win.__lifePluginRegister) {
          win.__lifePluginRegister = (p: RegisteredPlugin) => {
            if (!win.__lifePlugins) win.__lifePlugins = {};
            win.__lifePlugins[p.key] = p;
          };
        }

        const entry = 'plugin.js';
        const scriptUrl = `/api/market/serve/${plugin.pluginKey}/${entry}`;
        const loadedKey = `life-os:market-script:${plugin.pluginKey}`;
        if (!(win as any)[loadedKey]) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`加载插件脚本失败：${scriptUrl}`));
            document.body.appendChild(script);
          });
          (win as any)[loadedKey] = true;
        }

        if (disposed) return;

        const found = win.__lifePlugins?.[plugin.pluginKey];
        if (!found) {
          throw new Error('插件未正确注册（未调用 __lifePluginRegister）');
        }

        mountedRef.current = found;
        if (containerRef.current) {
          found.mount(containerRef.current, {
            api: (path: string) => (path ? path : ''),
          });
        }
        setState('ready');
      } catch (err) {
        if (disposed) return;
        setState('error');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    };

    load();

    return () => {
      disposed = true;
      try {
        mountedRef.current?.unmount?.();
      } catch {
        // 忽略卸载异常
      }
      mountedRef.current = null;
    };
  }, [plugin.pluginKey]);

  if (state === 'error') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-8 py-6 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
          <div className="text-sm text-rose-200">插件加载失败</div>
          <div className="text-xs text-rose-300/70">{errorMsg}</div>
        </div>
      </div>
    );
  }

  return (
    <div data-plugin-host data-plugin-key={plugin.pluginKey}>
      {state === 'loading' && (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-sm text-zinc-400">正在加载插件「{plugin.name}」...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className={state === 'ready' ? '' : 'hidden'} />
    </div>
  );
}
