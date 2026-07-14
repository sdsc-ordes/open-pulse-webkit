#!/usr/bin/env node
/* pulseWebKit setup wizard.
 *
 * Interactive, fork-time configuration for a dashboard built on the Open
 * Pulse platform. Run it once after forking the template (again is fine —
 * it never silently overwrites):
 *
 *   npm run setup            (repo root)
 *   node tools/setup.mjs
 *
 * What it does, step by step:
 *   1. Project identity — name, header wordmark, default theme.
 *   2. Environment      — writes repo-root .env from .env.example.
 *   3. Connectivity     — live-checks Neo4j / SPARQL / OpenSearch / CHAOSS /
 *                         hub endpoints with the credentials just entered.
 *   4. Pages            — scaffolds dashboard pages from the layout
 *                         archetypes (card grid, list/detail, trends, graph
 *                         explorer): <slug>.html + src/pages/<slug>.ts +
 *                         sample src/data/<slug>.json, and registers the
 *                         page in shell.ts (nav + PageId) and vite.config.ts.
 *
 * Everything it writes is plain files — no runtime, nothing ships to the
 * browser. Templates live in tools/setup-templates/.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TPL_DIR = join(ROOT, 'tools', 'setup-templates');

/* ---------------- terminal helpers ---------------- */

const useColor = !!process.stdout.isTTY;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const red = paint('31');
const yellow = paint('33');

const written = [];
const warnings = [];
const rel = (p) => p.slice(ROOT.length + 1);

/* Input handling. rl.question drops lines that arrive while no question is
 * pending (piped stdin buffers everything up front, and any await between
 * prompts loses the queued answers) — so keep our own line queue instead. */
let rlClosed = false;
const queuedLines = [];
const lineWaiters = [];
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (l) => {
  const w = lineWaiters.shift();
  if (w) w(l);
  else queuedLines.push(l);
});
rl.on('close', () => {
  rlClosed = true;
  while (lineWaiters.length) lineWaiters.shift()(undefined);
});

function nextLine() {
  if (queuedLines.length) return Promise.resolve(queuedLines.shift());
  if (rlClosed) return Promise.resolve(undefined);
  return new Promise((resolve) => lineWaiters.push(resolve));
}

/** Prompt for a line. Empty input (or exhausted piped stdin) returns `def`.
 * When `displayDef` is given it is shown instead of the real default (used
 * to mask secrets) — typing it back verbatim also keeps the real default. */
async function ask(question, def = '', displayDef) {
  const shown = displayDef ?? def;
  const prompt = `  ${question}${shown ? ` ${dim(`(${shown})`)}` : ''}: `;
  process.stdout.write(prompt);
  const answer = await nextLine();
  // Piped stdin doesn't echo — show what was used so transcripts read sanely.
  if (!process.stdin.isTTY) process.stdout.write(`${answer ?? ''}\n`);
  if (answer === undefined) return def;
  const trimmed = answer.trim();
  if (!trimmed) return def;
  if (displayDef !== undefined && trimmed === displayDef) return def;
  return trimmed;
}

async function askYesNo(question, def = false) {
  const a = (await ask(`${question} ${def ? '[Y/n]' : '[y/N]'}`)).toLowerCase();
  if (!a) return def;
  return a.startsWith('y');
}

function head(step, title) {
  console.log(`\n${bold(`── ${step} · ${title} `.padEnd(64, '─'))}`);
}

