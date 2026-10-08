/**
 * Drizzle 兼容操作符（本地 JSON 存储适配器使用）
 *
 * 业务 service 原本从 'drizzle-orm' 导入 eq/and/or/like/desc/asc/count 等操作符，
 * 本模块提供同名函数，返回适配器可识别的简单结构，保证 service 业务逻辑无需改动。
 */

export interface LocalCondition {
  op: 'eq' | 'and' | 'or' | 'like' | 'ne' | 'gte' | 'lte' | 'gt' | 'lt';
  column?: string;
  value?: unknown;
  children?: (LocalCondition | LocalRawSql)[];
}

export interface LocalOrder {
  column: string;
  dir: 'asc' | 'desc';
}

export interface CountProjection {
  isCount: true;
}

/** 从 drizzle Column 对象或字符串解析 JS 列名 */
function resolveColumnName(column: unknown): string {
  if (typeof column === 'string') return column;
  if (column && typeof column === 'object' && 'name' in column) {
    return (column as { name: string }).name;
  }
  return String(column);
}

export function eq(column: unknown, value: unknown): LocalCondition {
  return { op: 'eq', column: resolveColumnName(column), value };
}

export function ne(column: unknown, value: unknown): LocalCondition {
  return { op: 'ne', column: resolveColumnName(column), value };
}

export function like(column: unknown, value: unknown): LocalCondition {
  return { op: 'like', column: resolveColumnName(column), value: String(value) };
}

export function ilike(column: unknown, value: unknown): LocalCondition {
  return { op: 'like', column: resolveColumnName(column), value: String(value) };
}

export function gte(column: unknown, value: unknown): LocalCondition {
  return { op: 'gte', column: resolveColumnName(column), value };
}

export function lte(column: unknown, value: unknown): LocalCondition {
  return { op: 'lte', column: resolveColumnName(column), value };
}

export function gt(column: unknown, value: unknown): LocalCondition {
  return { op: 'gt', column: resolveColumnName(column), value };
}

export function lt(column: unknown, value: unknown): LocalCondition {
  return { op: 'lt', column: resolveColumnName(column), value };
}

export function and(...conds: (LocalCondition | LocalRawSql | undefined)[]): LocalCondition {
  return {
    op: 'and',
    children: conds.filter(Boolean) as (LocalCondition | LocalRawSql)[],
  };
}

export function or(...conds: (LocalCondition | LocalRawSql | undefined)[]): LocalCondition {
  return {
    op: 'or',
    children: conds.filter(Boolean) as (LocalCondition | LocalRawSql)[],
  };
}

export function desc(column: unknown): LocalOrder {
  return { column: resolveColumnName(column), dir: 'desc' };
}

export function asc(column: unknown): LocalOrder {
  return { column: resolveColumnName(column), dir: 'asc' };
}

export function count(): CountProjection {
  return { isCount: true };
}

/** 原生 SQL 模板（本地适配器支持有限模式：sum/coalesce 聚合、is not null、::date 条件） */
export interface LocalRawSql {
  raw: string;
  columns: string[];
}

export function sql<T = unknown>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): LocalRawSql {
  let raw = '';
  for (let i = 0; i < strings.length; i++) {
    raw += strings[i];
    if (i < values.length) raw += `{{${i}}}`;
  }
  const columns = values.map((v) => resolveColumnName(v));
  return { raw, columns };
}

// 保持与 drizzle-orm 相同的默认导出形态，避免业务代码里 `import { eq }` 之外的用法报错
export default { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql };
