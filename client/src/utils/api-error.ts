/**
 * 统一 API 错误信息提取。
 *
 * 后端全局异常过滤器返回形如：
 *   { error: { code, message, details } }
 * NestJS 默认/自定义异常返回：
 *   { message: '...' } 或 { message: ['...'] }（校验类为数组）
 * axios/网络错误：err.message 为英文描述（网络不通、超时等）。
 *
 * 使用：catch (err) { toast.error(extractApiError(err, '操作失败')); }
 */
export function extractApiError(err: unknown, fallback = '操作失败，请重试'): string {
  if (!err) return fallback;
  const e = err as {
    response?: { data?: unknown };
    message?: unknown;
  };
  const data = e?.response?.data as
    | { error?: { message?: unknown }; message?: unknown }
    | undefined;

  // 1) 本项目统一异常过滤器：{ error: { message } }
  const nested = data?.error?.message;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();

  // 2) Nest 标准 { message: string }
  const msg = data?.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();

  // 3) Nest 校验错误 { message: string[] }
  if (Array.isArray(msg)) {
    const joined = msg
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      .join('；');
    if (joined) return joined;
  }

  // 4) 无响应体的异常（网络错误、超时等）
  if (typeof e?.message === 'string' && e.message.trim()) return e.message.trim();

  return fallback;
}
