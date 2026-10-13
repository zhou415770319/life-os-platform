/**
 * 非安全上下文兼容补丁（必须在入口最先加载）
 *
 * 背景：通过内网穿透以 `http://域名:端口` 访问页面时，浏览器判定该页面属于
 * 非安全上下文（insecure context）。`crypto.randomUUID` 是规范规定的
 * [SecureContext] API，在非安全上下文下浏览器根本不提供该方法。
 * client-toolkit 的 axios 请求拦截器第一行就调用 `crypto.randomUUID()`，
 * 导致请求在发出前即抛 TypeError（该异常无 .config 字段），外层拦截器读取
 * `err.config.meta` 再次抛错 —— 最终表现为所有 /api 请求全部失败、
 * 控制台刷屏 `Cannot read properties of undefined (reading 'meta')`。
 *
 * 修复：用 `crypto.getRandomValues`（非安全上下文同样可用，且同样是
 * 密码学安全随机源）实现 UUID v4 兜底，保证任何环境下该方法都存在。
 */
(function installPolyfills() {
  const g = globalThis as unknown as {
    crypto?: { randomUUID?: () => string; getRandomValues?: (arr: Uint8Array) => Uint8Array };
  };

  // 极端兜底：连 crypto 都没有的环境（罕见 webview），先补一个空对象
  if (!g.crypto) {
    (g as { crypto: unknown }).crypto = {};
  }

  if (typeof g.crypto!.randomUUID !== 'function') {
    g.crypto!.randomUUID = function randomUUID(): string {
      const bytes = new Uint8Array(16);
      if (typeof g.crypto!.getRandomValues === 'function') {
        g.crypto!.getRandomValues(bytes);
      } else {
        // 最后兜底：Math.random 填充（熵较低但保证可运行，仅覆盖极端环境）
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
  }
})();
