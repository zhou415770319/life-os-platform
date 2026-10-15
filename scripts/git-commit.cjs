const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const outFile = path.join(__dirname, '..', 'user-data', 'git-commit2-out.txt');
const cwd = path.join(__dirname, '..');
const run = (cmd) => {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    return 'ERR: ' + e.message + '\n' + (e.stdout || '') + (e.stderr || '');
  }
};
let out = '';
out += run('git add -A') + '\n';
const msg = 'fix(plugins): 恢复内置插件启用状态 + 导航栏已装载插件默认折叠\n\n' +
  '- 恢复 7 个内置插件启用（儿童资料站/RPA智能创作/财务记账/健康管理/阅读实验室/复盘面板/儿童定时播放），' +
  'GTD 任务管理、番茄钟记录按此前要求保持不默认加载\n' +
  '- 插件启用状态为全局共享（life-plugin-config 不按用户隔离），admin 与新账号看到一致的已启用插件\n' +
  '- 侧边栏「已装载插件」区块支持折叠/展开，默认折叠（显示标题+数量徽标）\n' +
  '- 修复开发服务双实例争抢 3003 端口问题（清理重复 dev:local 进程）';
out += run('git commit -m ' + JSON.stringify(msg)) + '\n';
out += run('git log --oneline -3') + '\n';
fs.writeFileSync(outFile, out, 'utf8');
