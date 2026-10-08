import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export type ReviewType = 'daily' | 'weekly';

export interface ReviewSettings {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  weeklyReminderEnabled: boolean;
  weeklyReminderDay: number;
  weeklyReminderTime: string;
  autoGenerateEnabled: boolean;
}

export interface ReviewRecord {
  id: string;
  date: string;
  type: ReviewType;
  title: string;
  summary: string;
  source: 'ai' | 'template';
  stats: {
    habitCompleted: number;
    habitTotal: number;
    focusMinutes: number;
    focusCount: number;
    wastedMinutes: number;
    wastedCategories: { category: string; minutes: number }[];
    notesAdded: number;
    logEvents: number;
    goals: { title: string; progress: number }[];
  };
  createdAt: string;
}

export interface ReviewToday {
  date: string;
  hasRecord: boolean;
  shouldRemind: boolean;
  record: ReviewRecord | null;
  settings: ReviewSettings;
}

export async function getReviewToday(): Promise<ReviewToday> {
  const response = await axiosForBackend({ url: '/api/review/today', method: 'GET', timeout: 30000 });
  return response.data;
}

export async function generateReview(type: ReviewType, date?: string): Promise<ReviewRecord> {
  const response = await axiosForBackend({
    url: '/api/review/generate',
    method: 'POST',
    data: { type, date },
    timeout: 60000,
  });
  return response.data;
}

export async function listReviews(): Promise<{ items: ReviewRecord[]; total: number }> {
  const response = await axiosForBackend({ url: '/api/review/list', method: 'GET', timeout: 30000 });
  return response.data;
}

export async function getReviewSettings(): Promise<ReviewSettings> {
  const response = await axiosForBackend({ url: '/api/review/settings', method: 'GET', timeout: 30000 });
  return response.data;
}

export async function saveReviewSettings(
  patch: Partial<ReviewSettings>,
): Promise<ReviewSettings> {
  const response = await axiosForBackend({
    url: '/api/review/settings',
    method: 'POST',
    data: patch,
    timeout: 30000,
  });
  return response.data;
}
