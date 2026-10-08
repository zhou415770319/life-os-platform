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

export interface AiChatResponse {
  reply: string;
  toolCalls?: ChatToolCall[];
  needsMoreInfo: boolean;
  needsConfirmation?: boolean;
  missingParams?: string[];
  preflightChecks?: PreflightCheckStep[];
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
  lockReason: 'playback' | 'manual' | null;
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
  pinEnabled: boolean;
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
}

