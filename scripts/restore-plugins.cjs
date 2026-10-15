const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'user-data', 'life-plugin-config.json');
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const toEnable = [
  'dsh-plugin-child-resources',
  'dsh-plugin-wechat-rpa',
  'dsh-plugin-finance-ledger',
  'dsh-plugin-health-fit',
  'dsh-plugin-reading-lab',
  'dsh-plugin-review-board',
  'dsh-plugin-child-tv',
];
let changed = 0;
for (const r of rows) {
  if (toEnable.includes(r.pluginKey) && !r.enabled) {
    r.enabled = true;
    r.lifecycleStatus = 'active';
    r.updatedAt = new Date().toISOString();
    r._updated_at = r.updatedAt;
    changed++;
  }
}
fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
console.log('enabled restored:', changed);
