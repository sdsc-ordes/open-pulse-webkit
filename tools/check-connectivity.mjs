#!/usr/bin/env node
/* pulseWebKit connectivity check.
 *
 * Reads the repo-root .env and live-checks every Open Pulse endpoint with
 * the credentials in it — Neo4j, SPARQL (Oxigraph), OpenSearch, the CHAOSS
 * metrics API, and the Open Pulse hub. Run it after filling in .env, so bad
 * credentials or unreachable stores surface now rather than as empty charts
 * later:
 *
 *   npm run check-connectivity      (repo root)
 *   node tools/check-connectivity.mjs
 *
 * It only reads — it never writes .env or any app file, and nothing ships to
 * the browser. A ✖ is diagnostic, not fatal: fix the value in .env and
 * re-run. Services whose keys are still placeholders are skipped.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------- terminal helpers ---------------- */

const useColor = !!process.stdout.isTTY;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const red = paint('31');
const yellow = paint('33');

const rel = (p) => p.slice(ROOT.length + 1);

function ok(name, detail) {
  console.log(`  ${green('✔')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

function fail(name, detail) {
  console.log(`  ${red('✖')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

function note(msg) {
  console.log(`  ${yellow('•')} ${msg}`);
}

/* ---------------- .env parsing ---------------- */

function parseEnv(text) {
  const map = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return map;
}

const isPlaceholder = (v) => !v || /xxxx|replace.?me/i.test(v);

/* ---------------- service checks ---------------- */

function basicAuth(pair) {
  const i = pair.indexOf('/');
  const user = i === -1 ? pair : pair.slice(0, i);
  const pass = i === -1 ? '' : pair.slice(i + 1);
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

const fmtCount = (n) => Number(n).toLocaleString('en-US').replace(/,/g, ' ');

const results = { ok: 0, failed: 0, skipped: 0 };

async function checkService(name, envKeys, env, fn) {
  const missing = envKeys.find((k) => isPlaceholder(env[k]));
  if (missing) {
    note(`${name} — skipped (${missing} not filled in).`);
    results.skipped++;
    return;
  }
  try {
    const detail = await fn();
    ok(name, detail);
    results.ok++;
  } catch (e) {
    fail(name, e?.message ?? String(e));
    results.failed++;
  }
}

async function run() {
  console.log(`
${bold('pulseWebKit connectivity check')}
${dim('─'.repeat(64))}
Live-checks every Open Pulse endpoint with the credentials in your .env.`);

  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.log();
    note('No .env at the repo root. Copy .env.example → .env and fill it in,');
    note('then re-run this check.');
    process.exit(0);
  }

  const env = parseEnv(await readFile(envPath, 'utf8'));
  const timeout = () => AbortSignal.timeout(10_000);
  console.log(`\n  Using ${bold(rel(envPath))}\n`);

  await checkService('Neo4j', ['NEO4J_HTTP_ENDPOINT', 'NEO4J_AUTH'], env, async () => {
    const ep = env.NEO4J_HTTP_ENDPOINT.replace(/\/$/, '');
    const res = await fetch(`${ep}/db/neo4j/tx/commit`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(env.NEO4J_AUTH),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ statements: [{ statement: 'MATCH (n) RETURN count(n) AS n' }] }),
      signal: timeout(),
    });
    const body = await res.json();
    if (body.errors?.length) throw new Error(body.errors[0].message ?? body.errors[0].code);
    return `${fmtCount(body.results[0].data[0].row[0])} nodes`;
  });

  await checkService('SPARQL (Oxigraph)', ['SPARQL_ENDPOINT'], env, async () => {
    const ep = env.SPARQL_ENDPOINT.replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/sparql-query', Accept: 'application/sparql-results+json' };
    if (!isPlaceholder(env.SPARQL_AUTH)) headers.Authorization = basicAuth(env.SPARQL_AUTH);
    const res = await fetch(`${ep}/query`, {
      method: 'POST',
      headers,
      body: 'ASK { ?s ?p ?o }',
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return body.boolean ? 'reachable, graph has triples' : 'reachable (empty default graph)';
  });

  await checkService(
    'OpenSearch',
    ['OPENSEARCH_ENDPOINT', 'OPENSEARCH_USERNAME', 'OPENSEARCH_PASSWORD'],
    env,
    async () => {
      const ep = env.OPENSEARCH_ENDPOINT.replace(/\/$/, '');
      const auth = `Basic ${Buffer.from(`${env.OPENSEARCH_USERNAME}:${env.OPENSEARCH_PASSWORD}`).toString('base64')}`;
      const proxy = ['1', 'true', 'yes'].includes((env.OPENSEARCH_DASHBOARDS_PROXY ?? '').toLowerCase());
      if (ep.startsWith('https:')) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // self-signed cluster cert
      const res = proxy
        ? await fetch(`${ep}/api/console/proxy?path=%2F&method=GET`, {
            method: 'POST',
            headers: { Authorization: auth, 'osd-xsrf': 'true' },
            signal: timeout(),
          })
        : await fetch(`${ep}/`, { headers: { Authorization: auth }, signal: timeout() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json().catch(() => ({}));
      const version = body?.version?.number;
      return version ? `v${version}${proxy ? ' (via Dashboards proxy)' : ''}` : 'reachable';
    },
  );

  await checkService('CHAOSS metrics API', ['CHAOSS_ENDPOINT', 'CHAOSS_AUTH'], env, async () => {
    const ep = env.CHAOSS_ENDPOINT.replace(/\/$/, '');
    const res = await fetch(`${ep}/api/v1/metrics/chaoss`, {
      headers: { Authorization: basicAuth(env.CHAOSS_AUTH), Accept: 'application/json' },
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'reachable';
  });

  await checkService('Open Pulse hub', ['OPENPULSE_ENDPOINT', 'OPENPULSE_AUTH'], env, async () => {
    const ep = env.OPENPULSE_ENDPOINT.replace(/\/$/, '');
    const res = await fetch(`${ep}/api/stats/`, {
      headers: { Authorization: basicAuth(env.OPENPULSE_AUTH), Accept: 'application/json' },
      signal: timeout(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'reachable';
  });

  console.log(
    `\n  ${bold('Result')} — ${green(`${results.ok} ok`)}, ${results.failed ? red(`${results.failed} failed`) : `${results.failed} failed`}, ${dim(`${results.skipped} skipped`)}.`,
  );
  console.log(dim('  A ✖ is diagnostic, not fatal — fix the value in .env and re-run.'));
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node tools/check-connectivity.mjs\nLive-checks the Open Pulse endpoints in .env — see the header comment.');
  process.exit(0);
}

await run();
