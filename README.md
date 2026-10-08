# Life-OS 人生管理系统平台

> 奉行「一切皆插件 (Everything is a plugin)」理念的终身成长与个人全栈管理平台。

## 项目简介

Life-OS 是一个高度模块化的人生管理系统，基于 DSH (Dynamic Service Host) 插件规范构建。系统主壳提供人生管理看板，通过 AI 对话实现业务插件的热插拔，覆盖**目标管理、微习惯、认知笔记、番茄专注、时间黑洞、复盘面板、GTD 任务、数据洞察、自动复盘**等个人成长核心场景，并支持儿童资料站、RPA 管理等业务插件扩展。

### 核心亮点

- **🤖 人生系统助手（AI 深度助手）**：全局唯一的 AI 交互入口（右下角悬浮聊天窗），支持：
  - **深度模式**：自动参考你的实时数据（习惯打卡、番茄专注、浪费时间、目标进度、任务）做个性化分析与建议
  - **长期记忆**：记住你的偏好与目标，跨会话生效
  - **插件驱动**：用自然语言调用插件方法（增删改查业务数据），自动预检"插件是否启用 → 方法是否存在 → 参数是否齐全"
  - **历史会话**：多会话管理，点击即可回显并继续之前的对话
- **📊 数据可视化中心**：91 天习惯热力图、30 天专注/浪费时间趋势、目标进度环、浪费时间构成
- **📝 自动复盘**：每日/每周定时自动生成复盘，AI 个性化总结（失败自动降级模板）
- **🔌 插件热插拔**：儿童资料站、番茄钟、时间黑洞、复盘面板、RPA 管理等插件无缝缝合到主界面
- **📋 复盘面板**：Markdown 式每日/每周/每月三级复盘，粘贴自动转 Markdown，任务勾选即记完成时间，每日归档到周、周日归档到月，支持生成只读/可编辑分享链接与 ShareOne 公网发布包
- **💾 本地优先存储**：所有数据存本地 `user-data/*.json`，支持按模块/插件勾选导出备份与导入还原，后期可切换线上数据库
- **玻璃拟态暗黑风格**：半透明毛玻璃卡片 + 蓝紫渐变光晕

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS + shadcn/ui（玻璃拟态暗黑主题） |
| 图表 | Recharts / ECharts |
| 后端框架 | NestJS 10 + TypeScript |
| 数据库 ORM | Drizzle ORM（本地适配层，默认 JSON 存储） |
| 数据存储 | 本地 JSON 文件（`user-data/*.json`），后期可切 PostgreSQL |
| AI 能力 | 自配 API Key（OpenAI 兼容接口，如 SiliconFlow / DeepSeek） |

## 项目结构

```
life-os-platform/
├── client/                      # 前端（Vite + React）
│   └── src/
│       ├── api/                 # 后端 API 封装
│       ├── components/
│       │   ├── AiChat/          # AI 助手（深度模式/记忆/会话侧栏）
│       │   ├── ui/              # shadcn/ui 基础组件
│       │   └── Layout.tsx       # 全局布局（侧边栏 + 动态插件导航）
│       ├── pages/
│       │   ├── Dashboard/       # 人生看板（首页）
│       │   ├── GoalsPage/       # 愿景与目标
│       │   ├── HabitsPage/      # 微习惯（今日打卡/微习惯管理）
│       │   ├── NotesPage/       # 认知笔记（闪念/原则库/快速链接）
│       │   ├── TasksPage/       # GTD 任务管理
│       │   ├── PomodoroPage/    # 番茄钟记录
│       │   ├── TimeBlackholePage/ # 时间黑洞
│       │   ├── InsightsPage/    # 数据洞察（可视化中心）
│       │   ├── ReviewPage/      # 自动复盘
│       │   ├── ChildResourcesPage/ # 儿童资料站（插件）
│       │   ├── RpaManagerPage/  # RPA 管理（插件）
│       │   ├── ReviewBoardPage/ # 复盘面板（插件）
│       │   ├── SettingsPage/    # 系统设置（插件管理/数据管理/AI 配置）
│       │   ├── PluginCenterPage/# 插件中心
│       │   └── DataManagerPage/ # 数据备份与导入
│       ├── app.tsx              # 路由配置
│       └── index.tsx            # 应用入口
│
├── server/                      # 后端（NestJS）
│   ├── main.ts                  # 应用入口（读取 .env 端口）
│   ├── app.module.ts            # 根模块
│   ├── storage/                 # 本地 JSON 存储适配层（JsonStore / LocalDatabase）
│   └── modules/
│       ├── goals/               # 目标管理
│       ├── habits/              # 微习惯
│       ├── notes/               # 认知笔记
│       ├── tasks/               # GTD 任务
│       ├── pomodoro/            # 番茄钟
│       ├── time-blackhole/      # 时间黑洞
│       ├── insights/            # 数据洞察
│       ├── review/              # 自动复盘
│       ├── child-resources/     # 儿童资料站（插件）
│       ├── rpa-manager/         # RPA 管理（插件）
│       ├── review-board/        # 复盘面板（插件：三级面板/归档/分享/发布）
│       ├── plugins/             # 插件管理 + AI 助手（ai-chat）
│       ├── life-log/            # 人生日志
│       └── data-manager/        # 数据备份导入导出
│
├── shared/api.interface.ts      # 前后端共享类型
├── scripts/
│   ├── dev-win.cjs              # Windows 一键启动脚本
│   └── seed-local-data.js       # 初始化常用数据（原则库/微习惯示例）
├── user-data/                   # 本地数据存储（*.json，可整体备份）
├── .env                         # 端口等配置
├── vite.config.ts               # Vite 配置（端口/反代跟随 .env）
└── AGENTS.md                    # 开发规则文件
```

