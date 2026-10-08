import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { LocalCondition, LocalOrder, LocalRawSql } from './drizzle-compat';

/**
 * 本地 JSON 文件数据库（Drizzle 兼容适配器）
 *
 * 以 Drizzle 链式 API（select/insert/update/delete/transaction）为契约，
 * 将表数据落盘到 user-data/*.json 文件，业务 service 无需改动即可本地运行。
 *
 * 数据目录：默认 <项目根>/user-data，可通过环境变量 STORAGE_DATA_DIR 覆盖。
 * 后期迁移线上数据库时，仅需把 service 注入源切换回 DRIZZLE_DATABASE 即可。
 */

const TABLE_NAME_SYM = Symbol.for('drizzle:Name');
const TABLE_COLUMNS_SYM = Symbol.for('drizzle:Columns');

interface ColumnMeta {
  columnType?: string;
  hasDefault?: boolean;
  default?: unknown;
  notNull?: boolean;
}

interface ColumnMeta {
  columnType?: string;
  hasDefault?: boolean;
  default?: unknown;
  notNull?: boolean;
  name?: string;
}

function getTableName(table: unknown): string {
  const dbName = (table as Record<symbol, unknown>)[TABLE_NAME_SYM];
  if (typeof dbName === 'string' && dbName) {
    return dbName.replace(/_/g, '-');
  }
  throw new Error('无法识别 drizzle 表对象');
}

function getColumns(table: unknown): Record<string, ColumnMeta> {
  return ((table as Record<symbol, unknown>)[TABLE_COLUMNS_SYM] ?? {}) as Record<
    string,
    ColumnMeta
  >;
}

function resolveColumnName(column: unknown): string {
  if (typeof column === 'string') return column;
  if (column && typeof column === 'object' && 'name' in column) {
    return (column as { name: string }).name;
  }
  return String(column);
}

/** 真实 SQL 类型（customType 需 getSQLType） */
function sqlTypeOf(meta: ColumnMeta): string {
  const raw = (meta as unknown as { getSQLType?: () => string }).getSQLType?.() ?? '';
  return String(raw).toLowerCase();
}

function isDateColumn(meta: ColumnMeta): boolean {
  return sqlTypeOf(meta).includes('timestamp');
}

function isJsonColumn(meta: ColumnMeta): boolean {
  return sqlTypeOf(meta).includes('json');
}

function isNumericColumn(meta: ColumnMeta): boolean {
  const t = sqlTypeOf(meta);
  return t.includes('numeric') || t.includes('decimal') || meta.columnType === 'PgNumeric';
}

function isUuidColumn(meta: ColumnMeta): boolean {
  return sqlTypeOf(meta).includes('uuid');
}

function isBooleanColumn(meta: ColumnMeta): boolean {
  return sqlTypeOf(meta).includes('bool');
}

/** 兼容比较：处理 Date vs string、number vs string 等类型差异 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a instanceof Date && typeof b === 'string') {
    return a.toISOString() === b || a.toISOString().slice(0, 10) === b || a.toISOString().slice(0, 16) === b;
  }
  if (b instanceof Date && typeof a === 'string') return valuesEqual(b, a);
  if (typeof a === 'number' && typeof b === 'string') return String(a) === b;
  if (typeof b === 'number' && typeof a === 'string') return String(b) === a;
  return a === b;
}

function compareValues(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  const as = String(av);
  const bs = String(bv);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function isRawSql(v: unknown): v is LocalRawSql {
  return !!v && typeof v === 'object' && 'raw' in v && Array.isArray((v as LocalRawSql).columns);
}

/** 解析本地适配器支持的 SQL 片段：`${col} is not null`、`${col}::date = CURRENT_DATE` */
function matchRawSql(raw: string, columns: string[], row: Record<string, unknown>): boolean {
  const col = columns[0] ?? '';
  const value = row[col];
  const trimmed = raw.replace(/\{\{\d+\}\}/g, '${col}').replace(/\s+/g, ' ').trim();
  if (/is not null/i.test(trimmed)) {
    return value != null;
  }
  if (/is null/i.test(trimmed)) {
    return value == null;
  }
  if (/::date\s*=\s*CURRENT_DATE/i.test(trimmed)) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (value instanceof Date) return value.toISOString().slice(0, 10) === todayStr;
    return String(value ?? '').slice(0, 10) === todayStr;
  }
  // 未识别的 SQL 条件：放行（避免本地运行崩溃）
  return true;
}

