import {
  Sparkles,
  LayoutDashboard,
  Baby,
  Bot,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';

const builtInPlugins = [
  {
    key: 'dsh-plugin-life-dashboard',
    name: '人生管理看板',
    description: '系统核心插件，提供抽象的人生管理主看板框架。包含三大核心模块：愿景与目标层（OKR 目标追踪、里程碑管理）、能量与时间层（习惯打卡、精力记录、时间管理）、认知与资产层（闪念笔记、原则库、快速链接）。',
    icon: LayoutDashboard,
    gradient: 'from-indigo-500 to-purple-600',
    features: ['目标 OKR 管理', '习惯打卡追踪', '精力状态记录', '闪念笔记系统', '人生原则库', '快速链接收藏'],
    isCore: true,
    version: '1.0.0',
  },
  {
    key: 'dsh-plugin-child-resources',
    name: '儿童资料站',
    description: '儿童自学与启蒙资料库插件，提供一站式英语启蒙和分级阅读资源导航。聚合 RAZ 分级阅读、廖彩杏绘本、牛津阅读树、海尼曼等主流英语学习资源，配合点读笔使用指南和学习进度追踪。',
    icon: Baby,
    gradient: 'from-cyan-500 to-blue-500',
    features: ['RAZ 分级阅读导航', '廖彩杏绘本列表', '牛津阅读树资源', '海尼曼分级读物', '点读笔使用指南', '学习计划推荐'],
    isCore: false,
    version: '1.0.0',
  },
  {
    key: 'dsh-plugin-wechat-rpa',
    name: 'RPA 智能创作中心',
    description: '智能内容创作自动化插件，通过影刀 RPA 联动 Kimi AI 自动生成公众号草稿，实现选题策划、文案撰写、排版优化、一键发布的全流程自动化。适用于个人公众号运营者和内容创作者。',
    icon: Bot,
    gradient: 'from-amber-500 to-red-500',
    features: ['影刀 RPA 流程编排', 'Kimi AI 文案生成', '公众号草稿发布', '选题库管理', '内容模板配置', '发布数据追踪'],
    isCore: false,
    version: '1.0.0',
  },
];

const BuiltInTab = () => {
  return (
    <div className="space-y-6">
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            内置插件一览
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Life-OS 官方提供的内置插件，开箱即用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {builtInPlugins.map((plugin) => {
            const Icon = plugin.icon;
            return (
              <div
                key={plugin.key}
                className="p-5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/15 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plugin.gradient} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-zinc-50">
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
                          核心插件
                        </Badge>
                      )}
                      <code className="text-xs font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded">
                        {plugin.key}
                      </code>
                    </div>
                    <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                      {plugin.description}
                    </p>
                    <div className="mt-4">
                      <div className="text-xs font-medium text-zinc-400 mb-2">主要功能</div>
                      <div className="flex flex-wrap gap-2">
                        {plugin.features.map((f) => (
                          <Badge
                            key={f}
                            variant="outline"
                            className="text-xs border-white/10 text-zinc-300 bg-white/[0.02]"
                          >
                            <ArrowRight className="w-3 h-3 mr-1 text-indigo-400" />
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            更多插件即将到来
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-300">
          <p className="mb-4">
            Life-OS 的插件生态正在持续扩展中。未来将陆续推出更多实用插件，包括但不限于：
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: '财务管家', status: '规划中' },
              { name: '阅读实验室', status: '规划中' },
              { name: '健康实验室', status: '规划中' },
              { name: '项目管理', status: '规划中' },
              { name: '知识库', status: '规划中' },
              { name: '冥想训练', status: '规划中' },
            ].map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <span className="text-sm text-zinc-300">{p.name}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] border-zinc-500/30 text-zinc-400"
                >
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BuiltInTab;
