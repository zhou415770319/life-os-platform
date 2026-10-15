const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'user-data');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
let bad = 0;
for (const f of files) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  } catch (e) {
    console.log('PARSE_FAIL', f);
    bad++;
    continue;
  }
  const arr = Array.isArray(raw) ? raw : raw.records || raw.items || raw.data || [];
  if (f === 'life-plugin-config.json') continue; // 共享表，不隔离，不迁移
  if (!Array.isArray(arr) || arr.length === 0) continue;
  for (const r of arr) {
    if (r && (r.createdBy === true || r.createdBy === 'local-user' || r.userId === 'local-user')) {
      bad++;
    }
  }
}
console.log('bad=' + bad);
