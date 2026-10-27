// 标题轮询冒烟（带重试）：播放 xm 合集 → 采样客户端窗口标题 + status.lastLog
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = 'http://127.0.0.1:3003/api/child-tv';
function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(BASE + p);
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({ raw: b, status: res.statusCode }); } }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
async function reqRetry(method, p, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { return await req(method, p, body); } catch (e) { if (i === tries - 1) throw e; await sleep(2500); }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function winTitle() {
  try {
    const out = execSync(`powershell -NoProfile -NonInteractive -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Process -Name '*ximalaya*' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1 -ExpandProperty MainWindowTitle"`, { encoding: 'utf8', timeout: 8000, windowsHide: true });
    return (out || '').trim();
  } catch { return '(read fail)'; }
}
(async () => {
  const out = [];
  const cols = await reqRetry('GET', '/collections');
  const col = cols.find((c) => c.name === '三十六计');
  await reqRetry('POST', '/stop');
  await sleep(500);
  const st = await reqRetry('POST', '/play', { collectionId: col.id });
  out.push('play: playing=' + st.playing + ' title=' + st.currentTitle);
  for (let i = 1; i <= 4; i++) {
    await sleep(5000);
    const s = await reqRetry('GET', '/status');
    const t = winTitle();
    out.push(`t=${i * 5}s winTitle=[${t}] playing=${s.playing} entry=${s.currentEntryTitle} lastLog=${s.lastLog}`);
  }
  await reqRetry('POST', '/stop');
  out.push('stopped');
  fs.writeFileSync('D:/zf-code/gitHub/life-os-platform/life-os-platform/xm-title-check.txt', out.join('\n'), 'utf8');
})().catch((e) => { fs.writeFileSync('D:/zf-code/gitHub/life-os-platform/life-os-platform/xm-title-check.txt', 'ERR: ' + (e.stack || e.message), 'utf8'); });
