import path from 'path';
import { loadEnv } from 'vite';
import { defineConfig } from '@lark-apaas/coding-preset-vite-react';

// 端口统一从 .env 读取：CLIENT_PORT=前端页面端口，SERVER_PORT=后端 API 端口
// （SERVER_PORT 同时作为 dev 反代目标，/api 请求会转发到该端口）
export default defineConfig(
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
      port: Number(loadEnv('development', process.cwd(), '').CLIENT_PORT || 5173),
      strictPort: true,
    },
  },
  {
    serverPort: Number(loadEnv('development', process.cwd(), '').SERVER_PORT || 3000),
  },
);
