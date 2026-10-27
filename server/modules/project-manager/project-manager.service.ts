import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// ===== 常量 =====

/** 固定四阶段（方案 A：阶段暂时固定，后续可扩展） */
export const PROJECT_STAGES = [
  '立项',
  '开始开发',
  '完成 MVP',
  '完整功能上线',
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

/** 指令执行状态（状态机：待执行 → 执行中 → 完成 / 失败，可重跑回待执行） */
export const INSTRUCTION_STATUSES = [
  '待执行',
  '执行中',
  '完成',
  '失败',
] as const;
export type InstructionStatus = (typeof INSTRUCTION_STATUSES)[number];

/** 飞书多维表格默认开放平台域名 */
const FEISHU_BASE = 'https://open.feishu.cn';
/** 本地连接配置文件 */
const CONFIG_FILE = path.resolve(process.cwd(), 'user-data', 'project-manager-config.json');

// ===== 类型 =====

/** 飞书多维表格连接配置（存本地 user-data/project-manager-config.json） */
export interface ProjectManagerConfig {
  /** 多维表格 app_token（URL 中 base/<app_token>） */
  appToken: string;
  /** 项目主表 table_id */
  projectTableId: string;
  /** 指令任务表 table_id */
  instructionTableId: string;
  /** 认证方式一：飞书个人令牌（Bearer 直连） */
  apiToken?: string;
  /** 认证方式二：自建应用 App ID（与 appSecret 成对，二选一） */
  appId?: string;
  /** 认证方式二：自建应用 App Secret */
  appSecret?: string;
  /** 可选：表格预览链接（页面「打开表格」跳转用） */
  tableUrl?: string;
  /** 可选：轮询间隔（分钟），供影刀侧参考展示，本插件不实际调度影刀 */
  pollIntervalMin?: number;
  /** 可选：开放平台域名，默认 https://open.feishu.cn */
  baseUrl?: string;
  updatedAt?: string;
}

/** 聚合后的项目看板条目 */
export interface ProjectBoardItem {
  /** 飞书项目主表记录 ID */
  recordId: string;
  name: string;
  platform: string;
  stage: string;
  /** 当前阶段进度 %（0-100，页面只展示这个百分比，方案 A） */
  stageProgress: number;
  notes: string;
  owner: string;
  priority: string;
  updatedAt: string;
  /** 打开表格 URL（配置了 tableUrl 时基于其拼接，否则为空） */
  tableUrl: string;
  /** 指令汇总（由指令表统计） */
  instructionTotal: number;
  instructionCompleted: number;
  instructionFailed: number;
  instructionRunning: number;
  /** 项目详情：指令列表（按排序号） */
  instructions: InstructionBoardItem[];
}

export interface InstructionBoardItem {
  recordId: string;
  name: string;
  /** 所属项目 record_id（关联项目主表） */
  projectRecordId: string;
  platform: string;
  content: string;
  status: InstructionStatus;
  result: string;
  error: string;
  sortOrder: number;
  triggeredAt: string;
  completedAt: string;
  shadowTaskId: string;
}

export interface ProjectOverview {
  /** 连接配置状态：未配置时页面展示配置引导 */
  config: {
    configured: boolean;
    appToken: string;
    projectTableId: string;
    instructionTableId: string;
    tableUrl: string;
    pollIntervalMin: number;
    error?: string;
  };
  projects: ProjectBoardItem[];
}

// ===== 飞书字段值解析工具 =====

type FeishuFieldValue = unknown;

/** 文本/单选/数字 → 字符串（null/undefined → ''） */
function toText(value: FeishuFieldValue): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    // 多选 / 关联记录等多值字段
    return value
      .map((v) => {
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return String(v);
        if (v && typeof v === 'object') {
          const obj = v as Record<string, unknown>;
          const texts = obj.texts ?? obj.text ?? obj.name ?? obj.textContent;
          if (texts !== undefined) return toText(texts);
          return '';
        }
        return '';
      })
      .filter(Boolean)
      .join('、');
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const texts = obj.texts ?? obj.text ?? obj.name ?? obj.textContent;
    if (texts !== undefined) return toText(texts);
    return '';
  }
  return String(value);
}

