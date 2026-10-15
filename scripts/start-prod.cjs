/**
 * Windows 一键生产启动：构建前后端 → 启动生产服务（dist/server/main.js）
 * 用法：npm run start:prod
 *
 * 生产服务默认监听 localhost:3003；内网穿透访问 127.0.0.1:3003 时，
 * 请在 .env 取消注释 SERVER_HOST=127.0.0.1。
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

function run(cmd, opts) {
  console.log(`\n>>> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

try {
  run('npm run build:prod');
  console.log('\n>>> 构建完成，启动生产服务（Ctrl+C 停止）');
  run('node dist/server/main.js');
} catch (err) {
  console.error('\n启动失败：', err.message);
  process.exit(1);
}
