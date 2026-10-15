import path from 'path';
import { loadEnv } from 'vite';
import { defineConfig as presetDefineConfig } from '@lark-apaas/coding-preset-vite-react';

// 端口统一从 .env 读取：CLIENT_PORT=前端页面端口，SERVER_PORT=后端 API 端口
// （SERVER_PORT 同时作为 dev 反代目标，/api 请求会转发到该端口）
const CLIENT_HOST = loadEnv('development', process.cwd(), '').CLIENT_HOST || 'localhost';
const CLIENT_PORT = Number(loadEnv('development', process.cwd(), '').CLIENT_PORT || 5173);
const SERVER_PORT = Number(loadEnv('development', process.cwd(), '').SERVER_PORT || 3000);

const baseConfig = presetDefineConfig(
  {
    // index.html 位于 client/ 目录：显式指定 root，使根路径与 SPA 路由可正常访问
    root: path.resolve(__dirname, 'client'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
      },
      // 强制 React 单副本：MiaoDa 壳（@lark-apaas/client-toolkit）内置了一份 React，
      // 依赖重优化后若我们的 import 'react' 解析到另一份，会出现
      // 「Invalid hook call」「removeChild NotFoundError」等双 React 崩溃。
      dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
    server: {
      // host 从 .env 读取：CLIENT_HOST=127.0.0.1 时内网穿透工具可直接配置 127.0.0.1:CLIENT_PORT
      // （默认 localhost；如需局域网访问可设为 0.0.0.0）
      host: CLIENT_HOST,
      port: CLIENT_PORT,
      strictPort: true,
    },
  },
  {
    serverPort: SERVER_PORT,
  },
);

// 过滤 preset 注入的平台监控插件（slardar / performance.iife / Tea 上报 mon.zijieapi.com）：
// 本项目是本地独立运行的应用，不需要平台遥测；且经内网穿透 http:// 域名访问时
// 跨域上报会被 CORS 拦截并产生 502 噪音（本地 localhost 下也会持续打点）。
// 只移除这一个插件，preset 的其余行为（路由/代理/构建产物）保持原样。
export default {
  ...baseConfig,
  plugins: (baseConfig.plugins ?? []).filter(
    (p) =>
      !(
        p &&
        typeof p === 'object' &&
        (p as { name?: string }).name === 'miaoda-slardar'
      ),
  ),
};
