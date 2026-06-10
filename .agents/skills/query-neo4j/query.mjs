#!/usr/bin/env node
// Run a Cypher query against the Open Pulse Neo4j HTTP transactional API.
//
// Reads NEO4J_HTTP_ENDPOINT and NEO4J_AUTH (format: user/password) from
// the nearest .env walking up from this file, or from process.env.
// Prints the rows as JSON to stdout.
//
// Usage:
//   node query.mjs 'MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n'
//   node query.mjs -                          # read query from stdin
//   node query.mjs -f path/to/query.cypher    # read query from file

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

async function readQuery(argv) {
	const fileFlag = argv.indexOf('-f');
	if (fileFlag !== -1 && argv[fileFlag + 1]) {
		return await readFile(resolve(argv[fileFlag + 1]), 'utf8');
	}
	const positional = argv.find((a) => !a.startsWith('-'));
	if (positional === '-' || positional === undefined) return await readStdin();
	return positional;
}

async function main() {
	const argv = process.argv.slice(2);
	await loadDotenv();

	const endpoint = process.env.NEO4J_HTTP_ENDPOINT;
	const auth = process.env.NEO4J_AUTH;
	if (!endpoint || !auth || !auth.includes('/')) {
		console.error('error: NEO4J_HTTP_ENDPOINT and NEO4J_AUTH (user/password) must be set');
		process.exit(2);
	}

	const [user, ...passwordParts] = auth.split('/');
	const password = passwordParts.join('/');
	const cypher = (await readQuery(argv)).trim();
	if (!cypher) {
		console.error('error: empty query');
		process.exit(2);
	}

	const dbFlag = argv.indexOf('--database');
	const database = dbFlag !== -1 ? argv[dbFlag + 1] : 'neo4j';
	const url = `${endpoint.replace(/\/$/, '')}/db/${database}/tx/commit`;
	const token = Buffer.from(`${user}:${password}`).toString('base64');

	let res;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${token}`,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({ statements: [{ statement: cypher }] })
		});
	} catch (e) {
		console.error(`network error: ${e.message}`);
		process.exit(1);
	}

	if (!res.ok) {
		console.error(`http ${res.status}: ${await res.text()}`);
		process.exit(1);
	}

	const payload = await res.json();
	if (payload.errors && payload.errors.length > 0) {
		console.error(JSON.stringify(payload.errors, null, 2));
		process.exit(1);
	}

	const result = payload.results[0];
	const rows = result.data.map((r) =>
		Object.fromEntries(result.columns.map((c, i) => [c, r.row[i]]))
	);
	process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
}

main();
