#!/usr/bin/env node
// Query the Open Pulse CHAOSS Metrics API.
//
// All endpoints are GET -> JSON, computed live per repository or per
// GrimoireLab project. Reads CHAOSS_ENDPOINT (base URL, e.g.
// https://openpulse.epfl.ch) and CHAOSS_AUTH (format: user/password)
// from the nearest .env walking up, or from process.env. Auth is HTTP
// Basic; the username is ignored, only the password matters.
//
// Subcommands:
//   catalogue                       all 35 metric specs (static)
//   topics                          the 3 buckets + counts
//   spec <slug>                     one metric spec
//   projects                        list GrimoireLab projects
//   repo <owner> <repo> [slug]      per-repository metrics (all, or one)
//   project <project> [slug]        per-project metrics (all, or one)
//   project-repos <project>         member repos of a project
//   get <path>                      arbitrary path fall-through
//
// Flags: --window N  --include a,b,c  --refresh  --category X
//        --param k=v (repeatable)  --raw
//
// Usage:
//   node query.mjs topics
//   node query.mjs repo sdsc-ordes gimie contributors --window 730 --include traces
//   node query.mjs project bioeng --refresh

import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHAOSS_PATH = '/api/v1/metrics/chaoss';

async function loadDotenv() {
	let dir = dirname(fileURLToPath(import.meta.url));
	for (let i = 0; i < 10; i++) {
		const envPath = join(dir, '.env');
		try {
			await stat(envPath);
			const text = await readFile(envPath, 'utf8');
			for (const line of text.split('\n')) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
				const idx = trimmed.indexOf('=');
				const key = trimmed.slice(0, idx).trim();
				const value = trimmed.slice(idx + 1).trim();
				if (process.env[key] === undefined) process.env[key] = value;
			}
			return;
		} catch {
			const parent = dirname(dir);
			if (parent === dir) return;
			dir = parent;
		}
	}
}

function parseArgs(argv) {
	const positionals = [];
	const opts = { param: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--refresh') opts.refresh = true;
		else if (a === '--raw') opts.raw = true;
		else if (a === '--window') opts.window = argv[++i];
		else if (a === '--include') opts.include = argv[++i];
		else if (a === '--category') opts.category = argv[++i];
		else if (a === '--param') opts.param.push(argv[++i]);
		else positionals.push(a);
	}
	return { positionals, opts };
}

function buildPath(cmd, p) {
	switch (cmd) {
		case 'catalogue':
			return CHAOSS_PATH;
		case 'topics':
			return `${CHAOSS_PATH}/topics`;
		case 'spec':
			return `${CHAOSS_PATH}/metrics/${p[0]}`;
		case 'projects':
			return `${CHAOSS_PATH}/projects`;
		case 'repo': {
			const base = `${CHAOSS_PATH}/repositories/github.com/${p[0]}/${p[1]}/metrics`;
			return p[2] ? `${base}/${p[2]}` : base;
		}
		case 'project': {
			const base = `${CHAOSS_PATH}/projects/${p[0]}/metrics`;
			return p[1] ? `${base}/${p[1]}` : base;
		}
		case 'project-repos':
			return `${CHAOSS_PATH}/projects/${p[0]}/repositories`;
		case 'get':
			return p[0].startsWith('/') ? p[0] : `${CHAOSS_PATH}/${p[0].replace(/^\/+/, '')}`;
		default:
			console.error(`unknown command: ${cmd}`);
			process.exit(2);
	}
}

function buildQuery(opts) {
	const q = new URLSearchParams();
	if (opts.window !== undefined) q.set('window', opts.window);
	if (opts.include) q.set('include', opts.include);
	if (opts.refresh) q.set('refresh', '1');
	if (opts.category) q.set('category', opts.category);
	for (const pair of opts.param) {
		const idx = pair.indexOf('=');
		q.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
	}
	return q.toString();
}

async function main() {
	await loadDotenv();
	const { positionals, opts } = parseArgs(process.argv.slice(2));
	const cmd = positionals.shift();
	if (!cmd) {
		console.error('error: a subcommand is required (catalogue|topics|spec|projects|repo|project|project-repos|get)');
		process.exit(2);
	}

	const endpoint = process.env.CHAOSS_ENDPOINT;
	const auth = process.env.CHAOSS_AUTH;
	if (!endpoint || !auth || !auth.includes('/')) {
		console.error('error: CHAOSS_ENDPOINT and CHAOSS_AUTH (user/password) must be set');
		process.exit(2);
	}

	const [user, ...rest] = auth.split('/');
	const password = rest.join('/');
	const path = buildPath(cmd, positionals);
	const qs = buildQuery(opts);
	let url = `${endpoint.replace(/\/$/, '')}${path}`;
	if (qs) url += `?${qs}`;

	const token = Buffer.from(`${user}:${password}`).toString('base64');
	let res;
	try {
		res = await fetch(url, { headers: { Authorization: `Basic ${token}`, Accept: 'application/json' } });
	} catch (e) {
		console.error(`network error: ${e.message}`);
		process.exit(1);
	}

	const text = await res.text();
	if (!res.ok) {
		console.error(`http ${res.status}: ${text}`);
		process.exit(1);
	}

	if (opts.raw) {
		process.stdout.write(text.endsWith('\n') ? text : text + '\n');
		return;
	}
	process.stdout.write(JSON.stringify(JSON.parse(text), null, 2) + '\n');
}

main();
