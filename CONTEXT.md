# CONTEXT.md — Life-OS 项目上下文速查（压缩版）

> 本文件是项目现状的**唯一权威速查**，AGENTS.md / README.md 中与本文冲突的内容以本文为准。
> 最后更新：2026-10-08

## 1. 项目定位

「一切皆插件」的个人全栈管理系统（人生看板 + 插件生态 + AI 助手）。Windows 本地 fullstack 工程，浏览器访问本机服务使用。

## 2. 技术栈

- 后端：NestJS 10 + TypeScript（`server/`），**本地 JSON 文件存储**（`user-data/*.json`），后期可切换线上数据库
- 前端：React 19 + TS + Tailwind + shadcn/ui + Lucide + React Router v6（`client/`）
- 共享类型：`shared/api.interface.ts`
- 前端请求：`axiosForBackend`（封装后取 `response.data`）

## 3. 启动与端口（重要）

| 项 | 值 |
|---|---|
| 后端端口 | **3003**（.env `SERVER_PORT`） |
| 前端端口 | **5180**（.env `CLIENT_PORT`，vite strictPort） |
| 前端入口 | `http://localhost:5180/client/index.html`（vite root=client；根路径 `/` 会 404） |
| 后端直连 | `http://localhost:3003/api/...` |
| 后端启动 | `node node_modules\@nestjs\cli\bin\nest.js start --watch`（或 `npm run dev:local` → scripts/dev-win.cjs） |
| 前端启动 | `node node_modules\vite\bin\vite.js --config vite.config.ts` |
| 类型检查 | server：`npx tsc --noEmit --project tsconfig.node.json`；client：`tsconfig.app.json`（根 tsconfig 是 composite 构建配置，勿直接 --noEmit） |

**重启前必须杀旧实例**（否则 EADDRINUSE / 改代码不生效）：
`netstat -ano | Select-String ":3003|:5180"` → 记 PID → `Stop-Process -Id <PID> -Force`

## 4. 数据存储规则（硬约束）

- **所有数据存本地** `user-data/*.json`，**后期再切线上数据库**（Postgres/Drizzle 已预留，当前未使用）
- 数据文件见 §6；写入规则已同步在 AGENTS.md
- 用户真实数据勿清：`review-board-panels.json`（含 9.18/9.19 作业）、`life-*.json` 各业务数据

## 5. 核心模块与路由

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | Dashboard 首页 | 看板 + 插件卡片网格 |
| `/goals` | 目标管理 | 愿景与 OKR（编辑已回显） |
| `/habits` | 微习惯 | 今日打卡 + 微习惯管理（频率：每日/每周选周几/每月选几号） |
| `/notes` | 认知笔记 | 闪念笔记、原则库、快速链接 |
| `/data-manager` | 数据管理 | 导出备份（按模块/插件勾选）、导入 |
| `/settings` | 系统设置 | 人生日志、数据管理、插件中心/市场、AI 配置等收敛于此 |
| 插件路由 | 见插件体系 | dynamic-plugin-routes.tsx 注册 |

server 模块（`server/modules/`）：dashboard / goals / habits / notes / plugins / ai-settings / child-resources / data-manager / finance / health / insights / life-log / pomodoro / review / review-board / rpa-manager / tasks / time-blackhole / view / hello

## 6. 数据文件（user-data/）

业务：life-goals / life-habits / life-habit-records / life-notes / life-principles / life-tasks / life-life-logs / pomodoro-records / time-blackhole-records / review-records / review-settings
插件：life-plugin-config.json（插件配置与启停）
AI：ai-settings.json（Key/模型配置）、ai-memory.json、life-ai-chat-history.json、life-ai-chat-sessions.json（历史会话回显）
复盘：review-board-panels / shares / publishes.json、user-data/publish/*.html（发布包）
RPA：rpa-library-index.json（登记记录，保存写回原路径）

## 7. 插件体系

- 插件配置：`user-data/life-plugin-config.json`（enable 字段控制启停）；预置种子在 `plugins.service.ts` SEED_PLUGINS
- **已预置启用**：life-dashboard（核心）、pomodoro（番茄钟）、time-blackhole（时间黑洞）、rpa-manager（RPA）
- 可装载（默认关闭）：child-resources（儿童资料站）、wechat-rpa、tasks-gtd、finance-ledger、health-fit、reading-lab、review-board（复盘面板，按需启用）
- **AI 方法暴露**：插件方法注册在 `server/modules/plugins/plugin-method.registry.ts`（总量约 60+），AI 助手按「已启用 → 方法存在 → 参数齐全」三步预检后调用，支持 AI 创建/修改插件
- 插件页映射：`client/src/utils/dynamic-plugin-routes.tsx`（pluginPageMap）+ `plugin-icons.ts`

## 8. 最近关键改动（2026-09 ~ 10）

1. **RPA 管理插件重构（最新）**：本地文件库改为「路径登记制」（rpa-library-index.json）；「选择文件/文件夹」由后端弹系统对话框（OpenFileDialog/FolderBrowserDialog）直接拿真实路径；保存**原地写回原文件**（不复制副本）；删除=移除记录（不删原文件）；AI 方法 editCell/addRow 改 path 参数；未登记路径保存 404 拒绝
2. **复盘面板插件**：三级面板（日→周→月）Markdown 编辑、勾选完成记录时间、自动归档（30min 定时+打开兜底）、ShareOne 发布包（只读/可编辑双链接、批量删除记录）；发布包数据空两个根因已修（view catch-all 拦截 + 模板字符串 `\[` 非法转义致脚本语法错误，现为 `\\[`）
3. 番茄钟/时间黑洞已改插件；AI 聊天支持自配 API Key、赠 3 次、历史会话回显、背景色加深
4. 导出备份按模块/插件勾选；数据洞察需插件开「参与数据分析」才纳入

## 9. 已知坑与注意

- **EADDRINUSE**：3003/5180 被占 → 杀旧进程再启动
- **页面"没变化/菜单没更新/显示两遍"**：多为旧 vite/nest 实例未按 .env 重启，或访问错入口（5180 不是 5173）
- **5173 不是本项目端口**（.env=5180）；vite `/` 404 须 `/client/index.html`
- 浏览器 `<input type=file>` 拿不到文件绝对路径（安全限制）→ RPA 已改后端系统对话框
- PowerShell 执行；脚本统一 UTF-8；cu.type 输入 `\n` 会粘连单行
- 发布包模板字符串内正则必须用 `\\[` 写法（`\[` 会被 JS 丢弃反斜杠）

## 10. 开发约定

- 数据本地 JSON 优先（§4）；改动前先读现状代码，别凭记忆
- 复杂功能先可行性分析，用户确认后再开发
- 页面风格：玻璃拟态暗黑（zinc-950 背景、白 3~6% 半透明卡片、indigo→purple 主色）——见 AGENTS.md 视觉规范
- 交付前：前后端 tsc 通过 + 真实 API 验证（Invoke-RestMethod 或 Node 脚本）
