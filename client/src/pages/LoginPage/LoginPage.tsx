import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Lock, User, ShieldCheck, Sparkles } from 'lucide-react';
import { authBootstrap, authLogin, authRegister } from '../../api/auth';
import { extractApiError } from '../../utils/api-error';

/**
 * 登录 / 注册页：
 * - 系统未初始化 → 显示注册（首个账号免邀请码，自动成为管理员）
 * - 已初始化 → 显示登录；也可切换到注册（需管理员邀请码）
 * 登录成功跳回原目标（?redirect=）。
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authBootstrap()
      .then((res) => {
        setInitialized(res.initialized);
        setMode(res.initialized ? 'login' : 'register');
      })
      .catch(() => setInitialized(true));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== password2) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await authLogin(username, password);
      } else {
        await authRegister(username, password, inviteCode.trim() || undefined);
      }
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(extractApiError(err, '操作失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1117] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Life-OS 人生系统</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {initialized === null
              ? '正在检查系统状态...'
              : mode === 'register'
                ? initialized
                  ? '凭邀请码注册新账号'
                  : '首次使用，注册管理员账号'
                : '登录你的账号'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  className="w-full rounded-lg border border-white/10 bg-[#1c2128] py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-zinc-300">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full rounded-lg border border-white/10 bg-[#1c2128] py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-white/10 bg-[#1c2128] py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  邀请码{initialized ? '（必填）' : '（首账号免填）'}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder={initialized ? '请输入管理员发放的邀请码' : '首个账号无需邀请码'}
                    autoComplete="off"
                    className="w-full rounded-lg border border-white/10 bg-[#1c2128] py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || initialized === null}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '处理中...' : mode === 'register' ? '注册并进入' : '登录'}
            </button>
          </form>

          {mode === 'register' ? (
            <div className="mt-4 space-y-1 text-center text-xs text-zinc-500">
              <p className="flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                {initialized
                  ? '新用户注册需管理员邀请码，注册后为普通用户'
                  : '首个注册账号自动成为管理员'}
              </p>
              {initialized && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  已有账号？直接登录
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-1 text-center text-xs text-zinc-500">
              <p>登录失败 5 次将锁定 15 分钟</p>
              {initialized && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  没有账号？凭邀请码注册
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
