# pulseWebKit

**A starter template for building interactive dashboards on top of [Open Pulse](https://openpulse.epfl.ch) — with an AI coding agent doing most of the work.**

---

## What is this?

[Open Pulse](https://openpulse.epfl.ch) is a research-software-observability platform maintained by the Swiss Data Science Center (SDSC). It holds data about research code — repositories, contributors, commits, organisations, publications — across three databases (a graph, an RDF triplestore, and a search index).

**pulseWebKit is the easiest way to build your own view on top of that data.** Click *"Use this template"*, open the repo in your AI coding agent of choice, and ask it to build the dashboard you want. The agent already knows how to talk to Open Pulse, because this repo ships a set of **skills** — small, documented helpers that let the agent query each data store safely.

You don't need to learn the Open Pulse APIs. You describe the dashboard; the agent uses the skills to fetch real data and wires up the UI.

---

## What's in the box

| | What it is | Where |
|---|---|---|
| 🧠 **Agent skills** | 9 ready-to-use skills the agent can call to query Open Pulse (Neo4j graph, SPARQL metadata, OpenSearch, semantic search, CHAOSS health metrics, the crawler, the extractor, collections) and to do frontend work | `.claude/skills/`, mirrored to `.agents/skills/` |
| 📋 **Project docs for agents** | `CLAUDE.md` / `AGENTS.md` (conventions), `PROJECT.md` (mission + data sources), `SKILLS.md` (task recipes) | repo root + `.claude/` / `.agents/` |
| 🎨 **Design system** | A dark-mode SDSC visual identity the `frontend-dev` skill enforces, so generated UI looks on-brand | `frontend-dev` skill |
| 🐳 **Devcontainer** | A reproducible dev environment (VS Code / Codespaces) | `.devcontainer/` |
| 🧪 **Playwright MCP** | Lets the agent open the running app in a real browser and screenshot it to verify UI changes | `.mcp.json` |
| 🔑 **Env template** | Documents the Open Pulse endpoints and credentials your skills need | `.env.example` |

---

## Works with your agent of choice

The skills and project docs are written once (in `.claude/`) and mirrored into a vendor-neutral copy (`.agents/` + root `AGENTS.md`), so the same toolkit works across runtimes:

- **[Claude Code](https://claude.com/claude-code)** — reads `CLAUDE.md` and `.claude/skills/`
- **AGENTS.md-standard tools** (Codex, Cursor, …) — read root `AGENTS.md`
- **[Pi coding agent](https://pi.dev)** — reads `AGENTS.md` and auto-discovers skills from `.agents/skills/`

> The two copies are kept in sync automatically. **Only edit `.claude/`**, then run `node tools/sync-agents.mjs`. CI fails if they drift.

---

## Quickstart

1. **Use this template** on GitHub to create your own repo, then clone it.
2. Copy the env file and fill in your Open Pulse endpoints/credentials:
   ```bash
   cp .env.example .env
   ```
3. Open the repo in your agent and ask it to build something, e.g.
   > *"Add a page that shows the top 10 most-active repositories this month."*

   The agent will use the `query-*` skills to pull real data and the `frontend-dev` skill to build the UI on-brand.
4. Run the app locally (once it's scaffolded — see status below):
   ```bash
   cd src/your-web
   npm install
   npm run dev      # local dev server
   ```

> **Bring your own framework.** This template doesn't prescribe a UI stack — the app lives in `src/your-web/` and you build it with whatever you like (plain HTML, React, Vue, Svelte, Astro, …). What's fixed and reusable is the Open Pulse **skills** and the **design system**; everything else is yours.

---

## Repository layout

```
open-pulse-webkit/
├── .claude/            # canonical agent config (EDIT HERE)
│   ├── PROJECT.md      #   mission + data-source overview
│   ├── SKILLS.md       #   concrete task recipes
│   ├── settings.json   #   permissions + enabled MCP servers
│   └── skills/         #   the 9 skills
├── .agents/            # generated mirror for AGENTS.md-standard tools + Pi (DO NOT EDIT)
├── CLAUDE.md           # repo conventions (canonical)
├── AGENTS.md           # generated mirror of CLAUDE.md
├── .mcp.json           # Playwright MCP server (UI verification)
├── .devcontainer/      # reproducible dev environment
├── .env.example        # Open Pulse endpoints + credentials
├── tools/
│   └── sync-agents.mjs # regenerates .agents/ from .claude/
└── src/
    └── your-web/       # ← your web app, any framework (see status)
```

---

## Publishing to GitHub Pages

The app is designed to be published as a **static site on GitHub Pages** — no server to run, free hosting straight from your repo.

1. **Build a static bundle.** Configure your framework's static/export build (e.g. a static adapter, `vite build`, `astro build`, etc.) to output to a `dist/` (or `build/`) folder. If your app isn't served from the domain root, set the base path to your repo name (`/<your-repo>/`).
2. **Add a Pages deploy workflow.** A minimal GitHub Actions workflow that builds and publishes via `actions/deploy-pages`:
   ```yaml
   # .github/workflows/pages.yml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     build:
       runs-on: ubuntu-latest
       defaults: { run: { working-directory: src/your-web } }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: "20" }
         - run: npm ci
         - run: npm run build        # outputs the static bundle
         - uses: actions/upload-pages-artifact@v3
           with: { path: src/your-web/dist }   # adjust to your build output
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
3. **Enable Pages.** Repo → *Settings → Pages → Build and deployment → Source: GitHub Actions*.

> **Live data on a static host.** GitHub Pages serves static files only — there is **no server runtime**, so a browser-side call can't safely hold Open Pulse credentials. Pick one:
> - **Pre-build snapshots** — query Open Pulse at build time and commit/ship the results as static JSON. Best for dashboards that don't need real-time data.
> - **External proxy** — host the credential-holding proxy elsewhere (a serverless function, a small API) and have the static site fetch from it.
>
> (There is intentionally **no public dev tunnel** in this template — publishing is via Pages.)

---

## Dev notes

- **Editing agent config:** edit `.claude/` only, then run `node tools/sync-agents.mjs` to regenerate `.agents/` + `AGENTS.md`. The `agents-sync` CI job fails if they drift.
- **Node on PATH:** the sync script needs Node; if `node` isn't on your PATH, call it with a full path to a local Node binary. CI uses its own Node.
- **Never commit `.env`** — it holds Open Pulse credentials. Only `.env.example` is tracked.

---

## Status

This template is **under construction**. What's ready today: the agent toolkit (skills + docs), the dual-runtime sync, the devcontainer, and the env/MCP scaffolding. The web app in `src/your-web/` is **not yet scaffolded** — that's the next milestone, and it's framework-agnostic (you choose the stack). The docs describe the intended structure so the agent (and you) can build toward it.

---

## License

See [LICENSE](./LICENSE).
