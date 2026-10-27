import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export type ProjectStage = '立项' | '开始开发' | '完成 MVP' | '完整功能上线';
export type InstructionStatus = '待执行' | '执行中' | '完成' | '失败';

export interface InstructionBoardItem {
  recordId: string;
  name: string;
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

export interface ProjectBoardItem {
  recordId: string;
  name: string;
  platform: string;
  stage: string;
  stageProgress: number;
  notes: string;
  owner: string;
  priority: string;
  updatedAt: string;
  tableUrl: string;
  instructionTotal: number;
  instructionCompleted: number;
  instructionFailed: number;
  instructionRunning: number;
  instructions: InstructionBoardItem[];
}

export interface ProjectOverview {
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

export interface ProjectManagerConfig {
  appToken?: string;
  projectTableId?: string;
  instructionTableId?: string;
  apiToken?: string;
  appId?: string;
  appSecret?: string;
  tableUrl?: string;
  pollIntervalMin?: number;
  baseUrl?: string;
}

export interface ProjectManagerConfigView {
  appToken: string;
  projectTableId: string;
  instructionTableId: string;
  tableUrl: string;
  pollIntervalMin: number;
  baseUrl: string;
  hasApiToken: boolean;
  hasAppCredential: boolean;
  updatedAt: string;
}

export async function getOverview(): Promise<ProjectOverview> {
  const response = await axiosForBackend({
    url: '/api/project-manager/overview',
    method: 'GET',
  });
  return response.data;
}

export async function getProject(recordId: string): Promise<ProjectBoardItem | null> {
  const response = await axiosForBackend({
    url: `/api/project-manager/projects/${encodeURIComponent(recordId)}`,
    method: 'GET',
  });
  return response.data;
}

export async function rerunInstruction(recordId: string): Promise<{ success: boolean; message: string }> {
  const response = await axiosForBackend({
    url: `/api/project-manager/instructions/${encodeURIComponent(recordId)}/rerun`,
    method: 'POST',
  });
  return response.data;
}

export async function updateProjectNotes(recordId: string, notes: string): Promise<{ success: boolean; message: string }> {
  const response = await axiosForBackend({
    url: `/api/project-manager/projects/${encodeURIComponent(recordId)}/notes`,
    method: 'PUT',
    data: { notes },
  });
  return response.data;
}

export async function getConfig(): Promise<ProjectManagerConfigView> {
  const response = await axiosForBackend({
    url: '/api/project-manager/config',
    method: 'GET',
  });
  return response.data;
}

export async function saveConfig(dto: ProjectManagerConfig): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: '/api/project-manager/config',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function testConnection(dto?: ProjectManagerConfig): Promise<{ success: boolean; message: string }> {
  const response = await axiosForBackend({
    url: '/api/project-manager/config/test',
    method: 'POST',
    data: dto ?? {},
  });
  return response.data;
}
