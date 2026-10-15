import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { UserRole } from '@shared/api.interface';

const TOKEN_KEY = 'life_os_token';
const USER_KEY = 'life_os_user';

export interface AuthUserInfo {
  username: string;
  role: UserRole;
}

export function getLifeOsToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setLifeOsToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getLifeOsUser(): AuthUserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUserInfo) : null;
  } catch {
    return null;
  }
}

export function setLifeOsUser(user: AuthUserInfo | null): void {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

/** 退出登录：清 token 并跳转登录页 */
export function lifeOsLogoutLocal(): void {
  setLifeOsToken(null);
  setLifeOsUser(null);
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

// ===== 全局请求拦截器：自动携带 life_os_token；401 统一跳登录 =====
axiosForBackend.interceptors.request.use((config) => {
  const token = getLifeOsToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

axiosForBackend.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    // 认证接口自身的 401（密码错误等）由调用方处理，不跳转；
    // child-tv 是独立认证体系（child_tv_token），其 401 表示"请先登录儿童电视控制台"，
    // 由 child-tv 页面自己处理，绝不能清掉用户系统的登录态。
    if (
      status === 401 &&
      !url.startsWith('/api/auth/') &&
      !url.startsWith('/api/child-tv/')
    ) {
      lifeOsLogoutLocal();
    }
    return Promise.reject(error);
  },
);

// ===== 认证接口 =====

export async function authBootstrap(): Promise<{ initialized: boolean }> {
  const res = await axiosForBackend({ url: '/api/auth/bootstrap', method: 'GET' });
  return res.data as { initialized: boolean };
}

export async function authLogin(
  username: string,
  password: string,
): Promise<{ token: string; username: string; role: UserRole; expiresIn: number }> {
  const res = await axiosForBackend({
    url: '/api/auth/login',
    method: 'POST',
    data: { username, password },
  });
  const data = res.data as { token: string; username: string; role: UserRole; expiresIn: number };
  setLifeOsToken(data.token);
  setLifeOsUser({ username: data.username, role: data.role });
  return data;
}

export async function authRegister(
  username: string,
  password: string,
  inviteCode?: string,
): Promise<{ token: string; username: string; role: UserRole; expiresIn: number }> {
  const res = await axiosForBackend({
    url: '/api/auth/register',
    method: 'POST',
    data: inviteCode ? { username, password, inviteCode } : { username, password },
  });
  const data = res.data as { token: string; username: string; role: UserRole; expiresIn: number };
  setLifeOsToken(data.token);
  setLifeOsUser({ username: data.username, role: data.role });
  return data;
}

// ===== 邀请码管理（仅管理员） =====

export interface InviteCodeRecord {
  code: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedBy?: string;
  usedAt?: string;
  revoked?: boolean;
}

export async function inviteCreate(
  count?: number,
  days?: number,
): Promise<InviteCodeRecord[]> {
  const res = await axiosForBackend({
    url: '/api/auth/invite-codes',
    method: 'POST',
    data: { count, days },
  });
  return res.data as InviteCodeRecord[];
}

export async function inviteList(): Promise<InviteCodeRecord[]> {
  const res = await axiosForBackend({
    url: '/api/auth/invite-codes',
    method: 'GET',
  });
  return res.data as InviteCodeRecord[];
}

export async function inviteRevoke(code: string): Promise<{ success: boolean }> {
  const res = await axiosForBackend({
    url: `/api/auth/invite-codes/${encodeURIComponent(code)}`,
    method: 'DELETE',
  });
  return res.data as { success: boolean };
}

export async function authMe(): Promise<{
  loggedIn: boolean;
  userId?: string;
  username?: string;
  role?: UserRole;
}> {
  try {
    const token = getLifeOsToken();
    const res = await axiosForBackend({
      url: '/api/auth/me',
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data as {
      loggedIn: boolean;
      userId?: string;
      username?: string;
      role?: UserRole;
    };
  } catch {
    return { loggedIn: false };
  }
}
