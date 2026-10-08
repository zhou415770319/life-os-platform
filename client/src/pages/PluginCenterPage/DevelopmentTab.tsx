import { useState } from 'react';
import {
  Code2,
  Terminal,
  FileCode,
  Puzzle,
  LayoutDashboard,
  Copy,
  Check,
  Rocket,
  BookOpen,
  Wrench,
  Package,
  Play,
  Square,
  Radio,
  ScrollText,
  Palette,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';

const pluginExampleCode = `// my-first-plugin.ts
// DSH 插件开发示例：创建一个待办事项插件

import type { DshPlugin, DshContext } from '@life-os/dsh-core';

const plugin: DshPlugin = {
  name: 'dsh-plugin-todo',
  version: '1.0.0',
  description: '简洁高效的待办事项管理插件',

  apply(ctx: DshContext, config: Record<string, any>) {
    // 1. 向看板追加服务卡片
    ctx.dashboard.extendModule({
      title: '待办事项',
      desc: '今日任务 · 待办清单 · 优先级管理',
      status: 'ready',
      actionRoute: '/todo',
      icon: 'check-square',
      gradientFrom: '#10b981',
      gradientTo: '#14b8a6',
      order: 10,
    });

    // 2. 注册二级页面路由
    ctx.router.register({
      path: '/todo',
      component: () => import('./pages/TodoPage'),
    });

    // 3. 注册侧边栏导航
    ctx.sidebar.addItem({
      label: '待办事项',
      icon: 'check-square',
      path: '/todo',
      category: 'productivity',
    });

    // 4. 注册数据模型
    ctx.db.registerTable('life_todos', {
      id: 'uuid',
      title: 'varchar',
      completed: 'boolean',
      priority: 'integer',
      dueDate: 'date',
    });

    // 5. 注册 API 接口
    ctx.api.registerModule({
      prefix: '/api/todos',
      controllers: [TodoController],
      services: [TodoService],
    });
  },
};

export default plugin;`;

const profileExample = `// dsh-profile.json
// 插件拓扑配置文件
{
  "platformName": "Life-OS",
  "version": "1.0.0",
  "theme": "dark-minimal",
  "plugins": [
    {
      "name": "dsh-plugin-life-dashboard",
      "enabled": true,
      "isCore": true,
      "description": "人生管理核心看板插件",
      "version": "1.0.0",
      "config": {
        "cardTitle": "人生看板",
        "cardDescription": "目标追踪、习惯打卡、认知笔记",
        "cardIcon": "dashboard",
        "routePath": "/"
      }
    },
    {
      "name": "dsh-plugin-child-resources",
      "enabled": true,
      "isCore": false,
      "description": "儿童自学与启蒙资料库",
      "version": "1.0.0",
      "config": {
        "cardTitle": "儿童资料站",
        "cardDescription": "RAZ分级阅读 · 廖彩杏 · 牛津树",
        "cardIcon": "baby",
        "routePath": "/child-resources"
      }
    }
  ]
}`;

const contextApiExample = `// DshContext API 速查

interface DshContext {
  // 看板扩展
  dashboard: {
    extendModule(card: PluginCardConfig): void;
    removeModule(pluginKey: string): void;
    getModules(): PluginCardConfig[];
  };

  // 路由注册
  router: {
    register(route: RouteConfig): void;
    unregister(path: string): void;
  };

  // 侧边栏导航
  sidebar: {
    addItem(item: SidebarItem): void;
    removeItem(key: string): void;
  };

  // 数据模型
  db: {
    registerTable(name: string, schema: TableSchema): void;
    getTable(name: string): TableSchema | null;
  };

  // API 接口
  api: {
    registerModule(module: ApiModuleConfig): void;
  };

  // 事件总线
  events: {
    on(event: string, handler: Function): void;
    emit(event: string, data?: any): void;
  };
}`;

const helloLifePluginCode = `// src/index.ts — HelloLifePlugin 最小可用插件示例

import type { LifeOSPlugin, PluginContext } from '@life-os/core';

const HelloLifePlugin: LifeOSPlugin = {
  // === manifest 声明 ===
  manifest: {
    key: 'hello-life-plugin',
    name: '你好人生',
    version: '0.1.0',
    description: 'Life-OS 插件开发入门示例',
    author: 'your-name',
    riskLevel: 'low',
    categories: ['productivity'],
  },

  // === activate 生命周期钩子 ===
  async activate(ctx: PluginContext) {
    console.log('[HelloLife] 插件已激活');

    // 注册 UI 扩展点 — 页面
    ctx.ui.registerExtension({
      type: 'page',
      path: '/hello',
      component: () => import('./HelloPage'),
    });

    // 注册 UI 扩展点 — 侧边栏
    ctx.ui.registerExtension({
      type: 'sidebar',
      label: '你好人生',
      icon: 'sparkles',
      path: '/hello',
      category: 'tools',
    });

    // === 事件监听 ===
    ctx.events.on('life:day-start', (payload) => {
      console.log('[HelloLife] 新的一天开始了', payload.date);
      // 写入 LifeLog 审计日志
      ctx.lifeLog.record({
        eventType: 'day_start',
        category: 'system',
        summary: \`新的一天：\${payload.date}\`,
        metadata: { greeting: '你好，人生！' },
      });
    });
  },

  // === deactivate 生命周期钩子 ===
  async deactivate() {
    console.log('[HelloLife] 插件已卸载，资源已清理');
  },

  // === 能力声明 ===
  getCapabilities() {
    return ['hello.greet', 'hello.status'];
  },

  // === Schema 声明 ===
  getSchemas() {
    return [];
  },

  // === UI 扩展点 ===
  getUIExtensions() {
    return [
      { type: 'page', path: '/hello' },
      { type: 'sidebar', label: '你好人生' },
    ];
  },
};

export default HelloLifePlugin;`;

const devFlowSteps = [
  { step: '1', title: '初始化项目', desc: '使用 create-life-plugin CLI 脚手架创建插件项目模板' },
  { step: '2', title: '编写 manifest + src', desc: '定义插件清单，编写核心业务逻辑和 Schema' },
  { step: '3', title: '本地调试', desc: '启动开发模式，连接本地 Life-OS 进行热重载调试' },
  { step: '4', title: '打包发布', desc: '使用 life-cli build 打包为 .lpk 插件包' },
  { step: '5', title: '上架插件市场', desc: '提交审核，通过后上架 Life-OS 插件市场' },
];

const sdkApis = [
  { name: 'ctx.dashboard', desc: '看板卡片扩展 API' },
  { name: 'ctx.router', desc: '动态路由注册 API' },
  { name: 'ctx.db', desc: '数据模型与 ORM API' },
  { name: 'ctx.events', desc: '事件总线发布订阅 API' },
  { name: 'ctx.ui', desc: 'UI 扩展点注册 API' },
  { name: 'ctx.lifeLog', desc: '人生日志写入 API' },
  { name: 'ctx.storage', desc: '插件专属存储 API' },
  { name: 'ctx.settings', desc: '用户设置读写 API' },
];

const DevelopmentTab = () => {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    toast.success('代码已复制');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 插件开发流程 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-indigo-400" />
            插件开发流程
          </CardTitle>
          <CardDescription className="text-zinc-400">
            从零到发布的 5 步插件开发路径
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {devFlowSteps.map((item) => (
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

      {/* 插件结构规范 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            插件结构规范
          </CardTitle>
          <CardDescription className="text-zinc-400">
            每个 DSH 插件必须导出 name 和 apply(ctx, config) 两个核心元素
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge
                variant="outline"
                className="text-xs border-emerald-500/30 text-emerald-300 bg-emerald-500/10 flex-shrink-0"
              >
                name
              </Badge>
              <p className="text-xs text-zinc-300">
                插件的唯一标识符，使用 kebab-case 命名，建议前缀为{' '}
                <code className="px-1 py-0.5 rounded bg-white/10 font-mono">
                  dsh-plugin-
                </code>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge
                variant="outline"
                className="text-xs border-indigo-500/30 text-indigo-300 bg-indigo-500/10 flex-shrink-0"
              >
                apply
              </Badge>
              <p className="text-xs text-zinc-300">
                插件的主入口函数，接收 ctx（DSH 上下文对象）和 config（插件配置），在插件装载时执行
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge
                variant="outline"
                className="text-xs border-amber-500/30 text-amber-300 bg-amber-500/10 flex-shrink-0"
              >
                version
              </Badge>
              <p className="text-xs text-zinc-300">
                插件版本号，遵循语义化版本规范 (Semantic Versioning)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge
                variant="outline"
                className="text-xs border-pink-500/30 text-pink-300 bg-pink-500/10 flex-shrink-0"
              >
                description
              </Badge>
              <p className="text-xs text-zinc-300">
                插件的功能描述，用于插件市场展示和用户识别
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HelloLifePlugin 最小可用插件 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              最小可用插件示例：HelloLifePlugin
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(helloLifePluginCode, 'hello')}
              className="h-7 border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
            >
              {copied === 'hello' ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  复制代码
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription className="text-zinc-400">
            涵盖 manifest 声明、生命周期钩子、事件监听、UI 扩展、LifeLog 写入
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto bg-black/40 rounded-b-2xl max-h-[480px] overflow-y-auto">
            <code>{helloLifePluginCode}</code>
          </pre>
        </CardContent>
      </Card>

      {/* SDK 核心 API */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-purple-400" />
            SDK 核心 API 一览
          </CardTitle>
          <CardDescription className="text-zinc-400">
            PluginContext 提供的主要能力接口
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sdkApis.map((api) => (
              <div
                key={api.name}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <code className="text-xs font-mono text-emerald-300">
                  {api.name}
                </code>
                <p className="text-xs text-zinc-500 mt-1">{api.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 完整插件示例 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              完整 DSH 插件示例
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(pluginExampleCode, 'example')}
              className="h-7 border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
            >
              {copied === 'example' ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  复制代码
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription className="text-zinc-400">
            一个完整的待办事项插件开发示例
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto bg-black/30 border-t border-white/5">
            <code>{pluginExampleCode}</code>
          </pre>
        </CardContent>
      </Card>

      {/* dsh-profile 拓扑 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-400" />
            dsh-profile 插件拓扑
          </CardTitle>
          <CardDescription className="text-zinc-400">
            插件配置的持久化存储格式，定义了所有已注册插件的状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-zinc-300 leading-relaxed">
              dsh-profile.json 是系统的插件拓扑配置文件，记录了平台名称、版本、主题以及所有已注册插件的元信息。
              每个插件条目包含 name、enabled、isCore、description、version 和 config 等字段。
            </p>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(profileExample, 'profile')}
              className="absolute top-2 right-2 h-7 border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 z-10"
            >
              {copied === 'profile' ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  复制
                </>
              )}
            </Button>
            <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto bg-black/30 rounded-lg border border-white/5">
              <code>{profileExample}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* DshContext API 速查 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-amber-400" />
            DshContext API 速查
          </CardTitle>
          <CardDescription className="text-zinc-400">
            插件上下文提供的主要能力接口
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(contextApiExample, 'context')}
              className="absolute top-2 right-2 h-7 border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 z-10"
            >
              {copied === 'context' ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  复制
                </>
              )}
            </Button>
            <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto bg-black/30 rounded-lg border border-white/5">
              <code>{contextApiExample}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 看板卡片配置字段说明 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-indigo-400" />
            看板卡片配置字段说明
          </CardTitle>
          <CardDescription className="text-zinc-400">
            ctx.dashboard.extendModule 接收的卡片配置对象字段详解
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                field: 'title',
                type: 'string',
                desc: '卡片标题，显示在看板卡片顶部',
              },
              {
                field: 'desc',
                type: 'string',
                desc: '卡片描述，标题下方的副标题',
              },
              {
                field: "status",
                type: "'ready' | 'active' | 'beta'",
                desc: '卡片状态标记，影响显示样式',
              },
              {
                field: 'actionRoute',
                type: 'string',
                desc: '点击卡片跳转的路由路径',
              },
              {
                field: 'icon',
                type: 'string',
                desc: '卡片图标名称，使用 Lucide 图标',
              },
              {
                field: 'gradientFrom',
                type: 'string',
                desc: '卡片渐变起始色（HEX 值）',
              },
              {
                field: 'gradientTo',
                type: 'string',
                desc: '卡片渐变结束色（HEX 值）',
              },
              {
                field: 'order',
                type: 'number',
                desc: '卡片排序权重，数值越大越靠后',
              },
            ].map((item) => (
              <div
                key={item.field}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-mono text-emerald-300">
                    {item.field}
                  </code>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-white/10 text-zinc-400"
                  >
                    {item.type}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 核心 API 能力清单 */}
      <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            开发工具与命令
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <code className="text-xs font-mono text-emerald-300">
                  life-cli create
                </code>
              </div>
              <p className="text-xs text-zinc-500">创建插件项目脚手架</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <code className="text-xs font-mono text-emerald-300">
                  life-cli dev
                </code>
              </div>
              <p className="text-xs text-zinc-500">启动开发模式热重载</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Square className="w-3.5 h-3.5 text-emerald-400" />
                <code className="text-xs font-mono text-emerald-300">
                  life-cli build
                </code>
              </div>
              <p className="text-xs text-zinc-500">打包为 .lpk 插件包</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <code className="text-xs font-mono text-emerald-300">
                  life-cli publish
                </code>
              </div>
              <p className="text-xs text-zinc-500">提交插件市场审核</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <ScrollText className="w-3.5 h-3.5 text-emerald-400" />
                <code className="text-xs font-mono text-emerald-300">
                  life-cli docs
                </code>
              </div>
              <p className="text-xs text-zinc-500">查看 SDK 文档</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Palette className="w-3.5 h-3.5 text-emerald-400" />
                <code className="text-xs font-mono text-emerald-300">
                  life-cli theme
                </code>
              </div>
              <p className="text-xs text-zinc-500">主题样式生成工具</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DevelopmentTab;