/** 数字 → 数字（null/undefined/不可解析 → 0） */
function toNumber(value: FeishuFieldValue, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[%,\s]/g, ''));
    return Number.isFinite(n) ? n : fallback;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) return toNumber(obj.value, fallback);
  }
  return fallback;
}

/** 日期字段 → ISO 字符串（飞书时间戳为毫秒数字；文本直接返回） */
function toDateText(value: FeishuFieldValue): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 0) {
      const d = new Date(value > 1e12 ? value : value * 1000);
      return Number.isNaN(d.getTime()) ? '' : d.toISOString();
    }
    return '';
  }
  return toText(value);
}

/** 关联记录字段 → record_id 列表 */
function toRecordIds(value: FeishuFieldValue): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      ids.push(item);
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const rid = obj.record_id ?? obj.recordId;
      if (typeof rid === 'string' && rid) {
        ids.push(rid);
        continue;
      }
      const rids = obj.record_ids;
      if (Array.isArray(rids)) {
        for (const r of rids) if (typeof r === 'string' && r) ids.push(r);
      }
    }
  }
  return ids;
}

// ===== Service =====

@Injectable()
export class ProjectManagerService {
  private readonly logger = new Logger(ProjectManagerService.name);

  // ===== 配置读写 =====

  loadConfig(): ProjectManagerConfig {
    try {
      if (!fs.existsSync(CONFIG_FILE)) return {} as ProjectManagerConfig;
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...(raw ?? {}) } as ProjectManagerConfig;
    } catch (err) {
      this.logger.warn(`Load project-manager config failed: ${String(err)}`);
      return {} as ProjectManagerConfig;
    }
  }

  saveConfig(dto: Partial<ProjectManagerConfig>): ProjectManagerConfig {
    const current = this.loadConfig();
    const next: ProjectManagerConfig = {
      ...current,
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    // 认证方式互斥清洗：给了 appId/appSecret 则清掉 apiToken 残留的歧义由调用方控制
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
    return next;
  }

  getConfigStatus(): ProjectOverview['config'] {
    const cfg = this.loadConfig();
    const configured = Boolean(
      cfg.appToken && cfg.projectTableId && cfg.instructionTableId && (cfg.apiToken || (cfg.appId && cfg.appSecret)),
    );
    return {
      configured,
      appToken: cfg.appToken ?? '',
      projectTableId: cfg.projectTableId ?? '',
      instructionTableId: cfg.instructionTableId ?? '',
      tableUrl: cfg.tableUrl ?? '',
      pollIntervalMin: cfg.pollIntervalMin ?? 5,
    };
  }

  // ===== 飞书多维表格 API 客户端 =====

  private feishuBaseUrl(cfg: ProjectManagerConfig): string {
    return (cfg.baseUrl ?? FEISHU_BASE).replace(/\/+$/, '');
  }

  /** 解析配置；未配置则抛出带引导的异常 */
  private requireConfig(): ProjectManagerConfig {
    const cfg = this.loadConfig();
    if (!cfg.appToken || !cfg.projectTableId || !cfg.instructionTableId) {
      throw new BadRequestException('尚未配置飞书多维表格连接，请在页面右上角「连接配置」中填写 app_token 与表 ID');
    }
    if (!cfg.apiToken && !(cfg.appId && cfg.appSecret)) {
      throw new BadRequestException('尚未配置飞书 API 凭证：请填写个人令牌，或自建应用 App ID / App Secret');
    }
    return cfg;
  }

  /** 获取请求头（个人令牌 Bearer 或自建应用 tenant_access_token） */
  private async buildAuthHeaders(cfg: ProjectManagerConfig): Promise<Record<string, string>> {
    const base = this.feishuBaseUrl(cfg);
    let token = '';
    if (cfg.apiToken) {
      token = cfg.apiToken.trim();
    } else if (cfg.appId && cfg.appSecret) {
      // 自建应用：换取 tenant_access_token
      try {
        const resp = await fetch(`${base}/open-apis/auth/v3/tenant_access_token/internal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: cfg.appId, app_secret: cfg.appSecret }),
        });
        const data = (await resp.json()) as { code?: number; tenant_access_token?: string; msg?: string };
        if (data.code !== 0 || !data.tenant_access_token) {
          throw new Error(data.msg ?? '换取 tenant_access_token 失败');
        }
        token = data.tenant_access_token;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new BadRequestException(`飞书应用凭证换取失败：${msg}`);
      }
    }
    if (!token) {
      throw new BadRequestException('飞书 API 凭证为空');
    }
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  /** 分页拉取某表全部记录 */
  private async listAllRecords(
    cfg: ProjectManagerConfig,
    tableId: string,
    headers: Record<string, string>,
  ): Promise<Array<{ record_id: string; fields: Record<string, FeishuFieldValue> }>> {
    const base = this.feishuBaseUrl(cfg);
    const all: Array<{ record_id: string; fields: Record<string, FeishuFieldValue> }> = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({ page_size: '100' });
      if (pageToken) query.set('page_token', pageToken);
      const url = `${base}/open-apis/bitable/v1/apps/${cfg.appToken}/tables/${tableId}/records?${query.toString()}`;
      let resp: Response;
      try {
        resp = await fetch(url, { method: 'GET', headers });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new BadRequestException(`飞书多维表格请求失败（网络错误）：${msg}`);
      }
      const data = (await resp.json()) as {
        code?: number;
        msg?: string;
        data?: { items?: Array<{ record_id: string; fields: Record<string, FeishuFieldValue> }>; page_token?: string; has_more?: boolean };
      };
      if (data.code !== 0) {
        throw new BadRequestException(`飞书多维表格返回错误（code=${data.code}）：${data.msg ?? '未知错误'}`);
      }
      const items = data.data?.items ?? [];
      all.push(...items);
      pageToken = data.data?.page_token ?? '';
      if (!data.data?.has_more || !pageToken) break;
    } while (true);
    return all;
  }

  /** 更新单条记录字段 */
  private async updateRecord(
    cfg: ProjectManagerConfig,
    tableId: string,
    recordId: string,
    fields: Record<string, FeishuFieldValue>,
    headers: Record<string, string>,
  ): Promise<void> {
    const base = this.feishuBaseUrl(cfg);
    const url = `${base}/open-apis/bitable/v1/apps/${cfg.appToken}/tables/${tableId}/records/${recordId}`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fields }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`飞书多维表格更新失败（网络错误）：${msg}`);
    }
    const data = (await resp.json()) as { code?: number; msg?: string };
    if (data.code !== 0) {
      throw new BadRequestException(`飞书多维表格更新返回错误（code=${data.code}）：${data.msg ?? '未知错误'}`);
    }
  }

  // ===== 字段名兼容解析 =====

  private pickField(fields: Record<string, FeishuFieldValue>, candidates: string[]): FeishuFieldValue | undefined {
    for (const c of candidates) {
      if (fields[c] !== undefined) return fields[c];
    }
    return undefined;
  }

  /** 项目主表行 → 看板条目 */
  private mapProjectRow(
    row: { record_id: string; fields: Record<string, FeishuFieldValue> },
    instructions: InstructionBoardItem[],
    cfg: ProjectManagerConfig,
  ): ProjectBoardItem {
    const f = row.fields;
    const stage = toText(this.pickField(f, ['当前阶段', '阶段']));
    const stageProgress = Math.min(
      100,
      Math.max(
        0,
        toNumber(this.pickField(f, ['当前阶段进度 %', '当前阶段进度', '阶段进度'])),
      ),
    );
    const completed = instructions.filter((i) => i.status === '完成').length;
    const failed = instructions.filter((i) => i.status === '失败').length;
    const running = instructions.filter((i) => i.status === '执行中').length;
    return {
      recordId: row.record_id,
      name: toText(this.pickField(f, ['项目名称', '名称', '项目名'])),
      platform: toText(this.pickField(f, ['平台'])),
      stage,
      stageProgress,
      notes: toText(this.pickField(f, ['注意事项', '备注'])),
      owner: toText(this.pickField(f, ['负责人'])),
      priority: toText(this.pickField(f, ['优先级'])),
      updatedAt: toDateText(this.pickField(f, ['更新时间', '更新日期'])),
      tableUrl: cfg.tableUrl ? `${cfg.tableUrl.replace(/\/+$/, '')}?table=${cfg.projectTableId}` : '',
      instructionTotal: instructions.length,
      instructionCompleted: completed,
      instructionFailed: failed,
      instructionRunning: running,
      instructions,
    };
  }

  /** 指令任务表行 → 看板条目 */
  private mapInstructionRow(row: { record_id: string; fields: Record<string, FeishuFieldValue> }): InstructionBoardItem {
    const f = row.fields;
    const statusRaw = toText(this.pickField(f, ['执行状态', '状态']));
    const status = (INSTRUCTION_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as InstructionStatus)
      : '待执行';
    return {
      recordId: row.record_id,
      name: toText(this.pickField(f, ['指令编号', '指令名称', '指令编号 / 名称', '名称'])),
      projectRecordId: toRecordIds(this.pickField(f, ['所属项目', '项目']))[0] ?? '',
      platform: toText(this.pickField(f, ['平台'])),
      content: toText(this.pickField(f, ['对话内容', '对话 / 指令内容', '指令内容', '内容'])),
      status,
      result: toText(this.pickField(f, ['返回结果', '结果'])),
      error: toText(this.pickField(f, ['错误信息', '错误'])),
      sortOrder: toNumber(this.pickField(f, ['排序号', '序号']), 0),
      triggeredAt: toDateText(this.pickField(f, ['触发时间'])),
      completedAt: toDateText(this.pickField(f, ['完成时间'])),
      shadowTaskId: toText(this.pickField(f, ['影刀任务 ID', '影刀任务ID', '任务 ID'])),
    };
  }

  // ===== 聚合对外接口 =====

  /** 拉取两张表并聚合成看板（云函数聚合层） */
  async getOverview(): Promise<ProjectOverview> {
    const configStatus = this.getConfigStatus();
    if (!configStatus.configured) {
      return { config: configStatus, projects: [] };
    }
    const cfg = this.requireConfig();
    try {
      const headers = await this.buildAuthHeaders(cfg);
      const [projectRows, instructionRows] = await Promise.all([
        this.listAllRecords(cfg, cfg.projectTableId, headers),
        this.listAllRecords(cfg, cfg.instructionTableId, headers),
      ]);

      const instructions = instructionRows
        .map((r) => this.mapInstructionRow(r))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const projects = projectRows.map((r) => {
        const mine = instructions.filter((i) => i.projectRecordId === r.record_id);
        return this.mapProjectRow(r, mine, cfg);
      });

      return {
        config: { ...configStatus, error: undefined },
        projects,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { config: { ...configStatus, error: msg }, projects: [] };
    }
  }

  /** 项目详情（含指令列表） */
  async getProject(recordId: string): Promise<ProjectBoardItem | null> {
    const overview = await this.getOverview();
    return overview.projects.find((p) => p.recordId === recordId) ?? null;
  }

  /** 更新项目注意事项（Markdown 原文写回飞书项目主表） */
  async updateProjectNotes(recordId: string, notes: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.requireConfig();
    const headers = await this.buildAuthHeaders(cfg);
    const rows = await this.listAllRecords(cfg, cfg.projectTableId, headers);
    const row = rows.find((r) => r.record_id === recordId);
    if (!row) {
      throw new NotFoundException(`未找到项目记录：${recordId}`);
    }
    // 兼容字段名：表里可能叫「注意事项」或「备注」
    const fieldName = row.fields['注意事项'] !== undefined ? '注意事项' : row.fields['备注'] !== undefined ? '备注' : '注意事项';
    await this.updateRecord(cfg, cfg.projectTableId, recordId, { [fieldName]: notes ?? '' }, headers);
    this.logger.log(`Project ${recordId} notes updated (${notes?.length ?? 0} chars)`);
    return { success: true, message: '注意事项已保存到飞书多维表格' };
  }

  /** 单条指令详情（供影刀/前端定位） */
  private async findInstruction(recordId: string): Promise<{
    cfg: ProjectManagerConfig;
    headers: Record<string, string>;
    row: { record_id: string; fields: Record<string, FeishuFieldValue> };
  }> {
    const cfg = this.requireConfig();
    const headers = await this.buildAuthHeaders(cfg);
    const rows = await this.listAllRecords(cfg, cfg.instructionTableId, headers);
    const row = rows.find((r) => r.record_id === recordId);
    if (!row) {
      throw new NotFoundException(`未找到指令记录：${recordId}`);
    }
    return { cfg, headers, row };
  }

  /** 重新执行：任何状态 → 待执行（清空返回结果与错误信息，允许覆盖重跑） */
  async rerunInstruction(recordId: string): Promise<{ success: boolean; message: string }> {
    const { cfg, headers, row } = await this.findInstruction(recordId);
    const mapped = this.mapInstructionRow(row);
    const fields: Record<string, FeishuFieldValue> = {
      执行状态: '待执行',
      返回结果: '',
      错误信息: '',
    };
    // 兼容字段名：若表里用的是「状态 / 结果 / 错误」，一并覆盖
    if (row.fields['状态'] !== undefined) fields['状态'] = '待执行';
    if (row.fields['结果'] !== undefined) fields['结果'] = '';
    if (row.fields['错误'] !== undefined) fields['错误'] = '';
    await this.updateRecord(cfg, cfg.instructionTableId, recordId, fields, headers);
    this.logger.log(`Rerun instruction ${recordId} (${mapped.name}) → 待执行`);
    return { success: true, message: `指令「${mapped.name || recordId}」已重新排队（待执行）` };
  }

  /** 影刀领取：待执行 → 执行中（加锁防重复触发），写触发时间 */
  async claimInstruction(recordId: string): Promise<{ success: boolean; status: InstructionStatus }> {
    const { cfg, headers, row } = await this.findInstruction(recordId);
    const mapped = this.mapInstructionRow(row);
    if (mapped.status !== '待执行') {
      throw new BadRequestException(`指令当前状态为「${mapped.status}」，仅「待执行」可被领取执行`);
    }
    const fields: Record<string, FeishuFieldValue> = {
      执行状态: '执行中',
      触发时间: Date.now(),
    };
    if (row.fields['状态'] !== undefined) fields['状态'] = '执行中';
    await this.updateRecord(cfg, cfg.instructionTableId, recordId, fields, headers);
    return { success: true, status: '执行中' };
  }

  /** 影刀回填：执行中 → 完成 / 失败，写返回结果 / 错误信息 / 完成时间 */
  async reportInstruction(
    recordId: string,
    dto: { status: '完成' | '失败'; result?: string; error?: string; shadowTaskId?: string },
  ): Promise<{ success: boolean; status: InstructionStatus }> {
    const { cfg, headers, row } = await this.findInstruction(recordId);
    const mapped = this.mapInstructionRow(row);
    if (mapped.status !== '执行中') {
      throw new BadRequestException(`指令当前状态为「${mapped.status}」，仅「执行中」可回填结果`);
    }
    const fields: Record<string, FeishuFieldValue> = {
      执行状态: dto.status,
      完成时间: Date.now(),
      返回结果: dto.result ?? '',
      错误信息: dto.error ?? '',
    };
    if (row.fields['状态'] !== undefined) fields['状态'] = dto.status;
    if (row.fields['结果'] !== undefined) fields['结果'] = dto.result ?? '';
    if (row.fields['错误'] !== undefined) fields['错误'] = dto.error ?? '';
    if (dto.shadowTaskId && (row.fields['影刀任务 ID'] !== undefined || row.fields['影刀任务ID'] !== undefined)) {
      fields['影刀任务 ID'] = dto.shadowTaskId;
    }
    await this.updateRecord(cfg, cfg.instructionTableId, recordId, fields, headers);
    this.logger.log(`Report instruction ${recordId} (${mapped.name}) → ${dto.status}`);
    return { success: true, status: dto.status };
  }

  /** 测试连接：校验凭证并拉取项目表首条记录 */
  async testConnection(dto?: Partial<ProjectManagerConfig>): Promise<{ success: boolean; message: string }> {
    const cfg = dto ? { ...this.loadConfig(), ...dto } : this.loadConfig();
    if (!cfg.appToken || !cfg.projectTableId) {
      return { success: false, message: '请先填写 app_token 与项目主表 table_id' };
    }
    try {
      const headers = await this.buildAuthHeaders(cfg);
      const rows = await this.listAllRecords(cfg, cfg.projectTableId, headers);
      return {
        success: true,
        message: `连接成功，项目主表可读取 ${rows.length} 条记录（请确保指令表 table_id 也正确）`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `连接失败：${msg}` };
    }
  }
}
