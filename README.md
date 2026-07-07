# pulseWebKit

**A starter template for building interactive dashboards on top of [Open Pulse](https://openpulse.science) — with an AI coding agent doing most of the work.**

---

## What is this?

[Open Pulse](https://openpulse.science) is a research-software-observability platform maintained by the Swiss Data Science Center (SDSC). It holds data about research code — repositories, contributors, commits, organisations, publications — across three databases (a graph, an RDF triplestore, and a search index), plus higher-level APIs for health metrics, semantic search, and indexed collections.

**Two URLs — different jobs:**

| URL | Role |
|---|---|
| **[openpulse.science](https://openpulse.science)** | The project's **main public page** — documentation, marketing, ontology namespaces. Downstream apps built from this template link here in the required attribution bar. |
| **[openpulse.epfl.ch](https://openpulse.epfl.ch)** | The **first live deployment node** — where Neo4j, SPARQL, OpenSearch, the CHAOSS metrics API, collections, extractor, and crawler run. Skills and `.env` point here. |

**pulseWebKit is the easiest way to build your own view on top of that data.** Click *"Use this template"*, open the repo in your AI coding agent of choice, and ask it to build the dashboard you want. The agent already knows how to talk to Open Pulse, because this repo ships a set of **skills** — small, documented helpers that let the agent query each data store safely.

You don't need to learn the Open Pulse APIs. You describe the dashboard; the agent uses the skills to fetch real data and wires up the UI.

---

## What's in the box

| | What it is | Where |
|---|---|---|
| 🧠 **Agent skills** | 10 ready-to-use skills the agent can call to query Open Pulse (Neo4j graph, SPARQL metadata, OpenSearch, semantic search, [CHAOSS health metrics](https://openpulse.epfl.ch/chaoss), the crawler, the extractor, collections) and to do frontend work | `.claude/skills/`, mirrored to `.agents/skills/` |
| 📋 **Project docs for agents** | `CLAUDE.md` / `AGENTS.md` (conventions), `PROJECT.md` (mission + data sources), `SKILLS.md` (task recipes) | repo root + `.claude/` / `.agents/` |
| 🎨 **Design system** | Swappable design skills + a fixed token contract, so generated UI looks on-brand and re-branding is a drop-in — see [Styling & the design system](#styling--the-design-system) | `frontend-dev` + `openpulse-dark-theme` + `sdsc-ui-kit` skills |
| 🐳 **Devcontainer** | Ubuntu dev image + Playwright MCP sidecar (VS Code / Codespaces) | `.devcontainer/` + `tools/image/docker/` |
| 🧪 **Playwright MCP** | Browser verification for agents — host (`npx`) or devcontainer (sidecar on `:8931`) | `.mcp.host.json` / `.mcp.docker.json` → `.mcp.json` |
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
   > *"Add a repo health page with CHAOSS metrics — contributors, closure ratio, absence factor, license coverage, and release frequency."*

   The agent will use the `query-chaoss` and `query-*` skills to pull real data from `openpulse.epfl.ch` and the `frontend-dev` skill plus the active design skill to build the UI on-brand (linking to `openpulse.science` in the attribution bar).
4. Run the app locally (once it's scaffolded — see status below):
   ```bash
   cd src/your-web
   npm install
   npm run dev      # local dev server
   ```

> **Bring your own framework.** This template doesn't prescribe a UI stack — the app lives in `src/your-web/` and you build it with whatever you like (plain HTML, React, Vue, Svelte, Astro, …). What's fixed and reusable is the Open Pulse **skills** and the **design system**; everything else is yours.

### Devcontainer & Playwright MCP

Open in VS Code / Codespaces with the **Dev Containers** extension — `.devcontainer/devcontainer.json` points at `tools/image/docker/docker-compose.yml`:

| Service | Image | Role |
|---|---|---|
| `web` | Ubuntu 24.04 + Node 22 + Python 3 | Dev workspace (skills, scaffolding) |
| `playwright-mcp` | `mcr.microsoft.com/playwright/mcp` | Headless Chromium for UI verification |

On first create, `post-create` copies `.mcp.docker.json` → `.mcp.json` so agents talk to the sidecar at `http://localhost:8931/mcp`.

**On the host** (no container), `.mcp.json` defaults to `.mcp.host.json` (stdio `npx`). Install Chromium once:

```bash
npx playwright install chromium
bash tools/image/docker/setup-mcp.sh host   # only if .mcp.json was switched by a prior devcontainer session
```

---

## Styling & the design system

A brand is delivered to the agent **as a skill** (`.claude/skills/<name>/`), so re-branding means dropping in a new design skill and updating one line in `CLAUDE.md` — not rewriting app code. The app only ever references a fixed set of `--op-*` **token names** (the contract, defined in the `frontend-dev` skill); the active design skill supplies the values. The kit ships:

| Skill | Role | What it is |
|---|---|---|
| **`frontend-dev`** | Engineering (brand-agnostic) | The token contract, font-loading mechanics, canvas/D3 rules, required shared components, Playwright verification. No design values — it never changes when the brand does |
| **`openpulse-dark-theme`** *(active design skill)* | Theme | The permanent-dark Open Pulse dashboard look: `--op-*` token values on a near-black canvas, graph-explorer canvas rules, the "How is this computed?" provenance disclosure, and a named list of deliberate deviations from its base brand |
| **`sdsc-ui-kit`** | Base brand | The general SDSC brand system from [datascience.ch](https://datascience.ch) — ground truth for brand colours, typography, buttons, form inputs, layout patterns |

All three are **framework-agnostic** — the spec is CSS custom properties plus plain HTML/CSS patterns, so it maps onto any stack (vanilla CSS, Tailwind, React, Svelte, Vue, web components, …).

Rules the agent holds to **under any design skill**:

- **All colours come from the `--op-*` contract tokens.** Never hardcode hex in markup — canvas/SVG drawing code is the only exception.
- **Fonts are tokens too** (`--op-font-heading/body/mono`), loaded from the npm packages the design skill names — no CDN fonts, so the static build stays self-contained.
- **Attribution bar** (required): every page tops out with `Built using openpulse.science at <build timestamp>`, the timestamp injected at build time.
- **Provenance disclosure** (required): every data card carries the same compact "How is this computed?" component (source / method / refresh / caveats).

What the shipped SDSC theme adds on top: Space Grotesk headings, Switzer UI text, JetBrains Mono for code/IDs; sharp corners with only buttons and badges at a subtle 4 px radius; two brand blues as the only interactive chrome colour, status colours confined to badges and toasts, and the data-viz palette confined to chart and graph canvases.

**Bring your own brand:** package your design system as a skill (`SKILL.md` + an `assets/tokens.css` implementing the token contract), point your app's `:root` at your token file, and flip the *Active design skill* line in `CLAUDE.md` — the agent and app adapt automatically. The step-by-step recipe is `.claude/SKILLS.md` §11.

---

## CHAOSS health metrics (featured dashboard)

The hub at `openpulse.epfl.ch` computes **35 CHAOSS metrics** live per GitHub repository (or aggregated per GrimoireLab project) by unifying the three stores. Browse them at [openpulse.epfl.ch/chaoss](https://openpulse.epfl.ch/chaoss); query them via the `query-chaoss` skill. Full API detail is in `.claude/skills/query-chaoss/SKILL.md` and `.claude/PROJECT.md`.

This template is designed around a **featured dashboard set** across three buckets:

**Community** — *is the project alive & kicking?*
Activity dates, contributors, change-request closure ratio, issue/PR response times, change-request reviews, new contributors, merged change requests, organizational diversity, committers, contributor absence factor (bus factor).

**Popularity** — *who sees, uses & reuses it?*
Academic impact, project popularity, technical forks. *(Clones, package downloads, job-posting demand, and recommendability scores are not in the API yet.)*

**Quality** — *can others understand & reuse it?*
Documentation discoverability, license coverage, licenses declared, programming languages, release frequency, test coverage, upstream code dependencies.

```bash
# All 35 metrics for one repo
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie

# One metric, custom window
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie closure_ratio --window 30
```

---

## Repository layout

```
open-pulse-webkit/
├── .claude/            # canonical agent config (EDIT HERE)
│   ├── PROJECT.md      #   mission, URLs, data sources + CHAOSS dashboard
│   ├── SKILLS.md       #   concrete task recipes
│   ├── settings.json   #   permissions + enabled MCP servers
│   └── skills/         #   the 11 skills (incl. the design-skill system — see Styling)
├── .agents/            # generated mirror for AGENTS.md-standard tools + Pi (DO NOT EDIT)
├── CLAUDE.md           # repo conventions (canonical)
├── AGENTS.md           # generated mirror of CLAUDE.md
├── .mcp.json           # active Playwright MCP config (host default)
├── .mcp.host.json      # host: stdio npx
├── .mcp.docker.json    # devcontainer: HTTP sidecar on :8931
├── .devcontainer/      # devcontainer entry (compose in tools/image/docker/)
├── .env.example        # Open Pulse endpoints + credentials
├── tools/
│   ├── image/docker/   # Dockerfile, compose, setup-mcp.sh
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

This template is **under construction**. What's ready today: the agent toolkit (skills + docs), the dual-runtime sync, the devcontainer (Ubuntu + Playwright sidecar), and the env/MCP scaffolding. The web app in `src/your-web/` is **not yet scaffolded** — that's the next milestone, and it's framework-agnostic (you choose the stack). The docs describe the intended structure so the agent (and you) can build toward it.

---

## License

See [LICENSE](./LICENSE).
