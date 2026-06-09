#!/usr/bin/env node
// Query the Open Pulse OpenSearch cluster.
//
// Reads OPENSEARCH_ENDPOINT, OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD
// from the nearest .env (walking up) or from process.env. TLS
// verification is disabled by default (self-signed); pass --verify to
// re-enable.
//
// Usage:
//   node query.mjs health
//   node query.mjs indices [pattern]
//   node query.mjs count <index>
//   node query.mjs search <index> '<json body>'
//   node query.mjs search <index> -                   # stdin
//   node query.mjs search <index> -f body.json
//   node query.mjs get /<path>

import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function readStdin() {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data;
}

async function request(method, path, body, { verify }) {
	const endpoint = process.env.OPENSEARCH_ENDPOINT.replace(/\/$/, '');
	const token = Buffer.from(`${process.env.OPENSEARCH_USERNAME}:${process.env.OPENSEARCH_PASSWORD}`).toString('base64');
	const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' };

	const proxy = ['1', 'true', 'yes'].includes((process.env.OPENSEARCH_DASHBOARDS_PROXY || '').trim().toLowerCase());

	let url;
	let outerMethod;
	if (proxy) {
		// OpenSearch Dashboards' Dev Tools proxy: cluster path goes in
		// ?path=..., inner verb in ?method=..., outer request is always POST.
		const inner = path.startsWith('/') ? path.slice(1) : path;
		const qs = new URLSearchParams({ path: inner, method: method.toUpperCase() });
		url = `${endpoint}/api/console/proxy?${qs.toString()}`;
		outerMethod = 'POST';
		headers['osd-xsrf'] = 'true';
		// The proxy wants a content-type even when the inner verb is GET.
		if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
	} else {
		url = `${endpoint}${path}`;
		outerMethod = method;
		if (body !== undefined) headers['Content-Type'] = 'application/json';
	}

	// Disable TLS verification for self-signed certs by default.
	const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
	if (!verify) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

	let res;
	try {
		res = await fetch(url, { method: outerMethod, headers, body });
	} catch (e) {
		console.error(`network error: ${e.message}`);
		process.exit(1);
	} finally {
		if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
		else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
	}

	if (!res.ok) {
		console.error(`http ${res.status}: ${await res.text()}`);
		process.exit(1);
	}
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		return { _raw: text };
	}
}

async function readBody(arg, file) {
	if (file) return await readFile(resolve(file), 'utf8');
	if (arg === '-') return await readStdin();
	if (arg === undefined) return undefined;
	return arg;
}

function flag(argv, name) {
	const i = argv.indexOf(name);
	return i === -1 ? null : argv[i + 1];
}

async function main() {
	const argv = process.argv.slice(2);
	await loadDotenv();
	for (const key of ['OPENSEARCH_ENDPOINT', 'OPENSEARCH_USERNAME', 'OPENSEARCH_PASSWORD']) {
		if (!process.env[key]) {
			console.error(`error: ${key} must be set`);
			process.exit(2);
		}
	}
	const verify = argv.includes('--verify');
	const positional = argv.filter((a) => !a.startsWith('-') && a !== flag(argv, '-f'));
	const [cmd, ...rest] = positional;

	let payload;
	switch (cmd) {
		case 'health':
			payload = await request('GET', '/_cluster/health', undefined, { verify });
			break;
		case 'indices': {
			const pattern = rest[0] || '*';
			payload = await request(
				'GET',
				`/_cat/indices/${pattern}?format=json&h=index,docs.count,store.size&s=index`,
				undefined,
				{ verify }
			);
			break;
		}
		case 'count':
			if (!rest[0]) {
				console.error('usage: count <index>');
				process.exit(2);
			}
			payload = await request('GET', `/${rest[0]}/_count`, undefined, { verify });
			break;
		case 'search': {
			if (!rest[0]) {
				console.error('usage: search <index> [body|-|-f file]');
				process.exit(2);
			}
			const size = flag(argv, '--size') || '10';
			const body = (await readBody(rest[1], flag(argv, '-f'))) || '{"query":{"match_all":{}}}';
			payload = await request('POST', `/${rest[0]}/_search?size=${size}`, body, { verify });
			break;
		}
		case 'get':
			if (!rest[0]) {
				console.error('usage: get /<path>');
				process.exit(2);
			}
			payload = await request('GET', rest[0].startsWith('/') ? rest[0] : `/${rest[0]}`, undefined, { verify });
			break;
		default:
			console.error('usage: health | indices [pattern] | count <index> | search <index> [body] | get /<path>');
			process.exit(2);
	}

	process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

main();