function ok(name, detail) {
  console.log(`  ${green('✔')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

function fail(name, detail) {
  console.log(`  ${red('✖')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

function note(msg) {
  console.log(`  ${yellow('•')} ${msg}`);
}

async function writeF(path, content) {
  await writeFile(path, content);
  written.push(rel(path));
}

/** Read → transform → write. A `null` transform result records a warning
 * with manual instructions instead of writing. */
async function patchFile(path, what, manualHint, transform) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    warnings.push(`${what}: could not read ${rel(path)} — ${manualHint}`);
    return false;
  }
  const next = transform(text);
  if (next === null) {
    warnings.push(`${what}: expected pattern not found in ${rel(path)} — ${manualHint}`);
    return false;
  }
  if (next === text) return true; // already in place
  await writeFile(path, next);
  written.push(`${rel(path)} (updated)`);
  return true;
}

/* ---------------- locate the app ---------------- */

async function findAppDir() {
  const src = join(ROOT, 'src');
  const entries = await readdir(src, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter((e) => e.isDirectory() && existsSync(join(src, e.name, 'package.json')))
    .map((e) => join(src, e.name));
  if (candidates.length === 0) return null; // fresh fork — no app scaffolded yet
  if (candidates.length > 1) note(`Multiple apps under src/ — using ${rel(candidates[0])}.`);
  return candidates[0];
}

/* ---------------- string escaping for templates ---------------- */

const escHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escTs = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/* ---------------- step 1 — project identity ---------------- */

async function stepProject(app) {
  head('1/4', 'Project identity');

  const shellPath = join(app, 'src', 'shell.ts');
  let shellText = '';
  try {
    shellText = await readFile(shellPath, 'utf8');
  } catch {
    /* prompted defaults below cover it */
  }
  const wordmarkNow = shellText.match(/<span class="op-wordmark-org">([^<]*)<\/span>/)?.[1] ?? '';

  let projectNow = '';
  try {
    const index = await readFile(join(app, 'index.html'), 'utf8');
    projectNow = index.match(/<title>[^<]*— ([^·<]+) · Open Pulse<\/title>/)?.[1]?.trim() ?? '';
  } catch {
    /* fall through */
  }

  let themeNow = 'dark';
  try {
    const prefs = await readFile(join(app, 'src', 'preferences.ts'), 'utf8');
    if (prefs.includes("=== 'dark' ? 'dark' : 'light'")) themeNow = 'light';
  } catch {
    /* fall through */
  }

  const project = await ask('Project name (used in page titles)', projectNow || 'My Open Pulse dashboard');
  const wordmark = wordmarkNow
    ? await ask('Header wordmark text', wordmarkNow)
    : wordmarkNow;
  let theme = (await ask('Default theme — dark or light', themeNow)).toLowerCase();
  if (theme !== 'light') theme = 'dark';

  return { project, wordmark, wordmarkNow, theme, themeNow };
}

/* ---------------- step 2 — .env ---------------- */

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

const isSecretKey = (k) => /AUTH|PASSWORD|TOKEN|SECRET/.test(k);
const isPlaceholder = (v) => !v || /xxxx|replace.?me/i.test(v);

function maskSecret(v) {
  const i = v.indexOf('/');
  if (i > 0) return `${v.slice(0, i + 1)}****`;
  return v.length > 6 ? `${v.slice(0, 2)}****` : '****';
}

async function stepEnv() {
  head('2/4', 'Environment (.env)');

  const envPath = join(ROOT, '.env');
  let example;
  try {
    example = await readFile(join(ROOT, '.env.example'), 'utf8');
  } catch {
    note('No .env.example at the repo root — skipping the environment step.');
    return;
  }

  let existing = {};
  if (existsSync(envPath)) {
    existing = parseEnv(await readFile(envPath, 'utf8'));
    console.log(`  Found an existing ${bold('.env')} (values below default to it).`);
    if (!(await askYesNo('Review/update .env values?', false))) {
      note('Keeping .env as is.');
      return;
    }
  } else {
    console.log('  No .env yet — let’s create one. Enter to accept a default.');
  }

  const out = [];
  const seen = new Set();
  for (const line of example.split('\n')) {
    const kv = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!kv) {
      const section = line.match(/^# ── (.+?) ─+/);
      if (section) console.log(`\n  ${bold(section[1])}`);
      out.push(line);
      continue;
    }
    const key = kv[1];
    seen.add(key);
    const def = existing[key] ?? kv[2];
    const mask = isSecretKey(key) && !isPlaceholder(def);
    const value = await ask(key, def, mask ? maskSecret(def) : undefined);
    out.push(`${key}=${value}`);
  }

  // Keep any keys the user added to .env that .env.example doesn't know about.
  const extras = Object.entries(existing).filter(([k]) => !seen.has(k));
  if (extras.length) {
    out.push('', '# ── Kept from your previous .env (not in .env.example) ──');
    for (const [k, v] of extras) out.push(`${k}=${v}`);
  }

  await writeF(envPath, out.join('\n'));
  ok('.env written', rel(envPath));
}

/* ---------------- step 3 — connectivity ---------------- */

function basicAuth(pair) {
  const i = pair.indexOf('/');
  const user = i === -1 ? pair : pair.slice(0, i);
  const pass = i === -1 ? '' : pair.slice(i + 1);
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

const fmtCount = (n) => Number(n).toLocaleString('en-US').replace(/,/g, ' ');

async function checkService(name, envKeys, env, fn) {
  const missing = envKeys.find((k) => isPlaceholder(env[k]));
  if (missing) {
    note(`${name} — skipped (${missing} not filled in).`);
    return;
  }
  try {
    const detail = await fn();
    ok(name, detail);
  } catch (e) {
    fail(name, e?.message ?? String(e));
  }
}

async function stepConnectivity() {
  head('3/4', 'Connectivity checks');

  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    note('No .env — skipping connectivity checks.');
    return;
  }
  if (!(await askYesNo('Check connectivity to the Open Pulse stores now?', true))) return;

  const env = parseEnv(await readFile(envPath, 'utf8'));
  const timeout = () => AbortSignal.timeout(10_000);

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

  console.log(dim('\n  A ✖ is not fatal — fix the value in .env and re-run the wizard.'));
}

/* ---------------- step 4 — page scaffolding ---------------- */

const ARCHETYPES = {
  cards: {
    menu: 'Card grid — mixed-status cards (e.g. service health)',
    slug: 'services',
    title: 'Service health',
    label: 'STATUS',
    description: 'Mixed-status card grid built on the Open Pulse platform.',
    tpl: 'page-cards.ts.tpl',
    data: 'data-cards.json',
  },
  list: {
    menu: 'List / detail — selectable table + detail panel (e.g. pipeline runs)',
    slug: 'runs',
    title: 'Pipeline runs',
    label: 'PIPELINE',
    description: 'List/detail view built on the Open Pulse platform.',
    tpl: 'page-list-detail.ts.tpl',
    data: 'data-list-detail.json',
  },
  trends: {
    menu: 'Trends — time-series chart with headline tiles',
    slug: 'trends',
    title: 'Activity trends',
    label: 'OVER TIME',
    description: 'Time-series trends built on the Open Pulse platform.',
    tpl: 'page-trends.ts.tpl',
    data: 'data-trends.json',
  },
  graph: {
    menu: 'Graph explorer — force-directed network canvas',
    slug: 'network',
    title: 'Network explorer',
    label: 'GRAPH',
    description: 'Interactive network explorer built on the Open Pulse platform.',
    tpl: 'page-graph.ts.tpl',
    data: 'data-graph.json',
  },
};

async function existingSlugs(app) {
  const entries = await readdir(app).catch(() => []);
  return new Set(entries.filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')));
}

async function patchShellForPage(app, slug, label) {
  const shellPath = join(app, 'src', 'shell.ts');
  const hint = `add "| '${slug}'" to PageId and a NAV entry for ${slug}.html yourself`;

  await patchFile(shellPath, `Register '${slug}' in PageId`, hint, (text) => {
    const m = text.match(/export type PageId =[\s\S]*?;/);
    if (!m) return null;
    if (m[0].includes(`'${slug}'`)) return text;
    return text.replace(m[0], m[0].replace(/;$/, `\n  | '${slug}';`));
  });

  await patchFile(shellPath, `Add '${slug}' to the nav`, hint, (text) => {
    const start = text.indexOf('const NAV');
    if (start === -1) return null;
    const end = text.indexOf('\n];', start);
    if (end === -1) return null;
    if (text.slice(start, end).includes(`'${slug}.html'`)) return text;
    const entry = `\n  { id: '${slug}', href: '${slug}.html', label: '${escTs(label)}' },`;
    return text.slice(0, end) + entry + text.slice(end);
  });
}

async function patchViteForPage(app, slug) {
  await patchFile(
    join(app, 'vite.config.ts'),
    `Add '${slug}.html' to the Vite build`,
    `add "'${slug}': resolve(__dirname, '${slug}.html')" to build.rollupOptions.input yourself`,
    (text) => {
      const m = text.match(/input: \{[^}]*\}/);
      if (!m) return null;
      if (m[0].includes(`'${slug}.html'`)) return text;
      const patched = m[0].replace(
        /\n([ \t]*)\}$/,
        `\n$1  '${slug}': resolve(__dirname, '${slug}.html'),\n$1}`,
      );
      if (patched === m[0]) return null;
      return text.replace(m[0], patched);
    },
  );
}

async function scaffoldPage(app, archKey, answers, project) {
  const arch = ARCHETYPES[archKey];
  const { slug, title, label, description } = answers;

  const fillHtml = (s) =>
    s
      .replaceAll('__SLUG__', slug)
      .replaceAll('__TITLE__', escHtml(title))
      .replaceAll('__DESCRIPTION__', escHtml(description))
      .replaceAll('__PROJECT__', escHtml(project));
  const fillTs = (s) =>
    s
      .replaceAll('__SLUG__', slug)
      .replaceAll('__TITLE__', escTs(title))
      .replaceAll('__LABEL__', escTs(label.toUpperCase()));

  await writeF(join(app, `${slug}.html`), fillHtml(await readFile(join(TPL_DIR, 'page.html.tpl'), 'utf8')));
  await writeF(join(app, 'src', 'pages', `${slug}.ts`), fillTs(await readFile(join(TPL_DIR, arch.tpl), 'utf8')));
  await writeF(join(app, 'src', 'data', `${slug}.json`), await readFile(join(TPL_DIR, arch.data), 'utf8'));
  await patchShellForPage(app, slug, label);
  await patchViteForPage(app, slug);
  ok(`Scaffolded ${slug}.html (${archKey})`);
}

async function stepPages(app, project) {
  head('4/4', 'Dashboard pages');

  const keys = Object.keys(ARCHETYPES);
  console.log('  Layout archetypes (frontend-dev skill §7–§8):\n');
  keys.forEach((k, i) => console.log(`    ${i + 1}. ${bold(k.padEnd(7))} ${ARCHETYPES[k].menu}`));
  console.log();

  const raw = await ask('Archetypes to scaffold (names or numbers, comma-separated; empty for none)');
  if (!raw) {
    note('No pages scaffolded.');
    return;
  }

  const picked = [];
  for (const token of raw.split(',').map((t) => t.trim()).filter(Boolean)) {
    const key = /^\d+$/.test(token) ? keys[Number(token) - 1] : keys.find((k) => k === token.toLowerCase());
    if (!key) note(`Unknown archetype '${token}' — skipped.`);
    else if (!picked.includes(key)) picked.push(key);
  }

  const taken = await existingSlugs(app);
  for (const key of picked) {
    const arch = ARCHETYPES[key];
    console.log(`\n  ${bold(arch.menu)}`);

    let slug = '';
    for (;;) {
      slug = (await ask('URL slug', arch.slug)).toLowerCase();
      if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
        note(`'${slug}' — use lowercase letters, digits and dashes, starting with a letter.`);
        continue;
      }
      if (taken.has(slug)) {
        note(`'${slug}.html' already exists — pick another slug.`);
        continue;
      }
      break;
    }

    const title = await ask('Page title', arch.title);
    const label = await ask('Nav label', title);
    const description = await ask('Meta description', arch.description);

    await scaffoldPage(app, key, { slug, title, label, description }, project);
    taken.add(slug);
  }
}

