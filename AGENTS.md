# AGENTS.md — pulseWebKit (Open Pulse web app)

Agent instructions for this repository. Read this first, then `.agents/PROJECT.md` for the broader mission, `.agents/SKILLS.md` for concrete task recipes, and the `frontend-dev` skill before touching any UI.

<!-- sync:keep -->
> **Note on dual agent dirs:** `.claude/` is the canonical source of truth for project docs and skills. `.agents/` (plus root `AGENTS.md`) is a generated, vendor-neutral mirror for non-Claude agent runtimes. **Edit `.claude/` only**, then run `node tools/sync-agents.mjs` to regenerate `.agents/`. CI fails if they drift (`node tools/sync-agents.mjs --check`).
>
> **Agent compatibility:** Claude Code reads `CLAUDE.md` + `.claude/skills/`. Tools following the open `AGENTS.md` standard (Codex, Cursor, …) read root `AGENTS.md`. The [Pi coding agent](https://pi.dev) reads both `CLAUDE.md`/`AGENTS.md` **and** auto-discovers skills directly from `.agents/skills/` — so the generated mirror is natively usable by Pi with no extra config. Whatever the tool, the skills also work as plain documented commands (`python .claude/skills/<skill>/query.py …`), so an agent never has to support a proprietary skill loader to use them.
<!-- sync:endkeep -->

---

## What this is

**pulseWebKit** (working name: *pulseNext*) — a starter that will be published as a **GitHub template repo** so researchers and developers can fork it to build their own dashboards or interactive sites on top of the **Open Pulse** platform.

The Open Pulse platform (Neo4j + Oxigraph + OpenSearch) is the data layer; this kit demonstrates how to pull, type, and visualise variables from it. See `.agents/PROJECT.md` for the full mission, data-source overview, and template-extension guidance.

**Framework-neutral.** This template does **not** prescribe a UI framework. The web app lives in `src/your-web/` — build it with whatever you like (plain HTML, React, Vue, Svelte, Astro, web components, …). The two things that *are* fixed are framework-independent: the **Open Pulse query skills** (`.agents/skills/`) and the **SDSC design system** (the `frontend-dev` skill, defined as CSS custom properties + HTML/CSS). Keep those; swap everything else.

---

## Preferred approach — static-first, user-focused

No framework is mandated, but the template carries a **default posture**. Lean this way unless the user asks for something else:

- **Static-first.** Build something that publishes to **GitHub Pages with no server runtime** — a static bundle of HTML/CSS/JS. Optimise for the end user: fast first paint, accessible markup, minimal blocking JS, progressive enhancement.
- **Data strategy**, in order of preference:
  1. **Inline in the HTML** — for small datasets, bake the data into the page at build time (e.g. a `<script type="application/json">` block or pre-rendered markup). Zero fetch, instant render.
  2. **Optimised static assets** — serve **web-optimised images**: responsive sizes, modern formats (AVIF/WebP), explicit dimensions, lazy loading. Never ship original-resolution images.
  3. **DuckDB-Wasm over Parquet** — for larger or queryable datasets, ship `.parquet` files as static assets and query them **in-browser** with [DuckDB-Wasm](https://duckdb.org/docs/stable/clients/wasm/overview). Stays fully static (no backend), columnar + compressed, with fast client-side filtering/aggregation.
- **Interactive visualisation** — use **client-side JS** for plots and graphs. Default to **[D3.js](https://d3js.org)** for bespoke/interactive charts and the force-directed graph; other JS viz libraries are fine where they fit. Charts should be **interactive** (hover, zoom, filter) — not static images.
- **Attribution bar (required).** Every page renders a top bar reading **`Built using openpulse.science at <timestamp>`**, where `<timestamp>` is the **build time** (ISO 8601 UTC, injected at build — never computed in the browser). Link `openpulse.science`. Visual spec: `frontend-dev` skill §7.11.

These are defaults that make the GitHub-Pages publishing path (see README) the path of least resistance. If a request genuinely needs a server runtime or live queries, say so and fall back to the server-side proxy pattern below.

---

## Reference views (patterns to build toward)

- **Graph Explorer** — a force-directed graph of Neo4j data (repos, contributors, commits, orgs, PRs) with temporal animation — full-page canvas archetype.
- **List / detail** (e.g. pipeline runs) — list + detail with status badges and tables.
- **Card grid** (e.g. service health) — mixed-status surfaces.

These three cover the layout archetypes most downstream users need. See the `frontend-dev` skill §7–§8 for their visual specs.

---

## The web app — `src/your-web/`

The app you build lives in `src/your-web/`. Pick a framework, scaffold it there, and wire it to Open Pulse through a **server-side** layer (see Architecture). This template ships the agent tooling and design system; the app itself is yours to scaffold.

Typical local dev (adjust to your chosen tooling):

```bash
cd src/your-web
npm install
npm run dev      # local dev server
npm run build    # production build (for GitHub Pages — see README)
```

If your stack has a type/lint check, run it before every commit; CI runs it on every push and PR.

---

## UI verification — REQUIRED for frontend work

This repo ships **Playwright MCP** (`@playwright/mcp`) for UI verification, enabled via `.agents/settings.json` (`enabledMcpjsonServers: ["playwright"]`). Config is port-locked to the local dev/preview servers (`5173`, `4173`).

| Runtime | Active config | How it runs |
|---|---|---|
| **Host** (native) | `.mcp.json` ← `.mcp.host.json` | `npx @playwright/mcp` (stdio). Run `npx playwright install chromium` once. |
| **Devcontainer** | `.mcp.json` ← `.mcp.docker.json` | HTTP to the `playwright-mcp` sidecar at `http://localhost:8931/mcp` (set automatically in `post-create`). |

Switch manually: `bash tools/image/docker/setup-mcp.sh host` or `… docker`. Canonical templates: `.mcp.host.json`, `.mcp.docker.json`.

**Rules for any change that touches UI, routes, CSS tokens, or visual behaviour:**

1. Start the dev server (from `src/your-web`).
2. Drive the affected page through the Playwright MCP browser tools — navigate, click, fill, snapshot.
3. Take a screenshot and confirm it visually matches the design intent (see the `frontend-dev` skill).
4. Watch the browser console for runtime errors and network failures.

A type-check is a correctness gate, **not** a feature-correctness gate. Do not claim UI work is done on a passing build alone — verify in the browser.

---

## Repository layout

```
open-pulse-webkit/
├── .agents/            # canonical agent config (EDIT HERE)
│   ├── PROJECT.md      #   mission + data-source overview
│   ├── SKILLS.md       #   concrete task recipes
│   ├── settings.json   #   permissions + enabled MCP servers
│   └── skills/         #   the 9 skills (frontend-dev + query-* + op-*)
├── .agents/            # generated mirror for AGENTS.md-standard tools + Pi (DO NOT EDIT)
├── AGENTS.md           # this file (canonical conventions)
├── AGENTS.md           # generated mirror of AGENTS.md
├── .mcp.json           # Playwright MCP (active; host default — see .mcp.host.json / .mcp.docker.json)
├── .devcontainer/      # devcontainer entry (compose lives in tools/image/docker/)
├── .env.example        # Open Pulse endpoints + credentials
├── tools/
│   ├── image/docker/   # Ubuntu dev image + playwright-mcp sidecar compose
│   └── sync-agents.mjs # regenerates .agents/ from .agents/
└── src/
    └── your-web/       # ← your web app (scaffold it here)
```

---

## Architecture

### Data sources (Open Pulse platform)

| Store | What's in it | How to query |
|---|---|---|
| **Neo4j** (`:7503` HTTP, `:7504` Bolt) | Property graph: repositories, contributors, commits, organisations, PRs | Skill `query-neo4j` |
| **Oxigraph / SPARQL** (`:7502`, Caddy basic-auth) | RDF metadata (~2.45M triples); default-graph or named-graph (`…/graph/{YYYY-MM}/hybrid`) queries | Skill `query-sparql` |
| **OpenSearch** (`:9200`, self-signed TLS) | GrimoireLab-enriched docs | Skill `query-opensearch` |

There are also higher-level hub skills (`op-collections`, `op-search`, `query-chaoss`, `op-crawler`, `op-extractor`). See `.agents/SKILLS.md` and each skill's `SKILL.md`.

**Browser code must never hit these stores directly.** Credentials are server-side only. Route every request through a server-side endpoint (a serverless function, a small API, or your framework's server route) that holds the credentials and proxies to Neo4j/SPARQL/OpenSearch. The browser only ever talks to your own endpoint.

> Note for GitHub Pages: Pages serves **static files only** — there is no server runtime. If you publish to Pages and still need live data, the server-side proxy must live elsewhere (a serverless function, a separate small host, or pre-built static JSON snapshots committed at build time). See the README's *Publishing to GitHub Pages* section.

### TypeScript / types

If you use TypeScript, keep API response shapes typed in one place and treat that as the source of truth for client + server.

---

## Design system

Read the `frontend-dev` skill before writing any UI code. Key rules:

- All colors come from `--op-*` CSS custom properties (mirror them into your utility framework's theme if you use one)
- Never hardcode hex in template markup — canvas/SVG drawing code is the only exception
- Fonts: Space Grotesk for headings/wordmark, Switzer for all UI text, JetBrains Mono (`.mono`) for code/IDs
- Sharp corners everywhere (`rounded-none`) — buttons and badges use `rounded` (4px) only
- Brand blues only for interactive chrome; status colors only on badges/toasts

---

## Dev notes

- **Editing agent config:** edit `.agents/` only, then run `node tools/sync-agents.mjs` to regenerate `.agents/` + `AGENTS.md`. CI (`agents-sync` job) fails if they drift.
- **Node on PATH:** the sync script needs Node. If `node` isn't on your PATH, invoke it with a full path to any local Node binary (CI uses its own Node, so this is a local-only concern).
- **Skills need `.env`:** the `query-*` / `op-*` skills read endpoints + credentials from `.env` at the repo root. Copy `.env.example` → `.env` and fill it in. Never commit `.env`.
- **Publishing:** the app is intended to be published to **GitHub Pages** as a static site — see the README's *Publishing to GitHub Pages* section. (There is no public dev tunnel; that infrastructure was removed.)

---

## What not to do

- Do not hardcode hex values in template markup (canvas/SVG drawing is exempt)
- Do not claim UI work is done from a passing build alone — verify via Playwright MCP
- Do not hit Open Pulse stores directly from the browser — always go through a server-side proxy
- Do not commit `.env` (it holds credentials)
<!-- sync:keep -->
- Do not hand-edit `.agents/` or root `AGENTS.md` — edit `.claude/` and run `node tools/sync-agents.mjs`
<!-- sync:endkeep -->
