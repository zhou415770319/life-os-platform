import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface InsightsSummary {
  generatedAt: string;
  todayStr: string;
  habitHeatmap: { date: string; count: number }[];
  habitStats: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    frequency: string;
    streakCount: number;
    totalCheckIns: number;
  }[];
  todayCheckIns: number;
  pomodoroDaily: { date: string; minutes: number }[];
  pomodoroTotal: { count: number; minutes: number };
  pomodoroToday: number;
  /** 番茄钟插件是否已开启「参与数据分析」 */
  pomodoroAnalysisEnabled: boolean;
  blackholeDaily: { date: string; minutes: number }[];
  blackholeByCategory: { category: string; minutes: number }[];
  blackholeTotal: number;
  blackholeToday: number;
  /** 时间黑洞插件是否已开启「参与数据分析」 */
  blackholeAnalysisEnabled: boolean;
  goalStats: {
    id: string;
    title: string;
    category: string;
    status: string;
    progress: number;
  }[];
  /** 已开启「参与数据分析」的插件数据（未开启的插件不会出现） */
  pluginStats?: {
    pluginKey: string;
    name: string;
    label: string;
    value: string;
    detail?: string;
  }[];
}

export async function getInsightsSummary(): Promise<InsightsSummary> {
  const response = await axiosForBackend({
    url: '/api/insights/summary',
    method: 'GET',
    timeout: 30000,
  });
  return response.data;
}
