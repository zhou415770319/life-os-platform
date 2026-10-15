const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const outFile = path.join(__dirname, '..', 'user-data', 'git-commit-out.txt');
const cwd = path.join(__dirname, '..');
const run = (cmd) => {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    return 'ERR: ' + e.message + '\n' + (e.stdout || '') + (e.stderr || '');
  }
};
let out = '';
out += '--- add ---\n' + run('git add -A') + '\n';
out += '--- status after add ---\n' + run('git status --porcelain=v1') + '\n';
const msg = 'feat(auth): 邀请码注册 + 业务数据按用户隔离 + 存量迁移归 admin\n\n' +
  '- 邀请码注册机制：首用户免码自动管理员，其余用户凭管理员邀请码注册（生成/列表/作废 API + 前端管理 UI）\n' +
  '- 业务数据按用户隔离：16 张业务表查询/更新/删除按 createdBy 过滤，JsonStore 内置模块按 userId 过滤\n' +
  '- 存量数据迁移：user-data 下 createdBy=true/local-user 及无 userId 记录统一归 admin\n' +
  '- CORS 白名单追加公网域名 life.feiyumdm.cn（.env 本地已改）\n' +
  '- url-resolver 公共链接解析（抖音/抖音精选/bilibili/喜马拉雅/其他）\n' +
  '- 新增 scripts/start-prod.cjs、verify-migration.cjs、cleanup-test-data.cjs';
out += '--- commit ---\n' + run('git commit -m ' + JSON.stringify(msg)) + '\n';
out += '--- log ---\n' + run('git log --oneline -3') + '\n';
fs.writeFileSync(outFile, out, 'utf8');
