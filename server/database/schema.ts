/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const lifeAiChatSessions = pgTable("life_ai_chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull().default('新对话'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_ai_chat_sessions_created").on(table.createdAt),
]);

export const lifeLifeLogs = pgTable("life_life_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventCategory: varchar("event_category", { length: 30 }).notNull().default('system'),
  contentSummary: text("content_summary").notNull(),
  /**
   * @type { [key: string]: string | number | boolean | null }
   */
  metadata: jsonb("metadata").default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_life_logs_type").on(table.eventType),
  index("idx_life_life_logs_category").on(table.eventCategory),
  index("idx_life_life_logs_created").on(table.createdAt),
]);

export const lifeHealthRecords = pgTable("life_health_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordType: varchar("record_type", { length: 20 }).notNull(),
  recordDate: date("record_date").notNull(),
  /**
   * @type { weight?: number, bodyFat?: number, bloodPressureSystolic?: number, bloodPressureDiastolic?: number, heartRate?: number, exerciseType?: string, durationMinutes?: number, intensity?: string, calories?: number, sleepHours?: number, sleepQuality?: number }
   */
  metrics: jsonb("metrics").notNull().default('{}'),
  note: text("note"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_health_records_type_date").on(table.recordType, table.recordDate),
]);

export const lifeFinanceBudgets = pgTable("life_finance_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: varchar("category", { length: 50 }).notNull(),
  amount: numeric("amount").notNull(),
  period: varchar("period", { length: 20 }).notNull().default('monthly'),
  periodKey: varchar("period_key", { length: 20 }).notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  uniqueIndex("idx_life_finance_budgets_unique").on(table.category, table.periodKey, table.period),
]);

export const lifeFinanceTransactions = pgTable("life_finance_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 10 }).notNull().default('expense'),
  amount: numeric("amount").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  subcategory: varchar("subcategory", { length: 50 }),
  accountId: uuid("account_id"),
  targetAccountId: uuid("target_account_id"),
  note: text("note"),
  transactionDate: date("transaction_date").notNull().default('CURRENT_DATE'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_finance_tx_date").on(table.transactionDate),
  index("idx_life_finance_tx_category").on(table.category),
  index("idx_life_finance_tx_type").on(table.type),
  foreignKey({
    columns: [table.accountId],
    foreignColumns: [lifeFinanceAccounts.id],
    name: "life_finance_transactions_account_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.targetAccountId],
    foreignColumns: [lifeFinanceAccounts.id],
    name: "life_finance_transactions_target_account_id_fkey",
  }).onDelete("set null"),
]);

