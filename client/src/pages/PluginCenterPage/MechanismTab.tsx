import {
  Layers,
  Zap,
  Boxes,
  Lightbulb,
  Cpu,
  Puzzle,
  Shield,
  Route,
  Radio,
  Settings,
  Server,
  Database,
  ArrowRight,
  Play,
  Pause,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';

const principles = [
  {
    icon: Layers,
    title: '一切皆插件',
    description:
      'Everything is a plugin. 系统主壳仅提供抽象的看板框架和基础运行时，所有业务能力都以插件形式动态装载，实现真正的模块化架构。',
    gradient: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/20',
  },
  {
    icon: Zap,
    title: '热插拔机制',
    description:
      '插件可以在运行时动态安装和卸载，无需重启系统。AI 聊天窗口作为唯一入口，通过自然语言指令触发插件装载，实时生效。',
    gradient: 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
  },
  {
    icon: Boxes,
    title: 'DSH 规范',
    description:
      'Dynamic Service Host 插件规范定义了插件的结构、生命周期和上下文 API。所有插件遵循同一套接口契约，保证可组合性和可替换性。',
    gradient: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/20',
  },
  {
    icon: Lightbulb,
    title: '无缝缝合',
    description:
      '主系统通过动态上下文将插件的 UI 与逻辑无缝缝合到主界面。插件以服务卡片形式追加到看板网格末尾，同时自动注册路由和导航入口。',
    gradient: 'from-pink-500/20 to-rose-500/20 border-pink-500/20',
  },
];

const kernelDuties = [
  {
    icon: Puzzle,
    title: '插件加载/卸载',
    desc: '负责插件的发现、解析、加载和卸载，维护插件拓扑图和生命周期状态机。',
  },
  {
    icon: Route,
    title: '依赖管理',
    desc: '解析插件间的依赖关系，确保按正确顺序装载，检测循环依赖并降级处理。',
  },
  {
    icon: Server,
    title: '服务注册',
    desc: '管理插件注册的服务实例，提供服务发现与依赖注入能力。',
  },
  {
    icon: Radio,
    title: '事件总线',
    desc: '提供全局事件发布订阅机制，支持插件间解耦通信和跨插件联动。',
  },
  {
    icon: Shield,
    title: '权限控制',
    desc: '基于风险等级的沙箱隔离，限制插件访问范围，保障用户数据安全。',
  },
  {
    icon: Database,
    title: '数据路由',
    desc: '统一管理数据模型注册、Schema 校验和数据读写路由，隔离插件数据空间。',
  },
];

const uiExtensionTypes = [
  { key: 'page', desc: '独立页面路由' },
  { key: 'widget', desc: '看板小组件' },
  { key: 'sidebar', desc: '侧边栏导航项' },
  { key: 'toolbar', desc: '工具栏按钮' },
  { key: 'context-menu', desc: '右键上下文菜单' },
  { key: 'settings-panel', desc: '设置面板' },
  { key: 'data-view', desc: '数据视图渲染' },
  { key: 'export-format', desc: '导出格式扩展' },
];

const runModes = [
  {
    name: '生活模式',
    desc: '日常使用，展示精选插件和核心看板，界面简洁友好',
    color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  },
  {
    name: '专业模式',
    desc: '展示全部已安装插件，高级功能全开，适合深度用户',
    color: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  },
  {
    name: '极简模式',
    desc: '只保留核心看板，隐藏所有插件，专注当下',
    color: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300',
  },
  {
    name: '创造者模式',
    desc: '开启开发工具和插件 SDK，支持热重载和调试',
    color: 'border-purple-500/20 bg-purple-500/10 text-purple-300',
  },
];

const riskLevels = [
  {
    level: '低风险',
    desc: '只读访问，纯展示类插件，不修改用户数据',
    color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  },
  {
    level: '中风险',
    desc: '可写入业务数据，但受沙箱限制，无法访问系统层',
    color: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
  },
  {
    level: '高风险',
    desc: '可访问系统级 API 和外部网络，需用户显式授权',
    color: 'border-red-500/30 text-red-300 bg-red-500/10',
  },
];

const lifecycleStates = [
  { key: 'discovered', label: '已发现', icon: Search, desc: '插件被扫描发现，等待解析' },
  { key: 'resolving', label: '解析中', icon: Loader2, desc: '正在解析依赖和配置清单' },
  { key: 'loading', label: '加载中', icon: Loader2, desc: '正在加载模块代码和资源' },
  { key: 'active', label: '运行中', icon: Play, desc: '插件正常运行，提供服务' },
  { key: 'suspended', label: '已暂停', icon: Pause, desc: '被挂起，保留状态但不执行' },
  { key: 'unloaded', label: '已卸载', icon: XCircle, desc: '已从内存中卸载，资源释放' },
];

const MechanismTab = () => {
  return (
    <div className="space-y-6">
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            核心理念：一切皆插件
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Everything is a Plugin — Life-OS 的核心设计哲学
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Life-OS 奉行「一切皆插件」的设计理念。系统主壳（Core Kernel）只提供高度抽象的人生管理看板框架和插件运行时环境，
            所有具体的业务功能——无论是目标管理、习惯打卡，还是儿童资料站、RPA 创作——都以独立插件的形式存在。
            这种架构使得平台能够在「个人效率工具」「家庭教育助手」「自由职业工作台」之间无缝切换，
            真正实现一个系统、无限可能。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className={`p-5 rounded-xl bg-gradient-to-br ${p.gradient} border`}
                >
                  <Icon className="w-6 h-6 text-zinc-50 mb-3" />
                  <h3 className="text-sm font-semibold text-zinc-50 mb-2">
                    {p.title}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 核心内核职责 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            核心内核职责
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Core Kernel 承担的 6 大核心职责
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {kernelDuties.map((duty) => {
              const Icon = duty.icon;
              return (
                <div
                  key={duty.title}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                >
                  <Icon className="w-5 h-5 text-indigo-400 mb-2" />
                  <h4 className="text-sm font-medium text-zinc-50 mb-1">
                    {duty.title}
                  </h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {duty.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 插件 API 规范 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-400" />
            LifeOSPlugin 接口规范
          </CardTitle>
          <CardDescription className="text-zinc-400">
            插件必须实现的核心接口方法
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto bg-black/40 rounded-lg border border-white/5">
            <code>{`interface LifeOSPlugin {
  // 插件清单声明
  manifest: PluginManifest;
  // 激活钩子：插件装载时执行
  activate(ctx: PluginContext): Promise<void>;
  // 停用钩子：插件卸载前执行
  deactivate(): Promise<void>;
  // 获取插件能力列表
  getCapabilities(): PluginCapability[];
  // 获取数据 Schema 定义
  getSchemas(): SchemaDefinition[];
  // 获取 UI 扩展点配置
  getUIExtensions(): UIExtension[];
}`}</code>
          </pre>
        </CardContent>
      </Card>

      {/* UIExtension 类型 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-amber-400" />
            UIExtension 扩展点类型
          </CardTitle>
          <CardDescription className="text-zinc-400">
            插件可向主界面注入的 8 种 UI 扩展
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {uiExtensionTypes.map((ext) => (
              <div
                key={ext.key}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center"
              >
                <code className="text-xs font-mono text-emerald-300">
                  {ext.key}
                </code>
                <div className="text-xs text-zinc-500 mt-1">{ext.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 事件机制 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Radio className="w-4 h-4 text-pink-400" />
            事件机制
          </CardTitle>
          <CardDescription className="text-zinc-400">
            插件间解耦通信的发布订阅模式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            插件通过事件总线进行跨插件通信，采用 emit/on
            发布订阅模式。事件分为系统事件和自定义事件两类，
            系统事件由内核触发（如 plugin:activated、plugin:suspended），自定义事件由插件自由定义。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-black/30 border border-white/5">
              <code className="text-xs font-mono text-emerald-400">
                ctx.events.on(event, handler)
              </code>
              <p className="text-xs text-zinc-500 mt-2">
                订阅事件，返回取消订阅函数
              </p>
            </div>
            <div className="p-4 rounded-lg bg-black/30 border border-white/5">
              <code className="text-xs font-mono text-emerald-400">
                ctx.events.emit(event, payload)
              </code>
              <p className="text-xs text-zinc-500 mt-2">
                发布事件，payload 透传给所有订阅者
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 四种运行模式 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            四种运行模式
          </CardTitle>
          <CardDescription className="text-zinc-400">
            根据使用场景切换系统运行模式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {runModes.map((mode) => (
              <div
                key={mode.name}
                className={`p-4 rounded-xl border ${mode.color}`}
              >
                <h4 className="text-sm font-semibold mb-1">{mode.name}</h4>
                <p className="text-xs opacity-80 leading-relaxed">
                  {mode.desc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 权限等级模型 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400" />
            权限等级与沙箱隔离
          </CardTitle>
          <CardDescription className="text-zinc-400">
            三级风险等级 + 沙箱隔离，保障用户数据安全
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {riskLevels.map((r) => (
              <div
                key={r.level}
                className={`p-4 rounded-xl border ${r.color}`}
              >
                <h4 className="text-sm font-semibold mb-1">{r.level}</h4>
                <p className="text-xs opacity-80 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            沙箱隔离理念：所有插件默认运行在受限上下文中，只能访问明确授权的 API
            与数据。高风险操作需用户显式授权并记录到 LifeLog
            审计日志，确保每一次敏感操作都可追溯。
          </p>
        </CardContent>
      </Card>

      {/* 插件生命周期状态机 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-purple-400" />
            插件生命周期状态机
          </CardTitle>
          <CardDescription className="text-zinc-400">
            插件从发现到卸载的 6 个状态流转
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 状态流转图 */}
          <div className="flex flex-wrap items-center justify-center gap-2 py-4">
            {lifecycleStates.map((state, idx) => {
              const Icon = state.icon;
              return (
                <div key={state.key} className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center">
                      <Icon
                        className={`w-5 h-5 ${
                          state.key === 'active'
                            ? 'text-emerald-400'
                            : state.key === 'suspended'
                              ? 'text-amber-400'
                              : state.key === 'unloaded'
                                ? 'text-zinc-500'
                                : 'text-zinc-400'
                        } ${
                          state.key === 'resolving' || state.key === 'loading'
                            ? 'animate-spin'
                            : ''
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-2 font-medium">
                      {state.label}
                    </span>
                  </div>
                  {idx < lifecycleStates.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-zinc-600 mx-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* 状态说明列表 */}
          <div className="space-y-2">
            {lifecycleStates.map((state) => {
              const Icon = state.icon;
              return (
                <div
                  key={state.key}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5"
                >
                  <Icon className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">
                        {state.label}
                      </span>
                      <code className="text-[10px] font-mono text-zinc-500 bg-black/30 px-2 py-0.5 rounded">
                        {state.key.toUpperCase()}
                      </code>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{state.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
            <p className="text-xs text-zinc-400 leading-relaxed">
              <Badge
                variant="outline"
                className="text-[10px] border-indigo-500/30 text-indigo-300 bg-indigo-500/10 mr-2"
              >
                提示
              </Badge>
              suspended 状态的插件保留内存中的状态和数据，但停止执行事件监听和
              UI 渲染。从 suspended 恢复到 active 无需重新加载资源。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* DSH 插件规范 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-purple-400" />
            DSH 插件规范
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Dynamic Service Host — 动态服务主机插件规范
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            DSH (Dynamic Service Host) 是 Life-OS 的插件规范，定义了插件的标准结构、生命周期和上下文 API。
            每个插件都是一个独立的模块，通过{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">
              apply
            </code>{' '}
            函数与主系统交互。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '看板扩展', desc: '动态追加卡片' },
              { label: '路由注册', desc: '自动添加页面' },
              { label: '导航注入', desc: '侧边栏菜单项' },
              { label: '数据模型', desc: '表结构自动注册' },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center"
              >
                <div className="text-sm font-medium text-zinc-50">
                  {item.label}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 插件热缝合原理 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            插件热缝合原理
          </CardTitle>
          <CardDescription className="text-zinc-400">
            主系统如何将插件动态缝合到界面中
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              {
                step: '1',
                title: '插件装载',
                desc: '用户通过 AI 对话或设置页面触发插件安装，系统读取插件配置并初始化插件模块',
              },
              {
                step: '2',
                title: '上下文注入',
                desc: '主系统向插件 apply 函数注入 DshContext 对象，包含看板、路由、导航、数据库等扩展能力',
              },
              {
                step: '3',
                title: '动态缝合',
                desc: '插件通过 ctx.dashboard.extendModule 等 API 向主界面追加服务卡片，卡片自动出现在看板网格末尾',
              },
              {
                step: '4',
                title: '路由注册',
                desc: '插件的二级页面路由自动注册到路由表，侧边栏导航自动添加对应菜单项',
              },
              {
                step: '5',
                title: '状态持久化',
                desc: '插件的启用状态和配置写入 dsh-profile 插件拓扑，刷新页面后保持装载状态',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-semibold text-white">
                  {item.step}
                </div>
                <div className="flex-1 pt-1">
                  <h4 className="text-sm font-medium text-zinc-50">
                    {item.title}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MechanismTab;
