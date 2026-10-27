const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

const secret = fs.readFileSync('user-data/auth-secret', 'utf8').trim();
const payload = JSON.stringify({
  u: 'u_mv94jflq5cup6w',
  r: 'admin',
  exp: Math.floor(Date.now() / 1000) + 3600,
});
const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
const token = `${payloadB64}.${sig}`;

const body = JSON.stringify({ notes: 'test-notes-from-cli' });
const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 3003,
    path: '/api/project-manager/projects/nonexistent-rec/notes',
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => console.log(`HTTP ${res.statusCode}: ${data}`));
  }
);
req.on('error', (e) => console.error('ERR:', e.message));
req.write(body);
req.end();