## 如何启动项目

### 前置要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 22.0.0 | 建议使用 LTS 版本 |
| npm | >= 10.0.0 | |

> 本地默认采用 **JSON 文件存储**（`user-data/*.json`），**无需安装 PostgreSQL**。

### 第 1 步：安装依赖

```bash
cd D:\zf-code\gitHub\life-os-platform\life-os-platform
npm install
```

> ⚠️ **注意事项**：本项目 `prepare` 脚本已改为跨平台 Node 写法（原为 Linux 语法 `chmod ... 2>/dev/null || true`，在 Windows cmd 下会报错）。若仍遇到 `prepare` 相关报错，请确认 `package.json` 中的 `prepare` 脚本为：
> `node -e "try{require('fs').chmodSync('.githooks/pre-commit',0o755)}catch(e){};try{require('child_process').execSync('git config core.hooksPath .githooks')}catch(e){}"`

### 第 2 步：配置端口（可选）

端口统一在项目根目录 **`.env`** 文件中配置，本项目当前默认如下：

```ini
SERVER_PORT=3003    # 后端 API 端口
CLIENT_PORT=5180    # 前端页面端口
```

修改后重启服务即生效，前端 `/api` 请求会自动反代到新的后端端口，无需其他改动。

### 第 3 步：启动开发服务器

```bash
# Windows 本地一键启动（前端 + 后端并发，推荐）
npm run dev:local

# 或分别启动
npm run dev:server    # 后端 (NestJS)，端口取 .env 的 SERVER_PORT
npm run dev:client    # 前端 (Vite)，端口取 .env 的 CLIENT_PORT
```

启动日志会显示实际地址：
- 前端页面：`http://localhost:<CLIENT_PORT>/client/index.html`
- 后端 API：`http://localhost:<SERVER_PORT>/api`

> ⚠️ **注意事项**：
> 1. **不要重复启动** `dev:local`——第一次启动的进程会一直占用端口，再次启动会报 `EADDRINUSE`（端口被占用）。需要重启时，先到原终端按 `Ctrl+C` 停掉旧进程。
> 2. 端口被占用排查：`netstat -ano | findstr ":<端口>"`，找到 LISTENING 的 PID 后用 `Get-Process -Id <PID>` 查看是什么进程。

### 第 4 步：初始化常用数据（可选）

首次使用可执行一次数据初始化脚本，写入常用原则库（15 条）与微习惯示例（5 条）：

```bash
node scripts/seed-local-data.js
```

### 第 5 步：配置 AI 对话（可选）

AI 助手支持两种配置方式：

1. **应用内配置**（推荐）：打开系统设置 → AI 配置，填写：
   - API Key（如 SiliconFlow / DeepSeek 等 OpenAI 兼容接口的 Key）
   - Base URL（如 `https://api.siliconflow.cn/v1`）
   - 模型名（如 `Qwen/Qwen3-8B`）
2. **环境变量**：在 `.env` 中配置 `LOCAL_AI_API_KEY` / `LOCAL_AI_BASE_URL` / `LOCAL_AI_MODEL`

> ⚠️ 未配置 API Key 时，AI 对话不可用，其余所有功能均可正常使用。配置完成后可在设置页点击「测试连接」验证。

