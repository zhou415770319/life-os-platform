const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const outFile = path.join(__dirname, '..', 'user-data', 'git-status-out.txt');
const cwd = path.join(__dirname, '..');
try {
  const root = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  const st = execSync('git status --porcelain=v1', { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const lines = st.split('\n').filter(Boolean);
  fs.writeFileSync(outFile, 'ROOT=' + root + '\nTOTAL=' + lines.length + '\n' + lines.join('\n'), 'utf8');
} catch (e) {
  fs.writeFileSync(outFile, 'ERR=' + e.message, 'utf8');
}