export const lifeFinanceAccounts = pgTable("life_finance_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull().default('cash'),
  balance: numeric("balance").notNull().default('0'),
  currency: varchar("currency", { length: 10 }).notNull().default('CNY'),
  color: varchar("color", { length: 20 }),
  icon: varchar("icon", { length: 50 }),
  note: varchar("note", { length: 255 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_finance_accounts_type").on(table.type),
]);

export const lifeTasks = pgTable("life_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default('inbox'),
  priority: varchar("priority", { length: 20 }).notNull().default('medium'),
  quadrant: varchar("quadrant", { length: 20 }).default('q2'),
  dueDate: date("due_date"),
  tags: text("tags").array().default([]),
  project: varchar("project", { length: 100 }),
  context: varchar("context", { length: 100 }),
  /**
   * @type { id: string, title: string, completed: boolean }[]
   */
  subtasks: jsonb("subtasks").default('[]'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_tasks_status").on(table.status),
  index("idx_life_tasks_priority").on(table.priority),
  index("idx_life_tasks_created").on(table.createdAt),
]);

export const lifeChildResources = pgTable("life_child_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default('english'),
  series: varchar("series", { length: 255 }),
  resourceType: varchar("resource_type", { length: 50 }).notNull().default('book'),
  description: text("description"),
  resourceUrl: text("resource_url"),
  level: varchar("level", { length: 100 }),
  icon: varchar("icon", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_child_resources_category").on(table.category),
  index("idx_life_child_resources_name").on(table.name),
  index("idx_life_child_resources_sort").on(table.sortOrder, table.createdAt),
]);

export const lifeAiChatHistory = pgTable("life_ai_chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  sessionId: varchar("session_id", { length: 100 }).notNull().default('default'),
  /**
   * @type [   {     "id": "string",     "type": "string",     "function": {       "name": "string",       "arguments": "object"     },     "status": "string",     "result": "unknown",     "errorMessage": "string"   } ]
   */
  toolCalls: jsonb("tool_calls").default('[]'),
  /**
   * @type [   {     "step": "string",     "status": "string",     "title": "string",     "detail": "string"   } ]
   */
  preflightChecks: jsonb("preflight_checks").default('[]'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  index("idx_life_ai_chat_session").on(table.sessionId, table.createdAt),
]);

export const lifePluginConfig = pgTable("life_plugin_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginKey: varchar("plugin_key", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  version: varchar("version", { length: 50 }),
  /**
   * @type { cardTitle: string, cardDescription: string, cardIcon: string, routePath: string, gradientFrom: string, gradientTo: string }
   */
  config: jsonb("config").default('{}'),
  lifecycleStatus: varchar("lifecycle_status", { length: 20 }).notNull().default('discovered'),
  riskLevel: varchar("risk_level", { length: 10 }).notNull().default('low'),
  /**
   * @type string[]
   */
  capabilities: jsonb("capabilities").default('[]'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL END`),
}, (table) => [
  uniqueIndex("life_plugin_config_plugin_key_key").on(table.pluginKey),
]);

export const lifeQuickLinks = pgTable("life_quick_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  url: text("url").notNull(),
  icon: varchar("icon", { length: 50 }),
  category: varchar("category", { length: 100 }),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_life_quick_links_sort").on(table.sortOrder),
]);

export const lifePrinciples = pgTable("life_principles", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 100 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_life_principles_created").on(table.createdAt),
]);

export const lifeNotes = pgTable("life_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  tags: text("tags").array().default([]),
  isPinned: boolean("is_pinned").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_life_notes_pinned_created").on(table.isPinned, table.createdAt),
  index("idx_life_notes_created").on(table.createdAt),
]);

export const lifeEnergyRecords = pgTable("life_energy_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordDate: date("record_date").notNull(),
  energyLevel: integer("energy_level").notNull().default(5),
  focusLevel: integer("focus_level").notNull().default(5),
  mood: varchar("mood", { length: 50 }),
  note: text("note"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_life_energy_records_date").on(table.recordDate),
]);

export const lifeHabitRecords = pgTable("life_habit_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  habitId: uuid("habit_id").notNull(),
  recordDate: date("record_date").notNull(),
  completed: boolean("completed").notNull().default(true),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_life_habit_records_habit_date").on(table.habitId, table.recordDate),
  foreignKey({
    columns: [table.habitId],
    foreignColumns: [lifeHabits.id],
    name: "life_habit_records_habit_id_fkey",
  }).onDelete("cascade"),
]);

export const lifeHabits = pgTable("life_habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  frequency: varchar("frequency", { length: 20 }).notNull().default('daily'),
  streakCount: integer("streak_count").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_life_habits_created").on(table.createdAt),
]);

export const lifeGoals = pgTable("life_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default('active'),
  progress: integer("progress").notNull().default(0),
  category: varchar("category", { length: 100 }),
  deadline: date("deadline"),
  /**
   * @type { id: string, title: string, completed: boolean }[]
   */
  milestones: jsonb("milestones").default('[]'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_life_goals_status").on(table.status),
  index("idx_life_goals_created").on(table.createdAt),
]);

// table aliases
export const lifeAiChatHistoryTable = lifeAiChatHistory;
export const lifeAiChatSessionsTable = lifeAiChatSessions;
export const lifeChildResourcesTable = lifeChildResources;
export const lifeEnergyRecordsTable = lifeEnergyRecords;
export const lifeFinanceAccountsTable = lifeFinanceAccounts;
export const lifeFinanceBudgetsTable = lifeFinanceBudgets;
export const lifeFinanceTransactionsTable = lifeFinanceTransactions;
export const lifeGoalsTable = lifeGoals;
export const lifeHabitRecordsTable = lifeHabitRecords;
export const lifeHabitsTable = lifeHabits;
export const lifeHealthRecordsTable = lifeHealthRecords;
export const lifeLifeLogsTable = lifeLifeLogs;
export const lifeNotesTable = lifeNotes;
export const lifePluginConfigTable = lifePluginConfig;
export const lifePrinciplesTable = lifePrinciples;
export const lifeQuickLinksTable = lifeQuickLinks;
export const lifeTasksTable = lifeTasks;
