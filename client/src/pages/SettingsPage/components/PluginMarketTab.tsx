import React from 'react';
import { Sparkles, Download, Check, Loader2 } from 'lucide-react';
import type { AvailablePlugin } from '@shared/api.interface';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { getPluginIcon } from '@client/src/utils/plugin-icons';

const categoryLabels: Record<string, string> = {
  core: '核心模块',
  education: '教育学习',
  productivity: '效率工具',
  finance: '财务管理',
  lifestyle: '生活方式',
  health: '健康管理',
};

interface PluginMarketTabProps {
  plugins: AvailablePlugin[];
  loading: boolean;
  installingKey: string | null;
  isInstalled: (pluginKey: string) => boolean;
  onInstall: (plugin: AvailablePlugin) => void;
  availableCount: number;
}

const PluginMarketTab: React.FC<PluginMarketTabProps> = ({
  plugins,
  loading,
  installingKey,
  isInstalled,
  onInstall,
  availableCount,
}) => {
  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          发现插件
        </CardTitle>
        <CardDescription className="text-zinc-400">
          浏览可用插件，一键安装扩展 Life-OS 功能 · 共 {availableCount} 个可用插件
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            正在加载插件列表...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plugins.map((plugin) => {
              const Icon = getPluginIcon(plugin.config.cardIcon);
              const installed = isInstalled(plugin.pluginKey);
              const isInstalling = installingKey === plugin.pluginKey;
              return (
                <div
                  key={plugin.pluginKey}
                  className="group relative p-5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300"
                >
                  <div
                    className="absolute top-0 left-0 w-full h-0.5 rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(to right, ${plugin.config.gradientFrom}, ${plugin.config.gradientTo})`,
                    }}
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${plugin.config.gradientFrom}33, ${plugin.config.gradientTo}33)`,
                        }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium text-zinc-50 truncate">
                            {plugin.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-xs border-white/10 text-zinc-400 bg-white/[0.02]"
                          >
                            v{plugin.version}
                          </Badge>
                          {plugin.isCore && (
                            <Badge
                              variant="outline"
                              className="text-xs border-indigo-500/30 text-indigo-300 bg-indigo-500/10"
                            >
                              核心
                            </Badge>
                          )}
                          {installed && (
                            <Badge
                              variant="outline"
                              className="text-xs border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              已安装
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">
                          {plugin.description}
                        </p>
                        <div className="mt-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-white/5 text-zinc-500"
                          >
                            {categoryLabels[plugin.category] || plugin.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {plugin.config.routePath}
                    </span>
                    {installed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        已安装
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onInstall(plugin)}
                        disabled={isInstalling}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            安装中
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 mr-1" />
                            安装
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PluginMarketTab;