## 功能模块总览

### 1. 人生管理看板（首页 `/`）
- 目标追踪、习惯打卡、认知笔记三大核心模块卡片
- 已启用插件实时追加为卡片，点击进入对应页面

### 2. 愿景与目标（`/goals`）
- 新建/编辑/删除目标，分类、截止日期
- 里程碑管理：勾选完成自动更新进度条
- 编辑时完整回显已有数据

### 3. 微习惯（`/habits`）
- **今日打卡**：一键打卡，顶部圆形进度环显示今日完成率
- **微习惯管理**：新增/编辑/删除习惯，配置图标、颜色、打卡频率
  - 频率支持：**每日** / **每周**（可选周几）/ **每月**（可选每月几号）

### 4. 认知笔记（`/notes`）
- **闪念笔记**：新增/编辑/删除，支持置顶、标签筛选
- **原则库**：核心人生原则，按分类整理（内置 15 条常用原则）
- **快速链接**：收藏常用网址

### 5. GTD 任务管理（`/tasks`）
- 收集箱、四象限矩阵、项目分解、子任务、上下文标签
- **番茄联动**：任务卡片显示专注统计（🍅 次数/分钟），一键跳转番茄钟开始专注
- **完成记账**：任务完成自动写入人生日志

### 6. 番茄钟记录（`/pomodoro`）
- 15/25/45/60 分钟专注计时，结束自动保存
- 今日/累计专注统计、历史记录管理
- 支持从任务页跳入自动关联任务

### 7. 时间黑洞（`/time-blackhole`）
- 诚实记录浪费时间：发呆 / 刷短视频 / 八卦闲聊 / 其他
- 今日浪费统计、分类占比

### 8. 数据洞察（`/insights`）
- KPI 总览卡（今日打卡/专注/浪费/目标进度）
- 91 天习惯热力图（GitHub 风格）
- 30 天番茄专注与时间黑洞双柱状图
- 浪费时间构成饼图
- **插件数据**：仅展示已在插件设置中开启「参与数据分析」的插件数据

### 9. 自动复盘（`/review`）
- 每日/每周复盘记录，支持手动生成与历史查看
- 定时自动生成（每 30 秒调度检查）
- AI 个性化总结（未配置 Key 或调用失败时自动降级为模板总结）
- **插件数据**：开启「参与数据分析」的插件数据会纳入复盘分析

### 10. AI 助手（右下角悬浮球）
- **深度模式**（默认开启）：AI 自动参考你的实时数据做深度分析，如"分析一下我今天的效率"、"我这周状态怎么样"
- **长期记忆**：点聊天窗顶部「记忆」，添加/删除 AI 跨会话记住的信息（偏好、目标、背景）
- **我的数据**：查看 AI 正在参考的数据快照，一键「让 AI 分析」
- **插件调用**：自然语言驱动插件（如"在儿童资料站添加一个 RAZ AA 级资料"），自动三步预检 + 缺参追问
- **历史会话**：左上角菜单查看会话列表，点击回显并继续

### 11. 复盘面板（`/review-board`，插件）
- **每日/每周/每月三级面板**：Tab 切换，每日面板可切换日期、周/月面板展示归档明细与待归档内容
- **Markdown 式编辑**：编辑/预览双栏，从外部复制富文本或 Markdown 粘贴自动转 Markdown（800ms 防抖自动保存）
- **任务清单**：`- [ ]` / `- [x]` 语法识别任务，点击勾选记录完成时间，同步回写内容
- **自动归档**：每日面板按日期归档到所属周、周日自动把周数据归档到所属月；也可点击「立即归档」手动触发
- **分享**：生成**只读 / 可编辑**两种分享链接，可编辑链接支持外网用户勾选任务写回本机
- **发布**：一键生成自包含 HTML 发布包（view 只读 / edit 可勾选交互），把 `user-data/publish/` 下的 HTML 交给 AI 或手动上传 ShareOne 即可获得公网链接

### 12. 系统设置（`/settings`）
- **插件管理**：插件市场（安装/启用/卸载）、已安装插件管理
- **插件详情**：暴露的方法列表（AI 可直接调用）、聊天使用示例、**参与数据分析开关**
- **AI 配置**：API Key / Base URL / 模型配置 + 测试连接
- **数据管理**：备份导出（按模块/插件勾选）、备份导入（区分模块与插件）

### 13. 插件中心（`/plugin-center`）
- 插件机制介绍、开发指南、内置插件介绍

