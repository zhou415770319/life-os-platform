/* eslint-disable */
/**
 * Windows 本地一键启动（前后端并发）
 * 运行：npm run dev:local
 *
 * 后端 NestJS + 前端 Vite（/api 反代到后端）。
 * 端口统一在 .env 中配置：
 *   SERVER_PORT=3000   后端 API 端口
 *   CLIENT_PORT=5173   前端页面端口
 * 数据存储：本地 JSON 文件（user-data/*.json），后期可切换线上数据库。
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

process.chdir(path.resolve(__dirname, '..'));

const serverPort = process.env.SERVER_PORT || '3000';
const clientPort = process.env.CLIENT_PORT || '5173';

const commonEnv = {
  ...process.env,
  NODE_ENV: 'development',
  MIAODA_APP_TYPE: '3',
  MIAODA_LOCAL_DEV: '1',
  SERVER_PORT: serverPort,
};

const server = spawn('npx', ['nest', 'start', '--watch'], {
  env: commonEnv,
  shell: true,
  stdio: 'inherit',
});

const client = spawn('npx', ['vite', '--config', 'vite.config.ts', '--port', clientPort, '--strictPort'], {
  env: commonEnv,
  shell: true,
  stdio: 'inherit',
});

function shutdown(code) {
  server.kill('SIGTERM');
  client.kill('SIGTERM');
  process.exit(code ?? 0);
}

server.on('exit', (code) => {
  if (code && code !== 0 && code !== 1) shutdown(code);
});
client.on('exit', (code) => {
  if (code && code !== 0 && code !== 1) shutdown(code);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('========================================');
console.log('  Life-OS 本地开发模式已启动');
console.log(`  后端 API:  http://localhost:${serverPort}/api`);
console.log(`  前端页面:  http://localhost:${clientPort}/client/index.html`);
console.log(`  （端口可在 .env 中修改 SERVER_PORT / CLIENT_PORT）`);
console.log('========================================');