function matchCondition(
  cond: LocalCondition | LocalRawSql,
  row: Record<string, unknown>,
): boolean {
  if (isRawSql(cond)) {
    return matchRawSql(cond.raw, cond.columns, row);
  }
  switch (cond.op) {
    case 'and':
      return (cond.children ?? []).every((c) => matchCondition(c, row));
    case 'or':
      return (cond.children ?? []).some((c) => matchCondition(c, row));
    case 'eq': {
      const value = row[cond.column ?? ''];
      if (Array.isArray(value) && cond.value !== undefined) {
        return value.some((v) => valuesEqual(v, cond.value));
      }
      return valuesEqual(value, cond.value);
    }
    case 'ne':
      return !valuesEqual(row[cond.column ?? ''], cond.value);
    case 'gte':
      return compareValues(row[cond.column ?? ''], cond.value) >= 0;
    case 'lte':
      return compareValues(row[cond.column ?? ''], cond.value) <= 0;
    case 'gt':
      return compareValues(row[cond.column ?? ''], cond.value) > 0;
    case 'lt':
      return compareValues(row[cond.column ?? ''], cond.value) < 0;
    case 'like': {
      const value = row[cond.column ?? ''];
      if (value == null) return false;
      const pattern = String(cond.value ?? '');
      const regex = new RegExp(
        '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$',
        'i',
      );
      return regex.test(String(value));
    }
    default:
      return true;
  }
}