/* ---------------- apply identity edits ---------------- */

async function applyIdentity(app, identity) {
  const { wordmark, wordmarkNow, theme, themeNow } = identity;

  if (wordmark && wordmark !== wordmarkNow) {
    await patchFile(
      join(app, 'src', 'shell.ts'),
      'Update the header wordmark',
      'edit the op-wordmark-org span in src/shell.ts yourself',
      (text) => {
        const m = text.match(/(<span class="op-wordmark-org">)[^<]*(<\/span>)/);
        if (!m) return null;
        return text.replace(m[0], `${m[1]}${escHtml(wordmark)}${m[2]}`);
      },
    );
  }

  if (theme !== themeNow) {
    // Flip the pre-paint default in every page's inline <head> script…
    const darkExpr = "localStorage.getItem('op-theme') === 'light' ? 'light' : 'dark'";
    const lightExpr = "localStorage.getItem('op-theme') === 'dark' ? 'dark' : 'light'";
    const [from, to] = theme === 'light' ? [darkExpr, lightExpr] : [lightExpr, darkExpr];
    const pages = (await readdir(app)).filter((f) => f.endsWith('.html'));
    for (const page of pages) {
      await patchFile(
        join(app, page),
        `Default theme in ${page}`,
        'flip the op-theme fallback in its inline head script yourself',
        (text) => (text.includes(from) ? text.replaceAll(from, to) : text.includes(to) ? text : null),
      );
    }
    // …and in preferences.ts (getTheme fallback).
    const prefsDark = "localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'";
    const prefsLight = "localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'";
    const [pFrom, pTo] = theme === 'light' ? [prefsDark, prefsLight] : [prefsLight, prefsDark];
    await patchFile(
      join(app, 'src', 'preferences.ts'),
      'Default theme in preferences.ts',
      'flip the getTheme() fallback yourself',
      (text) => (text.includes(pFrom) ? text.replace(pFrom, pTo) : text.includes(pTo) ? text : null),
    );
    ok(`Default theme set to ${theme}`);
  }
}

