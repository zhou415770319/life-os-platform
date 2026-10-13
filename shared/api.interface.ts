export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface LifeGoal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  category: string | null;
  deadline: string | null;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalDto {
  title: string;
  description?: string;
  status?: string;
  progress?: number;
  category?: string;
  deadline?: string;
  milestones?: Milestone[];
}

export interface UpdateGoalDto {
  title?: string;
  description?: string;
  status?: string;
  progress?: number;
  category?: string;
  deadline?: string;
  milestones?: Milestone[];
}

export interface LifeHabit {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  frequency: string;
  streakCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitRecord {
  id: string;
  habitId: string;
  recordDate: string;
  completed: boolean;
}

export interface CreateHabitDto {
  name: string;
  icon?: string;
  color?: string;
  frequency?: string;
}

export interface UpdateHabitDto {
  name?: string;
  icon?: string;
  color?: string;
  frequency?: string;
}

export interface EnergyRecord {
  id: string;
  recordDate: string;
  energyLevel: number;
  focusLevel: number;
  mood: string | null;
  note: string | null;
}

export interface CreateEnergyDto {
  recordDate: string;
  energyLevel: number;
  focusLevel: number;
  mood?: string;
  note?: string;
}

export interface LifeNote {
  id: string;
  title: string | null;
  content: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDto {
  title?: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface UpdateNoteDto {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface LifePrinciple {
  id: string;
  title: string;
  content: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrincipleDto {
  title: string;
  content: string;
  category?: string;
}

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  category: string | null;
  sortOrder: number;
}

export interface CreateQuickLinkDto {
  title: string;
  url: string;
  icon?: string;
  category?: string;
  sortOrder?: number;
}

export interface PluginConfig {
  id: string;
  pluginKey: string;
  name: string;
  description: string | null;
  enabled: boolean;
  version: string | null;
  config: PluginCardConfig;
  lifecycleStatus: PluginLifecycleStatus;
  riskLevel: PluginRiskLevel;
  capabilities: string[];
  /** 该插件是否支持纳入数据分析（有可聚合的数据） */
  analyzable?: boolean;
  /** 分析维度的简短描述，如「资源数量」 */
  analysisLabel?: string;
}

export type PluginLifecycleStatus =
  | 'discovered'
  | 'resolving'
  | 'loading'
  | 'active'
  | 'suspended'
  | 'unloaded';

export type PluginRiskLevel = 'low' | 'medium' | 'high';

export interface PluginCardConfig {
  cardTitle: string;
  cardDescription: string;
  cardIcon: string;
  routePath: string;
  gradientFrom: string;
  gradientTo: string;
  /** 是否参与自动复盘 / 数据洞察分析（需在插件设置中手动开启，默认关闭） */
  analysisEnabled?: boolean;
  /** 插件来源：market 为在线市场安装的第三方插件 */
  source?: 'builtin' | 'market';
}

export interface UpdatePluginDto {
  enabled?: boolean;
  config?: PluginCardConfig;
  lifecycleStatus?: PluginLifecycleStatus;
  riskLevel?: PluginRiskLevel;
  capabilities?: string[];
}

export interface AvailablePlugin {
  pluginKey: string;
  name: string;
  description: string;
  version: string;
  category: string;
  isCore: boolean;
  config: PluginCardConfig;
  installed?: boolean;
  /** 该插件是否支持纳入数据分析（有可聚合的数据） */
  analyzable?: boolean;
  /** 分析维度简短描述 */
  analysisLabel?: string;
}

export interface InstalledPlugin extends PluginConfig {
  installedAt: string;
  isCore: boolean;
}

// ===== 在线插件市场 (Market) =====
export interface MarketAiMethod {
  /** 短 ID（不含插件前缀），注册时自动补全为 <pluginKey>.<id> */
  id: string;
  name: string;
  description: string;
  /** 数据操作类型：add 添加 / list 查询 / update 修改 / delete 删除 */
  kind: 'add' | 'list' | 'update' | 'delete';
  /** 数据集合名（读写 user-data/plugins-data/<pluginKey>/<collection>.json） */
  collection: string;
  params: PluginMethodParam[];
}

export interface MarketPluginDef {
  pluginKey: string;
  name: string;
  description: string;
  version: string;
  category: string;
  cardIcon: string;
  routePath: string;
  gradientFrom: string;
  gradientTo: string;
  /** 入口 JS 文件名 */
  entry: string;
  /** 需要下载的文件列表（含 entry） */
  files: string[];
  aiMethods?: MarketAiMethod[];
}

export interface MarketPluginItem extends MarketPluginDef {
  installed: boolean;
  enabled: boolean;
  installedVersion: string | null;
}

// ===== Tasks (GTD) =====
export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface LifeTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  quadrant: TaskQuadrant | null;
  dueDate: string | null;
  tags: string[];
  project: string | null;
  context: string | null;
  subtasks: TaskSubtask[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'inbox' | 'todo' | 'in_progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskQuadrant = 'q1' | 'q2' | 'q3' | 'q4';

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  quadrant?: TaskQuadrant;
  dueDate?: string;
  tags?: string[];
  project?: string;
  context?: string;
  subtasks?: TaskSubtask[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  quadrant?: TaskQuadrant;
  dueDate?: string;
  tags?: string[];
  project?: string;
  context?: string;
  subtasks?: TaskSubtask[];
}

// ===== Finance =====
export interface FinanceAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AccountType = 'cash' | 'bank' | 'credit_card' | 'investment' | 'other';

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  subcategory: string | null;
  accountId: string | null;
  targetAccountId: string | null;
  note: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface FinanceBudget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  periodKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  categoryStats: { category: string; amount: number; percentage: number }[];
  budgetUsage: { category: string; budget: number; spent: number; percentage: number }[];
}

// ===== Health =====
export interface HealthRecord {
  id: string;
  recordType: HealthRecordType;
  recordDate: string;
  metrics: HealthMetrics;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type HealthRecordType = 'body' | 'exercise' | 'sleep';

export interface HealthMetrics {
  weight?: number;
  bodyFat?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  exerciseType?: string;
  durationMinutes?: number;
  intensity?: string;
  calories?: number;
  sleepHours?: number;
  sleepQuality?: number;
}

export interface HealthTrendPoint {
  date: string;
  value: number;
}

export interface HealthSummary {
  latestWeight: number | null;
  weightTrend: HealthTrendPoint[];
  exerciseThisWeek: number;
  totalCaloriesThisWeek: number;
  avgSleepHours: number;
  avgSleepQuality: number;
}

// ===== LifeLog =====
export interface LifeLogEntry {
  id: string;
  eventType: string;
  eventCategory: LifeLogCategory;
  contentSummary: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export type LifeLogCategory =
  | 'goals'
  | 'habits'
  | 'notes'
  | 'tasks'
  | 'finance'
  | 'health'
  | 'plugins'
  | 'system';

export interface DashboardStats {
  goals: {
    total: number;
    active: number;
  };
  habits: {
    todayCompleted: number;
    total: number;
    todayProgress: number;
  };
  notes: {
    todayCount: number;
    total: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  toolCalls?: ChatToolCall[];
}

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
  status: 'pending' | 'success' | 'error';
  result?: unknown;
  errorMessage?: string;
}

// ===== Plugin Methods (Tool Calling) =====
export interface PluginMethodParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  enum?: string[];
  items?: PluginMethodParam;
  properties?: Record<string, PluginMethodParam>;
}

export interface PluginMethod {
  id: string;
  name: string;
  description: string;
  pluginKey: string;
  params: PluginMethodParam[];
  dangerous?: boolean;
  /** 系统级方法：不绑定具体插件，注册即对所有已登录用户可用（如提交插件到市场） */
  system?: boolean;
  /** 动态注册方法（插件云函数 server.js / 市场通用数据操作）：卸载插件时按此标记批量注销，编译期内置方法不受影响 */
  dynamic?: boolean;
}

export interface ToolCallIntent {
  methodId: string | null;
  arguments: Record<string, unknown>;
  missingParams: string[];
  clarificationQuestion: string | null;
  reply: string | null;
  confidence: number;
}

export interface AiChatRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  confirmToolCall?: boolean;
  sessionId?: string;
  /** AI 深度助手模式：开启后自动注入你的实时数据（打卡/专注/浪费时间/目标/任务），可做深度分析与建议 */
  deepMode?: boolean;
  /** @插件名 显式指定目标插件：本次对话仅允许调用该插件暴露的方法（自然语言兜底时不传） */
  targetPluginKey?: string;
}

/** AI 长期记忆条目 */
export interface AiMemoryItem {
  id: string;
  content: string;
  category: 'personal' | 'goal' | 'preference' | 'other';
  createdAt: string;
  updatedAt: string;
}

export interface PreflightCheckStep {
  step: 'plugin_enabled' | 'method_exists' | 'params_check';
  status: 'pass' | 'fail' | 'info';
  title: string;
  detail?: string;
}

export interface DisabledPluginInfo {
  pluginKey: string;
  pluginName: string;
}

/** AI 回复附带的功能建议（前端据此动态渲染快捷操作按钮，不写死） */
export interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
}

export interface AiChatResponse {
  reply: string;
  toolCalls?: ChatToolCall[];
  needsMoreInfo: boolean;
  needsConfirmation?: boolean;
  missingParams?: string[];
  preflightChecks?: PreflightCheckStep[];
  /** 本次回复后建议的快捷功能动作（已启用插件的暴露方法动态生成） */
  suggestedActions?: SuggestedAction[];
  pendingMethod?: {
    id: string;
    name: string;
    pluginKey: string;
    description: string;
    params: PluginMethodParam[];
    providedArgs: Record<string, unknown>;
  };
  disabledPlugin?: DisabledPluginInfo;
  sessionId: string;
}

export interface AiChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  toolCalls?: ChatToolCall[];
  preflightChecks?: PreflightCheckStep[];
}

export interface DataExportResult {
  goals: LifeGoal[];
  habits: LifeHabit[];
  habitRecords: HabitRecord[];
  energyRecords: EnergyRecord[];
  notes: LifeNote[];
  principles: LifePrinciple[];
  quickLinks: QuickLink[];
  plugins: PluginConfig[];
  exportTime: string;
  version: string;
}

/**
 * v2 备份格式（可选导出）：按模块与插件分组。
 * version = '2.0.0' 时使用 modules / pluginData 字段；
 * 旧版（v1，平铺字段）导入时自动兼容。
 */
export interface DataBackupV2 {
  version: '2.0.0';
  exportTime: string;
  /** 核心模块数据：key 为模块名（goals / habits / notes / life-log），value 为该模块下各表数据 */
  modules: Record<string, Record<string, unknown[]>>;
  /** 已装载插件数据：key 为 pluginKey，value 为该插件各表数据 */
  pluginData: Record<string, Record<string, unknown[]>>;
}

export type BackupImportPayload = DataExportResult | DataBackupV2;

export interface ExportOptionItem {
  key: string;
  label: string;
  description: string;
  count: number;
  icon: string;
}

export interface ExportOptionsResult {
  modules: ExportOptionItem[];
  plugins: ExportOptionItem[];
  total: number;
}

export interface DataImportResult {
  success: boolean;
  imported: {
    goals: number;
    habits: number;
    habitRecords: number;
    energyRecords: number;
    notes: number;
    principles: number;
    quickLinks: number;
    plugins: number;
    modules: Record<string, number>;
    pluginData: Record<string, number>;
  };
}

export interface ChildResource {
  id: string;
  name: string;
  category: string;
  series: string | null;
  resourceType: string;
  description: string | null;
  resourceUrl: string | null;
  level: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildResourceDto {
  name: string;
  category?: string;
  series?: string;
  resourceType?: string;
  description?: string;
  resourceUrl?: string;
  level?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateChildResourceDto {
  name?: string;
  category?: string;
  series?: string;
  resourceType?: string;
  description?: string;
  resourceUrl?: string;
  level?: string;
  icon?: string;
  sortOrder?: number;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}

// ===== AI 助手 API 配置 =====
export type AiSettingsSource = 'user' | 'env' | 'none';

export interface AiSettingsView {
  /** 是否已配置用户自己的 API Key */
  configured: boolean;
  /** 脱敏后的 Key（如 sk-ab****cdef），不返回明文 */
  apiKeyMasked: string;
  /** 生效的 Base URL */
  baseUrl: string;
  /** 生效的模型名 */
  model: string;
  /** 当前生效来源：user（用户配置）/ env（环境变量）/ none（未配置） */
  source: AiSettingsSource;
}

export interface SaveAiSettingsDto {
  /** 传入空字符串或省略表示不修改已有 Key */
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface TestAiSettingsResult {
  ok: boolean;
  message: string;
}

// ===== AI 模型服务（多平台，仿 Cherry Studio） =====
/** 模型用途：chat=人生助手普通 / deep=人生助手深度 / agent=系统助手(创建插件) / plugin=插件默认 */
export type AiUsageKey = 'chat' | 'deep' | 'agent' | 'plugin';

export interface AiModelDef {
  /** 模型 ID（如 Qwen/Qwen3-8B、deepseek-chat） */
  id: string;
  /** 展示名（默认同 id，可自定义） */
  name: string;
  /** 上下文长度（可选） */
  contextLength?: number;
  /** 是否启用（启用的模型才可被选中/调用） */
  enabled: boolean;
  capabilities?: string[];
}

export interface AiProvider {
  id: string;
  /** 平台名（如 硅基流动 / DeepSeek） */
  name: string;
  /** OpenAI 兼容 Base URL（如 https://api.siliconflow.cn/v1） */
  baseUrl: string;
  apiKey: string;
  /** 平台开关 */
  enabled: boolean;
  models: AiModelDef[];
  createdAt: string;
  updatedAt: string;
}

/** 对外视图：apiKey 脱敏 */
export interface AiProviderView extends Omit<AiProvider, 'apiKey'> {
  apiKeyMasked: string;
  configured: boolean;
}

/** 默认模型分配（value 格式 providerId:modelId） */
export interface AiModelAssignments {
  chat?: string;
  deep?: string;
  agent?: string;
  plugin?: string;
}

export interface SaveAiProviderDto {
  id?: string;
  name: string;
  baseUrl: string;
  /** 空字符串/省略表示保留原 Key */
  apiKey?: string;
  enabled?: boolean;
}

export interface AiProvidersView {
  providers: AiProviderView[];
  assignments: AiModelAssignments;
  /** 旧版单配置（兼容回退） */
  legacy: {
    configured: boolean;
    baseUrl: string;
    model: string;
    source: AiSettingsSource;
  };
  /** 所有可用模型选项（供下拉选择：value=providerId:modelId） */
  modelOptions: { value: string; label: string; providerName: string; modelId: string }[];
}

export interface TestAiProviderResult {
  ok: boolean;
  message: string;
}

// ===== RPA 管理插件 =====
export type ExcelCellValue = string | number | boolean | null;

export interface ExcelSheetData {
  name: string;
  /** 首行作为表头 */
  headers: ExcelCellValue[];
  /** 全部行（含表头行） */
  rows: ExcelCellValue[][];
}

export interface RpaFileInfo {
  fileName: string;
  /** 文件绝对路径（本地库记录的主标识） */
  path: string;
  /** 文件所在文件夹（绝对路径） */
  directory: string;
  size: number;
  sheets: string[];
  updatedAt: string;
}

export interface SaveExcelDto {
  /** 已登记进本地文件库的文件绝对路径，保存直接写回原位置 */
  path: string;
  sheets: { name: string; rows: ExcelCellValue[][] }[];
}

export interface ImportByPathResult {
  imported: number;
  items: RpaFileInfo[];
  /** 仅当导入单个文件时返回，可直接进入编辑 */
  single?: { fileName: string; sheets: { name: string; rows: ExcelCellValue[][] }[] };
}

export interface ReadExcelResult {
  fileName: string;
  sheets: ExcelSheetData[];
}

// ===== 儿童定时播放・家长远程控制 (child-tv) =====
export type ChildTvSourceType = 'folder' | 'file' | 'url';
export type ChildTvMediaType = 'video' | 'audio';

export interface ChildTvSchedule {
  id: string;
  /** 时段名称 */
  name: string;
  /** 开始时间 HH:MM */
  start: string;
  /** 时长（分钟，1-1440），支持跨天 */
  durationMinutes: number;
  sourceType: ChildTvSourceType;
  /** 文件夹路径 / 单文件路径 / http(s) URL */
  source: string;
  mediaType: ChildTvMediaType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChildTvScheduleInput {
  name: string;
  start: string;
  durationMinutes: number;
  sourceType: ChildTvSourceType;
  source: string;
  mediaType: ChildTvMediaType;
  enabled?: boolean;
}

export interface ChildTvNextSchedule {
  name: string;
  startLabel: string;
  /** 距开始还有多少分钟（可能为负=正在播放中） */
  startsInMinutes: number;
}

export interface ChildTvRuntimeStatus {
  playing: boolean;
  currentTitle: string;
  currentScheduleId: string | null;
  startedAt: string | null;
  endsAt: string | null;
  remainingMinutes: number | null;
  /** 手动播放（家长远程立即播放） */
  manual: boolean;
  nextSchedule: ChildTvNextSchedule | null;
  locked: boolean;
  lockReason: 'playback' | 'manual' | 'remote' | null;
  lockEndsAt: string | null;
  /** mpv 进程状态 */
  mpv: 'running' | 'stopped' | 'missing';
  /** 是否检测到 mpv 可执行文件 */
  mpvAvailable: boolean;
  /** 服务是否有管理员权限（锁定功能依赖） */
  admin: boolean;
  /** 观看页 PIN 是否已启用 */
  pinEnabled: boolean;
  lastLog: string;
}

export interface ChildTvBrowseEntry {
  name: string;
  path: string;
  kind: 'video' | 'audio';
}

export interface ChildTvBrowseResult {
  /** 当前浏览的目录；为空表示根（盘符列表） */
  path: string | null;
  parent: string | null;
  drives: string[];
  dirs: string[];
  files: ChildTvBrowseEntry[];
}

export interface ChildTvLogEntry {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface ChildTvStatsEntry {
  id: string;
  scheduleId: string | null;
  name: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  manual: boolean;
}

export interface ChildTvAuthInfo {
  loggedIn: boolean;
  username: string;
  role: 'parent' | 'child' | null;
  displayName: string;
  pinEnabled: boolean;
}

/** 儿童端账号（多账号体系：parent + child，child 由家长创建并绑定） */
export interface ChildTvAccountInfo {
  username: string;
  role: 'parent' | 'child';
  displayName: string;
  /** child 账号归属的家长用户名 */
  boundTo: string | null;
  /** 家长端生成的绑定码（儿童端受控模式凭此连接） */
  bindCode: string | null;
  /** 账号级锁定状态 */
  locked: boolean;
  lockReason: 'playback' | 'manual' | 'remote' | null;
  lockEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 家长端下发/儿童端拉取的同步状态（双机受控模式） */
export interface ChildTvSyncState {
  /** 状态版本号：儿童端据此判断是否有变化 */
  version: number;
  /** 本账号是否被家长锁定 */
  locked: boolean;
  lockReason: 'playback' | 'manual' | 'remote' | null;
  lockEndsAt: string | null;
  /** 家长端当前应播放的时段（null = 停止） */
  playingScheduleId: string | null;
  playingTitle: string;
  playingEndsAt: string | null;
  /** 完整时段表（儿童端本机解析资源用） */
  schedules: ChildTvSchedule[];
  /** 家长端当前时间 ISO（两端对时） */
  serverTime: string;
}

/** 家长端 SSE 广播事件载荷（init 为连接建立/重连时推送的全量同步状态） */
export interface ChildTvSyncEvent {
  type: 'init' | 'lock' | 'unlock' | 'play' | 'stop' | 'schedule-change' | 'ping';
  account: string;
  scheduleId?: string | null;
  title?: string;
  endsAt?: string | null;
  reason?: 'playback' | 'manual' | 'remote' | null;
  minutes?: number;
}

export interface ChildTvSettings {
  /** 观看页 PIN（sha256 加盐哈希），null 表示未启用 */
  pinHash: string | null;
  /** 默认锁定时长（分钟），默认 240 */
  defaultLockMinutes: number;
  /** 手动立即播放的默认时长（分钟），默认 120 */
  immediatePlayDurationMinutes: number;
  /** 自定义 mpv 可执行文件路径（留空自动检测） */
  mpvPath: string;
  /** 受控模式（儿童端）：连接家长端、接收锁定/播放指令 */
  controlled: {
    enabled: boolean;
    /** 家长端地址，如 http://192.168.1.10:3003 */
    parentUrl: string;
    /** 本机儿童账号（家长端创建的账号名） */
    childUsername: string;
    /** 家长端生成的绑定码 */
    bindCode: string;
  };
}