/** 列求和：兼容 numeric（字符串）与 number */
function sumColumn(rows: any[], col: string): number {
  return rows.reduce((acc, r) => {
    const v = r[col];
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return acc + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

/** 解析 drizzle 默认值（字符串或 queryChunks 对象） */
function parseDefaultValue(meta: ColumnMeta): unknown {
  const def = meta.default;
  if (def == null) return undefined;
  let text = '';
  if (typeof def === 'string') {
    text = def;
  } else if (typeof def === 'object') {
    const chunks = (def as { queryChunks?: { value?: unknown[] }[] }).queryChunks;
    if (Array.isArray(chunks)) {
      text = chunks
        .flatMap((c) => (Array.isArray(c.value) ? c.value : [c.value]))
        .filter((v): v is string => typeof v === 'string')
        .join('');
    }
  }
  const t = text.toLowerCase();
  if (t.includes('current_timestamp') || t.includes('now()')) return new Date();
  if (t.includes('current_date')) return new Date().toISOString().slice(0, 10);
  if (t.includes('random_uuid') || t.includes('uuid_generate')) return crypto.randomUUID();
  if (t.includes('true')) return true;
  if (t.includes('false')) return false;
  if (t.includes('{}')) return {};
  if (t.includes('[]')) return [];
  return undefined;
}

function defaultValueForType(meta: ColumnMeta): unknown {
  if (isDateColumn(meta)) return new Date();
  if (isBooleanColumn(meta)) return false;
  if (meta.columnType === 'PgInteger' || meta.columnType === 'PgSmallInteger') return 0;
  if (isJsonColumn(meta)) return null;
  if (isUuidColumn(meta)) return crypto.randomUUID();
  if (meta.columnType === 'PgNumeric') return '0';
  return null;
}

@Injectable()
export class LocalDatabase {
  private readonly logger = new Logger(LocalDatabase.name);
  private readonly dataDir: string;
  private readonly cache = new Map<string, any[]>();
  private pendingWrites: Map<string, any[]> | null = null;

  constructor() {
    this.dataDir =
      process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data');
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.logger.log(
      `LocalDatabase ready, data dir: ${this.dataDir} (STORAGE_DRIVER=file)`,
    );
  }

  private filePath(tableKey: string): string {
    return path.join(this.dataDir, `${tableKey}.json`);
  }

  private tableKey(table: unknown): string {
    return getTableName(table);
  }

  readRows(table: unknown): any[] {
    const key = this.tableKey(table);
    if (this.pendingWrites?.has(key)) return this.pendingWrites.get(key)!;
    if (this.cache.has(key)) return this.cache.get(key)!;
    let rows: any[] = [];
    const fp = this.filePath(key);
    if (fs.existsSync(fp)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        rows = Array.isArray(parsed) ? parsed : [];
      } catch {
        rows = [];
      }
    }
    this.cache.set(key, rows);
    return rows;
  }

  writeRows(table: unknown): void {
    const key = this.tableKey(table);
    const rows = this.cache.get(key) ?? [];
    if (this.pendingWrites) {
      this.pendingWrites.set(key, rows);
      return;
    }
    fs.writeFileSync(this.filePath(key), JSON.stringify(rows, null, 2), 'utf-8');
  }

  /** 内部方法：整体替换表数据并落盘（delete 用） */
  replaceRows(table: unknown, rows: any[]): void {
    const key = this.tableKey(table);
    if (this.pendingWrites) {
      this.pendingWrites.set(key, rows);
      return;
    }
    this.cache.set(key, rows);
    fs.writeFileSync(this.filePath(key), JSON.stringify(rows, null, 2), 'utf-8');
  }

  /** 还原列类型：timestamp → Date；同时写入 JS 属性名与 DB 列名双键（就地修改） */
  hydrateRow(table: unknown, row: Record<string, unknown>): Record<string, unknown> {
    const cols = getColumns(table);
    for (const [jsName, meta] of Object.entries(cols)) {
      const dbName = meta.name ?? jsName;
      let val = row[jsName] !== undefined ? row[jsName] : row[dbName];
      if (val === undefined) continue;
      if (val == null && meta.notNull) {
        val = defaultValueForType(meta);
      }
      if (isDateColumn(meta) && val != null && !(val instanceof Date)) {
        val = new Date(val as string | number);
      } else if (isNumericColumn(meta) && typeof val === 'number') {
        val = String(val);
      } else if (isBooleanColumn(meta) && typeof val === 'string') {
        val = val === 'true' || val === '1';
      }
      row[jsName] = val;
      if (dbName !== jsName) row[dbName] = val;
    }
    return row;
  }

  /** 插入时补默认值（id/createdAt/updatedAt/notNull 列）；同时写 JS 名与 DB 列名双键（就地修改） */
  applyDefaults(table: unknown, row: Record<string, unknown>): Record<string, unknown> {
    const cols = getColumns(table);
    for (const [jsName, meta] of Object.entries(cols)) {
      const dbName = meta.name ?? jsName;
      const exists = row[jsName] !== undefined && row[jsName] !== null;
      if (exists) {
        if (dbName !== jsName && row[dbName] === undefined) row[dbName] = row[jsName];
        continue;
      }
      let def: unknown;
      if (jsName === 'id' || (meta.notNull && isUuidColumn(meta))) {
        def = crypto.randomUUID();
      } else if (meta.hasDefault) {
        def = parseDefaultValue(meta);
        if (def === undefined && meta.notNull) def = defaultValueForType(meta);
      } else if (meta.notNull) {
        def = defaultValueForType(meta);
      }
      if (def !== undefined) {
        row[jsName] = def;
        if (dbName !== jsName) row[dbName] = def;
      }
    }
    return row;
  }

  // ================= select =================
  select(projection?: Record<string, unknown>): LocalSelectQuery {
    return new LocalSelectQuery(this, projection);
  }

  insert(table: unknown): LocalInsertQuery {
    return new LocalInsertQuery(this, table);
  }

  update(table: unknown): LocalUpdateQuery {
    return new LocalUpdateQuery(this, table);
  }

  delete(table: unknown): LocalDeleteQuery {
    return new LocalDeleteQuery(this, table);
  }

  // ================= transaction =================
  async transaction<T>(callback: (tx: LocalDatabase) => Promise<T>): Promise<T> {
    const prev = this.pendingWrites;
    this.pendingWrites = new Map();
    try {
      const result = await callback(this);
      for (const [key, rows] of this.pendingWrites) {
        fs.writeFileSync(this.filePath(key), JSON.stringify(rows, null, 2), 'utf-8');
      }
      return result;
    } catch (err) {
      for (const key of this.pendingWrites.keys()) {
        this.cache.delete(key);
      }
      throw err;
    } finally {
      this.pendingWrites = prev;
    }
  }
}

// ===================== Query Builders =====================

class LocalSelectQuery {
  private conds: (LocalCondition | LocalRawSql)[] = [];
  private orders: LocalOrder[] = [];
  private rawOrders: LocalRawSql[] = [];
  private groupCols: string[] = [];
  private lim?: number;
  private off = 0;
  private table: unknown;
  private projection?: Record<string, unknown>;

  constructor(
    private readonly db: LocalDatabase,
    projection?: Record<string, unknown>,
  ) {
    this.projection = projection;
  }

  from(table: unknown): this {
    this.table = table;
    return this;
  }

  where(...conds: (LocalCondition | LocalRawSql | undefined)[]): this {
    this.conds.push(...(conds.filter(Boolean) as (LocalCondition | LocalRawSql)[]));
    return this;
  }

  orderBy(...orders: (LocalOrder | LocalRawSql | unknown)[]): this {
    for (const o of orders) {
      if (o && typeof o === 'object' && 'raw' in o) {
        this.rawOrders.push(o as LocalRawSql);
      } else if (o && typeof o === 'object' && 'column' in o && 'dir' in o) {
        this.orders.push(o as LocalOrder);
      } else {
        this.orders.push({ column: resolveColumnName(o), dir: 'asc' });
      }
    }
    return this;
  }

  groupBy(...cols: unknown[]): this {
    this.groupCols.push(...cols.map((c) => resolveColumnName(c)));
    return this;
  }

  limit(n: number): this {
    this.lim = n;
    return this;
  }

  offset(n: number): this {
    this.off = n;
    return this;
  }

  async run(): Promise<any[]> {
    const table = this.table!;
    let rows = this.db.readRows(table).map((r) => this.db.hydrateRow(table, r));

    if (this.conds.length > 0) {
      rows = rows.filter((r) => this.conds.every((c) => matchCondition(c, r)));
    }

    // 聚合模式：groupBy 分组聚合，或投影含 sum 聚合（无 groupBy 时整表聚合）
    const hasSumAgg = this.projection
      ? Object.values(this.projection).some((v) => isRawSql(v) && /sum\(/i.test(v.raw))
      : false;

    if (this.groupCols.length > 0) {
      const groups = new Map<string, any[]>();
      for (const r of rows) {
        const key = this.groupCols.map((c) => String(r[c] ?? '')).join('\u0001');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }
      const out: any[] = [];
      for (const groupRows of groups.values()) {
        const row: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(this.projection ?? {})) {
          if (v && (v as { isCount?: boolean }).isCount) row[key] = groupRows.length;
          else if (isRawSql(v) && /sum\(/i.test(v.raw)) row[key] = sumColumn(groupRows, v.columns[0]);
          else row[key] = groupRows[0]?.[resolveColumnName(v)];
        }
        out.push(row);
      }
      // 聚合排序：orderBy(sql`sum(col) desc`) → 按投影 sum 值排序
      if (this.rawOrders.length > 0) {
        const sumKey = Object.keys(this.projection ?? {}).find((k) => {
          const v = this.projection![k];
          return isRawSql(v) && /sum\(/i.test(v.raw);
        });
        if (sumKey) {
          const dir = /desc/i.test(this.rawOrders[0].raw) ? 'desc' : 'asc';
          out.sort((a, b) => {
            const av = Number(a[sumKey] ?? 0);
            const bv = Number(b[sumKey] ?? 0);
            return dir === 'desc' ? bv - av : av - bv;
          });
        }
      }
      return out;
    }

    const hasCount = this.projection
      ? Object.values(this.projection).some((v) => v && (v as { isCount?: boolean }).isCount)
      : false;

    // count 聚合：返回单行 { count: N }，忽略分页
    if (hasCount) {
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(this.projection!)) {
        if (v && (v as { isCount?: boolean }).isCount) out[key] = rows.length;
        else out[key] = rows[0]?.[key];
      }
      return [out];
    }

    // sum 聚合（无 groupBy）：整表聚合单行
    if (hasSumAgg) {
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(this.projection!)) {
        if (v && (v as { isCount?: boolean }).isCount) out[key] = rows.length;
        else if (isRawSql(v) && /sum\(/i.test(v.raw)) out[key] = sumColumn(rows, v.columns[0]);
        else out[key] = rows[0]?.[resolveColumnName(v)];
      }
      return [out];
    }

    if (this.orders.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const o of this.orders) {
          const cmp = compareValues(a[o.column], b[o.column]);
          if (cmp !== 0) return o.dir === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
    }

    if (this.lim !== undefined) {
      rows = rows.slice(this.off, this.off + this.lim);
    } else if (this.off > 0) {
      rows = rows.slice(this.off);
    }

    if (this.projection) {
      return rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(this.projection!)) {
          if (v && (v as { isCount?: boolean }).isCount) out[key] = 1;
          else if (isRawSql(v) && /sum\(/i.test(v.raw)) out[key] = sumColumn([r], v.columns[0]);
          else out[key] = r[resolveColumnName(v)];
        }
        return out;
      });
    }
    return rows;
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class LocalInsertQuery {
  private insertValues: Record<string, unknown> | Record<string, unknown>[] = {};
  private conflictMode: 'nothing' | 'update' | null = null;
  private conflictTarget = 'id';
  private conflictJsName = 'id';
  private conflictSet: Record<string, unknown> = {};

  constructor(
    private readonly db: LocalDatabase,
    private readonly table: unknown,
  ) {}

  values(v: Record<string, unknown> | Record<string, unknown>[]): this {
    this.insertValues = v;
    return this;
  }

  /** 冲突（target 列值已存在）时跳过 —— seed 幂等 */
  onConflictDoNothing(): this {
    this.conflictMode = 'nothing';
    return this;
  }

  /** 冲突时更新指定列 —— upsert */
  onConflictDoUpdate(opts: {
    target: unknown;
    set: Record<string, unknown>;
  }): this {
    this.conflictMode = 'update';
    this.conflictTarget = resolveColumnName(opts.target);
    // 反查 JS 属性名（values 里用的是 camelCase 键）
    this.conflictJsName =
      Object.entries(getColumns(this.table)).find(
        ([k, m]) => (m.name ?? k) === this.conflictTarget,
      )?.[0] ?? this.conflictTarget;
    this.conflictSet = opts.set;
    return this;
  }

  async returning(projection?: Record<string, unknown>): Promise<any[]> {
    const db = this.db;
    const table = this.table;
    const rows = db.readRows(table);
    const list = Array.isArray(this.insertValues)
      ? this.insertValues
      : [this.insertValues];
    const inserted: any[] = [];

    for (const raw of list) {
      const rawKey = raw[this.conflictTarget] ?? raw[this.conflictJsName];
      const exists = rows.some(
        (r) => this.conflictMode && valuesEqual(r[this.conflictTarget], rawKey),
      );
      if (this.conflictMode === 'nothing' && exists) continue;
      if (this.conflictMode === 'update' && exists) {
        const target = rows.find((r) =>
          valuesEqual(r[this.conflictTarget], rawKey),
        );
        if (target) {
          Object.assign(target, { ...this.conflictSet, updatedAt: new Date() });
          inserted.push(target);
        }
        continue;
      }
      const row = db.applyDefaults(table, { ...raw });
      rows.push(row);
      inserted.push(row);
    }

    db.writeRows(table);
    const hydrated = inserted.map((r) => db.hydrateRow(table, r));
    if (projection) {
      return hydrated.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [key, col] of Object.entries(projection)) {
          out[key] = r[resolveColumnName(col)];
        }
        return out;
      });
    }
    return hydrated;
  }

  /** 支持 await db.insert(...).values(...) 直接执行（无显式 returning/execute 时） */
  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.returning().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<any[] | TResult> {
    return this.returning().catch(onrejected);
  }
}

