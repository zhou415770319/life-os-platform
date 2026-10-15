import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authMe, getLifeOsToken } from '../api/auth';

/**
 * 路由守卫：全站强制登录。
 * - 本地无 token → 跳 /login?redirect=当前路径
 * - 有 token → 调 /api/auth/me 校验有效性（异步 loading），无效则清 token 跳登录
 * - 瞬时失败（429 限流 / 网络抖动）自动重试，避免把在线用户误踢到登录页
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async (attempt: number) => {
      if (!getLifeOsToken()) {
        setOk(false);
        setChecking(false);
        return;
      }
      try {
        const me = await authMe();
        if (cancelled) return;
        if (me.loggedIn) {
          setOk(true);
          setChecking(false);
          return;
        }
        // 带 token 但校验失败：可能是瞬时限流/网络问题，最多重试 2 次
        if (attempt < 3) {
          timer = setTimeout(() => check(attempt + 1), 1200 * attempt);
          return;
        }
        setOk(false);
        setChecking(false);
      } catch {
        if (cancelled) return;
        if (attempt < 3) {
          timer = setTimeout(() => check(attempt + 1), 1200 * attempt);
          return;
        }
        setOk(false);
        setChecking(false);
      }
    };
    check(1);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [location.pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1117]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <span className="text-sm text-zinc-400">正在验证登录...</span>
        </div>
      </div>
    );
  }

  if (!ok) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
