/**
 * 本地模式登录守卫装饰器
 * 本地文件存储为单用户模式，直接放行；
 * 用户上下文由 LocalUserContextMiddleware 注入（默认 local-user，可用 X-User-Id 请求头覆盖）。
 */
export function NeedLogin(): ClassDecorator {
  return (target) => target;
}
