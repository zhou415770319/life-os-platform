import path from 'path';
import { loadEnv } from 'vite';
import { defineConfig } from '@lark-apaas/coding-preset-vite-react';

// 端口统一从 .env 读取：CLIENT_PORT=前端页面端口，SERVER_PORT=后端 API 端口
// （SERVER_PORT 同时作为 dev 反代目标，/api 请求会转发到该端口）
export default defineConfig(
  {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
      },
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
