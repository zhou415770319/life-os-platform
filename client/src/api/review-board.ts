import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export type BoardLevel = 'daily' | 'weekly' | 'monthly';

export interface ReviewBoardItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string;
  createdAt: string;
}

export interface BoardSection {
  key: string;
  title: string;
  content: string;
  items: ReviewBoardItem[];
  archivedAt: string;
}

export interface ReviewBoardPanel {
  id: string;
  level: BoardLevel;
  key: string;
  title: string;
  content: string;
  sections: BoardSection[];
  items: ReviewBoardItem[];
  archivedAt?: string;
  updatedAt: string;
  createdAt: string;
}

export interface BoardView {
  panel: ReviewBoardPanel;
  pending: {
    key: string;
    title: string;
    content: string;
    items: ReviewBoardItem[];
  }[];
  rangeLabel: string;
  doneCount: number;
  totalCount: number;
}

export interface ReviewBoardShare {
  id: string;
  token: string;
  mode: 'view' | 'edit';
  level: BoardLevel;
  key: string;
  createdAt: string;
  visits: number;
}

export interface ReviewBoardPublish {
  id: string;
  fileName: string;
  level: BoardLevel;
  key: string;
  mode: 'view' | 'edit';
  shareUrl?: string;
  createdAt: string;
}

export const reviewBoardApi = {
  async getView(level: BoardLevel, key: string): Promise<BoardView> {
    const response = await axiosForBackend({ url: '/api/review-board/view', method: 'GET', params: { level, key } });
    return response.data;
  },
  async savePanel(level: BoardLevel, key: string, content: string): Promise<ReviewBoardPanel> {
    const response = await axiosForBackend({ url: '/api/review-board/panel', method: 'POST', data: { level, key, content } });
    return response.data;
  },
  async toggleItem(
    level: BoardLevel,
    key: string,
    itemId: string,
    done: boolean,
  ): Promise<ReviewBoardPanel> {
    const response = await axiosForBackend({ url: '/api/review-board/toggle', method: 'POST', data: { level, key, itemId, done } });
    return response.data;
  },
  async archive(level: BoardLevel, key: string): Promise<{ done: boolean; message: string }> {
    const response = await axiosForBackend({ url: '/api/review-board/archive', method: 'POST', data: { level, key } });
    return response.data;
  },
  async autoArchive(): Promise<{ archivedDays: string[]; archivedWeeks: string[] }> {
    const response = await axiosForBackend({ url: '/api/review-board/archive/auto', method: 'POST' });
    return response.data;
  },
  async createShare(
    level: BoardLevel,
    key: string,
    mode: 'view' | 'edit',
  ): Promise<ReviewBoardShare> {
    const response = await axiosForBackend({ url: '/api/review-board/shares', method: 'POST', data: { level, key, mode } });
    return response.data;
  },
  async getShares(): Promise<ReviewBoardShare[]> {
    const response = await axiosForBackend({ url: '/api/review-board/shares', method: 'GET' });
    return response.data;
  },
  async deleteShare(id: string): Promise<void> {
    const response = await axiosForBackend({ url: `/api/review-board/shares/${id}`, method: 'DELETE' });
    return response.data;
  },
  async exportPublish(
    level: BoardLevel,
    key: string,
    mode: 'view' | 'edit',
  ): Promise<ReviewBoardPublish> {
    const response = await axiosForBackend({ url: '/api/review-board/publish', method: 'POST', data: { level, key, mode } });
    return response.data;
  },
  async getPublishes(): Promise<ReviewBoardPublish[]> {
    const response = await axiosForBackend({ url: '/api/review-board/publishes', method: 'GET' });
    return response.data;
  },
  async deletePublishes(ids: string[]): Promise<{ deleted: number }> {
    const response = await axiosForBackend({ url: '/api/review-board/publishes', method: 'DELETE', data: { ids } });
    return response.data;
  },
  async setShareUrl(id: string, shareUrl: string): Promise<void> {
    const response = await axiosForBackend({ url: `/api/review-board/publishes/${id}/share-url`, method: 'POST', data: { shareUrl } });
    return response.data;
  },
};