/* ---------------- main ---------------- */

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node tools/setup.mjs\nInteractive setup — see the header comment of this file.');
  process.exit(0);
}

console.log(`
${bold('pulseWebKit setup')}
${dim('─'.repeat(64))}
Configures your fork of the Open Pulse dashboard template: project
identity, .env credentials, connectivity, and starter dashboard pages.
Enter accepts the ${dim('(default)')} shown. Nothing is overwritten silently.`);

const APP = await findAppDir();
if (APP) {
  console.log(`\n  App directory: ${bold(rel(APP))}`);
} else {
  console.log();
  note('No app under src/ yet (no directory with a package.json) — running the');
  note('environment steps only. Scaffold your app first (see CLAUDE.md), then');
  note('re-run the wizard for the identity and pages steps.');
}

const identity = APP ? await stepProject(APP) : null;
await stepEnv();
await stepConnectivity();
if (APP && identity) {
  await stepPages(APP, identity.project);
  await applyIdentity(APP, identity);
}

rl.close();

/* summary */
console.log(`\n${bold('Summary')}\n${dim('─'.repeat(64))}`);
if (written.length) {
  console.log('  Files written:');
  for (const f of written) console.log(`    ${green('+')} ${f}`);
} else {
  console.log('  No files changed.');
}
if (warnings.length) {
  console.log(`\n  ${yellow('Manual follow-ups:')}`);
  for (const w of warnings) console.log(`    ${yellow('!')} ${w}`);
}
if (APP) {
  console.log(`
  Next steps:
    cd ${rel(APP)}
    npm install
    npm run dev       ${dim('# then verify the pages in a browser')}
    npm run check     ${dim('# type-check')}
`);
} else {
  console.log(`
  Next steps: scaffold your app under src/ (see CLAUDE.md), then re-run
  ${bold('npm run setup')} to configure identity and scaffold dashboard pages.
`);
}