class LocalUpdateQuery {
  private conds: (LocalCondition | LocalRawSql)[] = [];
  private updateValues: Record<string, unknown> = {};

  constructor(
    private readonly db: LocalDatabase,
    private readonly table: unknown,
  ) {}

  set(v: Record<string, unknown>): this {
    this.updateValues = v;
    return this;
  }

  where(...conds: (LocalCondition | LocalRawSql | undefined)[]): this {
    this.conds.push(...(conds.filter(Boolean) as (LocalCondition | LocalRawSql)[]));
    return this;
  }

  async returning(projection?: Record<string, unknown>): Promise<any[]> {
    const db = this.db;
    const table = this.table;
    const rows = db.readRows(table).map((r) => db.hydrateRow(table, r));
    const matched: any[] = [];
    for (const r of rows) {
      if (this.conds.every((c) => matchCondition(c, r))) {
        Object.assign(r, { ...this.updateValues, updatedAt: new Date() });
        // 同步 DB 列名键（updatedAt 的 DB 名 _updated_at）
        const cols = getColumns(table);
        for (const [jsName, meta] of Object.entries(cols)) {
          const dbName = meta.name ?? jsName;
          if (dbName !== jsName && r[jsName] !== undefined) r[dbName] = r[jsName];
        }
        matched.push(r);
      }
    }
    db.writeRows(table);
    if (projection) {
      return matched.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [key, col] of Object.entries(projection)) {
          out[key] = r[resolveColumnName(col)];
        }
        return out;
      });
    }
    return matched.map((r) => db.hydrateRow(table, r));
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.returning().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<any[] | TResult> {
    return this.returning().catch(onrejected);
  }
}

class LocalDeleteQuery {
  private conds: (LocalCondition | LocalRawSql)[] = [];

  constructor(
    private readonly db: LocalDatabase,
    private readonly table: unknown,
  ) {}

  where(...conds: (LocalCondition | LocalRawSql | undefined)[]): this {
    this.conds.push(...(conds.filter(Boolean) as (LocalCondition | LocalRawSql)[]));
    return this;
  }

  async returning(projection?: Record<string, unknown>): Promise<any[]> {
    const db = this.db;
    const table = this.table;
    const rows = db.readRows(table).map((r) => db.hydrateRow(table, r));
    const removed: any[] = [];
    const kept: any[] = [];
    for (const r of rows) {
      if (this.conds.every((c) => matchCondition(c, r))) removed.push(r);
      else kept.push(r);
    }
    db.replaceRows(table, kept);
    if (projection) {
      return removed.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [key, col] of Object.entries(projection)) {
          out[key] = r[resolveColumnName(col)];
        }
        return out;
      });
    }
    return removed.map((r) => db.hydrateRow(table, r));
  }

  /** 支持 await db.delete(...).where(...) 直接执行 */
  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.returning().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<any[] | TResult> {
    return this.returning().catch(onrejected);
  }
}
