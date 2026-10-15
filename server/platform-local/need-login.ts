/**
 * 登录守卫装饰器（兼容保留）。
 * 真实鉴权已由全局 AuthGuard（server/modules/auth/auth.guard.ts）接管：
 * 除公开白名单外，所有 /api 请求需 Bearer token（HMAC 校验 + 过期 + 角色分级）。
 * 本装饰器不再承载拦截逻辑，controller 上的 @NeedLogin() 标注仅为可读性保留。
 */
export function NeedLogin(): ClassDecorator {
  return (target) => target;
}