## 插件系统

### 内置插件清单

| 插件 | 键名 | 说明 | 可分析 |
|------|------|------|--------|
| 人生管理看板 | `dsh-plugin-life-dashboard` | 核心插件，目标/习惯/认知三大模块 | - |
| 儿童资料站 | `dsh-plugin-child-resources` | 儿童启蒙资料库（RAZ/廖彩杏/牛津树） | ✅ 资料数量 |
| 番茄钟记录 | `dsh-plugin-pomodoro` | 专注计时与统计 | ✅ 专注时长/次数 |
| 时间黑洞 | `dsh-plugin-time-blackhole` | 浪费时间记录 | ✅ 浪费时间分钟数 |
| RPA 管理 | `dsh-plugin-rpa-manager` | 本地文件/Excel 读写编辑 | ✅ 管理文件数 |
| 复盘面板 | `dsh-plugin-review-board` | Markdown 每日/每周/每月复盘，归档/分享/ShareOne 发布 | - |
| 任务管理 GTD | `dsh-plugin-tasks-gtd` | GTD 任务管理 | - |

### 参与数据分析（重要规则）

**数据洞察与自动复盘只分析已开启「参与数据分析」的插件数据。**

- 核心模块数据（习惯打卡、目标进度、笔记、人生日志）始终纳入分析
- 插件数据（番茄钟、时间黑洞、儿童资料站、RPA 管理）**默认不分析**，需开启后纳入
- 开启方式：系统设置 → 插件管理 → 点击插件查看详情 → 打开「参与数据分析」开关
- 开启后：该插件数据（如番茄钟的专注时长、儿童资料站的资料数量）会出现在数据洞察页，并纳入自动复盘的 AI 分析与总结
- 仅**可分析**插件（上表标 ✅）会显示该开关

### 插件方法暴露给 AI

每个插件可暴露方法（如 `child-resources.addResource`），AI 助手通过三步预检后调用：
1. **插件是否启用** → 未启用则提示用户先去启用
2. **方法是否存在** → 不存在则提示不可用
3. **参数是否齐全** → 缺参数先向用户确认再执行

## 数据存储与备份

- 所有业务数据保存在项目根目录 **`user-data/`** 下的 JSON 文件（每个模块一个文件）
- 备份：系统设置 → 数据管理 → 备份导出，可**按模块/插件勾选**导出（勾选则导出该模块数据，不勾选不导出；已装载插件支持勾选，未装载不展示选项）
- 导入：支持**区分模块和插件**的备份还原
- 后期切换到线上数据库：在 `.env` 配置 `DATABASE_URL`，把存储注入源从 JSON 切回 Drizzle + PostgreSQL，业务代码无需改动

## 常见问题（FAQ）

| 问题 | 解决 |
|------|------|
| `npm install` 报 `prepare` / `fullstack-cli` 错误 | 确认 `package.json` 的 `prepare` 为跨平台 Node 写法（见上文） |
| 启动报 `EADDRINUSE: address already in use` | 端口被之前启动的实例占用。到旧终端 Ctrl+C 停掉，或 `netstat -ano \| findstr ":<端口>"` 找到 PID 结束 |
| 页面没变化 / 菜单没更新 | 确认前端刷新（HMR 正常时保存即热更新）；改端口/环境变量后需重启 `dev:local` |
| AI 提示"服务暂时不可用" | 检查 AI 配置（API Key / Base URL / 模型），在设置页点「测试连接」 |
| 历史会话看不到 | 聊天窗左上角菜单打开会话列表，点击会话回显；会话数据保存在 `user-data/life-ai-chat-*` |
| 插件数据没出现在数据洞察 | 需要先在插件详情中开启「参与数据分析」开关 |

## 插件扩展开发

### 新增一个插件步骤

1. 在 `server/modules/plugins/plugins.service.ts` 的 `SEED_PLUGINS` 中注册插件定义（键名、名称、描述、配置）
2. 在 `server/modules/` 下创建插件业务模块（Controller + Service + Module）
3. 在 `client/src/pages/` 下创建插件页面组件，在 `client/src/app.tsx` 注册路由
4. （可选）在 `plugin-method.registry.ts` 暴露方法给 AI 调用
5. （可选）实现数据聚合后，在 `SEED_PLUGINS` 中标记 `analyzable: true` 并实现 InsightsService 的聚合分支，即可支持「参与数据分析」

详细开发指南见**插件中心**页面与 `docs/插件配置说明.md`。
