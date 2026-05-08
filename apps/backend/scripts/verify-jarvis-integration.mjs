#!/usr/bin/env node
// Live verification — run AFTER:
//   1. PR #10 is deployed on Replit (npm run build + npm start)
//   2. JARVIS_SHARED_SECRET is set in Replit secrets
//
// Signs a metrics request the same way JARVIS will, hits production,
// asserts a 19-metric snapshot comes back. Bails with diagnostic on
// any failure.
//
// Usage:
//   JARVIS_SHARED_SECRET=<hex> node cleya_jarvis_live_verify.mjs
//   JARVIS_SHARED_SECRET=<hex> CLEYA_BASE=https://cleya.ai/api/jarvis node cleya_jarvis_live_verify.mjs

import crypto from 'node:crypto';

const SECRET = process.env.JARVIS_SHARED_SECRET;
const BASE   = process.env.CLEYA_BASE ?? 'https://cleya.ai/api/jarvis';

if (!SECRET) {
  console.error('Set JARVIS_SHARED_SECRET first (the same hex you put in Replit + the JARVIS Supabase api_key column).');
  process.exit(2);
}

function sign({ method, path, body }) {
  const ts = Date.now();
  const raw = method === 'GET' ? '' : (body ? JSON.stringify(body) : '');
  const payload = `${ts}.${method}.${path}.${raw}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return { 'x-jarvis-timestamp': String(ts), 'x-jarvis-signature': sig, 'content-type': 'application/json' };
}

async function probe(label, fn) {
  process.stdout.write(`  ${label} ... `);
  try {
    const r = await fn();
    console.log('✓');
    return r;
  } catch (e) {
    console.log('✗ ' + e.message);
    process.exit(1);
  }
}

console.log(`\n→ Verifying ${BASE}\n`);

// 1. /health
await probe('GET /health (signed)', async () => {
  const headers = sign({ method: 'GET', path: '/health' });
  const res = await fetch(`${BASE}/health`, { headers });
  if (res.status !== 200) throw new Error(`status ${res.status}: ${await res.text()}`);
  const j = await res.json();
  if (!j.ok || j.service !== 'cleya') throw new Error('bad shape: ' + JSON.stringify(j));
});

// 2. /metrics — main contract
const metrics = await probe('GET /metrics (signed)', async () => {
  const headers = sign({ method: 'GET', path: '/metrics' });
  const res = await fetch(`${BASE}/metrics`, { headers });
  if (res.status !== 200) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j.ok || !Array.isArray(j.metrics)) throw new Error('not an OK metrics envelope');
  if (j.metrics.length < 15) throw new Error(`only ${j.metrics.length} metrics — expected 15+`);
  const required = ['mrr_inr', 'users_total', 'signups_24h', 'matches_proposed_30d'];
  for (const name of required) {
    if (!j.metrics.find((m) => m.name === name)) throw new Error(`missing metric: ${name}`);
  }
  return j;
});

// 3. /metrics without signature → 401
await probe('GET /metrics (no signature) → 401', async () => {
  const res = await fetch(`${BASE}/metrics`);
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
});

// 4. /metrics with stale ts → 401
await probe('GET /metrics (10-min-old ts) → 401', async () => {
  const ts = Date.now() - 10 * 60 * 1000;
  const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.GET./metrics.`).digest('hex');
  const res = await fetch(`${BASE}/metrics`, {
    headers: { 'x-jarvis-timestamp': String(ts), 'x-jarvis-signature': sig },
  });
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
});

// 5. unknown action → 400 (NOT 401 — auth passes, action handler rejects)
await probe('POST /actions/__unknown__ → 400', async () => {
  const body = { params: {} };
  const headers = sign({ method: 'POST', path: '/actions/__unknown__', body });
  const res = await fetch(`${BASE}/actions/__unknown__`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}: ${(await res.text()).slice(0, 200)}`);
});

console.log(`\n✓ All probes passed. ${metrics.metrics.length} metrics surfaced.\n`);
console.log('  Sample of returned metrics:');
for (const m of metrics.metrics.slice(0, 5)) {
  console.log(`    ${m.name.padEnd(28)} ${String(m.value).padStart(10)} ${m.unit ?? ''}`);
}
console.log(`    ... (+${metrics.metrics.length - 5} more)`);
console.log('\nNext: on the JARVIS Supabase, flip status to connected:');
console.log(`  update app_connections set status='connected' where slug='cleya';`);
console.log('And enable the cron task:');
console.log(`  update scheduled_tasks set enabled=true where name='Multi-app metrics fetch';`);
