# Life-OS 人生管理系统平台

## 应用概览

奉行「一切皆插件 (Everything is a plugin)」理念的终身成长与个人全栈管理平台。系统主壳提供高度抽象的人生管理看板（时间管理、目标追踪、认知看板），通过右下角 a2ui 悬浮 AI 聊天窗实现插件热插拔与功能动态扩展。

## 视觉设计规范

### 主题风格
- **玻璃拟态暗黑风格 (Dark Glassmorphism)**
- 主背景色: `#09090b` (zinc-950)
- 半透明毛玻璃卡片背景: `rgba(255, 255, 255, 0.03)` ~ `rgba(255, 255, 255, 0.06)`
- 边框: `1px solid rgba(255, 255, 255, 0.08)`
- 模糊: `backdrop-blur-xl`

### 色彩系统
- 主色: 蓝紫渐变 `from-indigo-500 to-purple-500`
- 辅助色: 青色 `#22d3ee`
- 成功色: 翠绿色 `#10b981`
- 警告色: 琥珀色 `#f59e0b`
- 文字主色: `#fafafa` (zinc-50)
- 文字次色: `#a1a1aa` (zinc-400)
- 文字弱色: `#71717a` (zinc-500)

### 背景光晕装饰
- 蓝紫色径向渐变光晕: `radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.15), transparent 50%)`
- 粉紫色径向渐变光晕: `radial-gradient(circle at 70% 80%, rgba(168, 85, 247, 0.12), transparent 50%)`

### 排版
- 标题: text-2xl / font-semibold / tracking-tight
- 副标题: text-sm / text-zinc-400
- 正文: text-sm / text-zinc-300
- 小字: text-xs / text-zinc-500

### 间距
- 页面内边距: `p-6 md:p-10`
- 卡片内边距: `p-6`
- 卡片间距: `gap-6`
- 行间距: `space-y-4`

### 动画
- hover 过渡: `transition-all duration-300 ease-out`
- 呼吸灯: `animate-pulse` 自定义呼吸动画
- 卡片悬浮: `hover:scale-[1.02] hover:shadow-2xl`

## 技术架构

### 前端
- React 19 + TypeScript
- Tailwind CSS (玻璃拟态暗黑主题)
- shadcn/ui 组件库
- Lucide React 图标
- 路由: React Router DOM v6
- 数据请求: axiosForBackend

### 后端
- NestJS 10 + TypeScript
- **数据本地存储**：所有业务数据存 `user-data/*.json`（JSON 文件，本地优先，后期再切线上数据库）
- 数据库已预留：Drizzle ORM + PostgreSQL（`DATABASE_URL` 占位，当前未启用）
- 模块划分: dashboard / goals / habits / notes / plugins / ai-chat / data-manager / rpa-manager / review-board / pomodoro / time-blackhole / life-log / insights 等

### 数据存储规则（硬约束，2026-09 起生效）
- **所有数据存本地 `user-data/*.json`，后期再切换线上数据库**
- 各模块 JSON 文件：`life-goals.json` / `life-habits.json` / `life-notes.json` / `life-plugin-config.json` / `life-ai-chat-history.json` 等
- 插件方法暴露给 AI：`server/modules/plugins/plugin-method.registry.ts`
- 现状权威速查：见 `CONTEXT.md`（与本文冲突处以 CONTEXT.md 为准）

## 核心模块与路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard 首页 | 三大看板卡片 + 插件卡片网格 |
| `/goals` | 目标管理页 | 愿景与长期 OKR 管理 |
| `/habits` | 时间习惯页 | 能量与时间管理、习惯打卡 |
| `/notes` | 认知笔记页 | 闪念笔记、原则库、快速链接 |
| `/child-resources` | 儿童资料站 | 儿童启蒙资源导航（插件） |
| `/rpa-center` | RPA 创作中心 | 智能创作中心控制台（插件） |
| `/data-manager` | 数据管理页 | 数据导出备份与上传 |

## 插件系统设计

- 插件配置存储于 `user-data/life-plugin-config.json`（enable 字段控制启停）
- 初始插件: `dsh-plugin-life-dashboard` (enabled: true)
- 预置插件: pomodoro / time-blackhole / rpa-manager（启用），child-resources / wechat-rpa / tasks-gtd / finance-ledger / health-fit / reading-lab / review-board（按需启用）
- 插件装载后: Dashboard 网格追加新卡片 + 导航栏新增入口 + 路由注册
- AI 可调用插件暴露方法（先查启用 → 方法存在 → 参数齐全）

## a2ui 悬浮 AI 聊天窗（人生系统助手）

- 右下角固定悬浮，圆形按钮 + 展开聊天面板
- 支持自配 API Key（未配置赠 3 次试用，订阅后不限）
- 历史会话保存并可回显（life-ai-chat-sessions.json）
- 支持插件热插拔指令与插件方法调用（「安装儿童资料站插件」「在儿童资料站添加资料」等）
- 流式输出展示
