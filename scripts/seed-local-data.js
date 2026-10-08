/* eslint-disable */
/**
 * 本地数据初始化脚本（原则库 / 微习惯示例）
 * 运行：node scripts/seed-local-data.js
 * 数据写入 user-data/*.json（LocalDatabase 文件存储）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data');
fs.mkdirSync(dataDir, { recursive: true });

const now = new Date().toISOString();
const uid = () => crypto.randomUUID();
const base = { createdAt: now, updatedAt: now, createdBy: 'local-user', updatedBy: 'local-user' };

function readJson(file) {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(file, rows) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(rows, null, 2), 'utf-8');
}

// ==================== 原则库 ====================
const PRINCIPLES = [
  { title: '早睡早起', content: '23:30 前入睡，7:00 前起床，保证 7 小时以上睡眠。睡得好，效率才高。', category: '健康' },
  { title: '每天运动 30 分钟', content: '无论多忙，每天至少活动身体 30 分钟：散步、跑步、拉伸都可以。身体是 1，其他都是后面的 0。', category: '健康' },
  { title: '每天阅读 30 分钟', content: '持续输入优质信息，保持认知升级。读书是性价比最高的自我投资。', category: '成长' },
  { title: '每日复盘', content: '每晚花 5 分钟回顾今天：做对了什么、哪里可以更好、明天最重要的三件事。', category: '成长' },
  { title: '先完成再完美', content: '先做出来，再慢慢优化。拖延的根源往往是对完美的过度追求。', category: '效率' },
  { title: '要事优先', content: '每天先做最重要的事（MIT），不要用琐事填满一天。', category: '效率' },
  { title: '先储蓄后消费', content: '每月收入到账先存 20%，再规划消费。存钱是自由的基石。', category: '财富' },
  { title: '消费前三问', content: '我真的需要吗？我多久用一次？有没有更便宜的替代？三问之后还想买，再买。', category: '财富' },
  { title: '先倾听后表达', content: '沟通时先听完对方，不打断、不预判，再表达自己的观点。', category: '人际' },
  { title: '不抱怨，找方案', content: '遇到问题先想解决办法，不抱怨、不指责。把精力花在能改变的事情上。', category: '心态' },
  { title: '及时回复', content: '信息不过夜：当天能回的当天回，回不了的要说明情况。靠谱是积累信任的方式。', category: '人际' },
  { title: '聚焦当下', content: '吃饭时吃饭，工作时工作。一次只做一件事，专注本身就是效率。', category: '心态' },
  { title: '随手记录', content: '灵感、想法、待办，随时记下来，不要依赖记忆。', category: '效率' },
  { title: '定期断舍离', content: '每周清理一次：无用的文件、物品、群聊、订阅。空间和注意力都需要留白。', category: '生活' },
  { title: '投资自己优先', content: '把钱和精力优先花在提升能力、健康、见识上，这是回报率最高的投资。', category: '财富' },
];

function seedPrinciples() {
  const file = 'life-principles.json';
  const rows = readJson(file);
  const existing = new Set(rows.map((r) => r.title));
  let added = 0;
  for (const p of PRINCIPLES) {
    if (existing.has(p.title)) continue;
    rows.push({ id: uid(), title: p.title, content: p.content, category: p.category, ...base });
    added++;
  }
  writeJson(file, rows);
  console.log(`[seed] life-principles.json: +${added} 条（共 ${rows.length} 条）`);
}

// ==================== 微习惯示例 ====================
const HABITS = [
  { name: '早起喝一杯水', icon: '💧', color: '#38bdf8', frequency: 'daily' },
  { name: '阅读 30 分钟', icon: '📖', color: '#a78bfa', frequency: 'daily' },
  { name: '运动 30 分钟', icon: '🏃', color: '#34d399', frequency: 'weekly' },
  { name: '睡前复盘', icon: '📝', color: '#fbbf24', frequency: 'daily' },
  { name: '给家人打电话', icon: '📞', color: '#fb7185', frequency: 'weekly' },
];

function seedHabits() {
  const file = 'life-habits.json';
  const rows = readJson(file);
  const existing = new Set(rows.map((r) => r.name));
  let added = 0;
  for (const h of HABITS) {
    if (existing.has(h.name)) continue;
    rows.push({ id: uid(), name: h.name, icon: h.icon, color: h.color, frequency: h.frequency, streakCount: 0, ...base });
    added++;
  }
  writeJson(file, rows);
  console.log(`[seed] life-habits.json: +${added} 条（共 ${rows.length} 条）`);
}

seedPrinciples();
seedHabits();
console.log('[seed] 完成');
