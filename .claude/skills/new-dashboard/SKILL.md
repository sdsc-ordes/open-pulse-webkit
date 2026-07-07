---
name: new-dashboard
description: Guided wizard that interviews the user and scaffolds an Open Pulse dashboard in src/your-web/ — asks about scope, design intent, drill-down themes, stack, and publishing; verifies data coverage in the stores before promising sections; then scaffolds, wires real data, and verifies in the browser. TRIGGER when the user wants to start a new dashboard or site on Open Pulse, asks "where do I start?", or wants help deciding what to build. SKIP when they ask a specific data question (query-* / op-* skills) or a specific UI task on an already-scaffolded app (frontend-dev).
---

# New Dashboard wizard

Walk the user from "I want a dashboard" to a running, verified scaffold — one decision at a time. You drive the interview: make concrete suggestions, ask one stage's questions at a time, and always offer options rather than open-ended prompts.

## Ground rules

- Ask with the **AskUserQuestion tool** when your runtime has it — one call per stage, at most 4 options per question, `multiSelect` where noted; the tool adds an "Other" free-text escape automatically. On runtimes without a structured question tool, ask the same questions in plain text and wait.
- After each stage, restate the outcome in one sentence before moving on, so the user can correct course cheaply.
- **Data before promises.** Never commit to a dashboard section until Stage 3 has confirmed the stores actually cover the user's scope. An empty section kills trust in the whole dashboard.
- Follow the repo defaults from `CLAUDE.md`: static-first (GitHub Pages, no server runtime), build-time data snapshots, D3 for bespoke interactive charts, the required attribution bar, and `--op-*` design tokens only.
- Before writing any UI, read the `frontend-dev` skill and the active design skill declared in `CLAUDE.md` (if those design skills are installed).

## Stage 0 — Situational check (no questions yet)

Look at `src/your-web/`. If an app already exists there, ask whether to **extend it** or **start fresh** before anything else. If `.env` is missing at the project root, tell the user to copy `.env.example` → `.env` and fill in credentials now — Stage 3 needs live store access.

## Stage 1 — Scope, audience & story

One AskUserQuestion call, four questions:

1. **"What slice of the Open Pulse data should this dashboard tell the story of?"**
   Options: a school/institute/lab cluster · a single organisation or product · a topic or discipline · the whole platform. (These map to the theme structures in `CLAUDE.md` §*Reference outcome*.)
2. **"Who is the primary viewer?"**
   Options: research leadership & funders · the researchers/developers whose work it shows · the broader public & community · a mixed audience. This drives vocabulary and metric choice: leadership/funders care about impact, outcomes, and coverage; developers care about health, activity, and dependencies; a public audience needs plain language and zero unexplained jargon.
3. **"Should it lean storytelling or stats?"**
   Options: "Hybrid — a narrative landing, dense drill-downs (Recommended)" · "Storytelling — a guided narrative with annotated highlights" · "Stats reference — dense numbers, tables, filters". Consequences: *storytelling* means fewer, larger numbers, one signature visual per theme, written takeaways next to every chart, and a deliberate reading order; *stats reference* means tile grids, filterable tables, exact values, and no prose padding; *hybrid* puts the story on the landing page and the density one click down.
4. **"Do you have a specific design in mind?"**
   Options: "Yes — I'll describe it (or paste a link/screenshot)" · "Show me the reference archetypes first" · "No — follow the SDSC design system and propose something".

If they picked "describe it", collect the description now and treat it as the design brief. If they picked "show me", present the three layout archetypes (full-page graph canvas · list/detail · card grid) as options with short ASCII `preview` mockups so they can compare side by side.

Then get the concrete scope: ask for the GitHub org(s)/repos, ROR institution, or topic keywords that define their slice.

## Stage 2 — Themes

First offer the reference skeleton. One question: **"Structure the dashboard on the proven skeleton?"** Options: "Yes — landing page + the 4 standard themes (Recommended)" · "Start from the skeleton but adapt the themes" · "No — design a custom theme set with me". The skeleton lives in `references/dashboard-skeleton.md` next to this file — read it before continuing when either of the first two is chosen. Its four themes: **The Landscape** (*what exists?*) · **People & Community** (*who's behind it?*) · **Health & Activity** (*how alive and healthy is it?* — the CHAOSS home) · **Research Impact** (*what does it produce?*).

- **Skeleton (or adapted):** confirm with one `multiSelect: true` question which of the four themes go in v1, and ask the skeleton's flagged framing decision — show all repository types, or lead with Software only? Never decide that silently.
- **Custom:** propose 3–5 drill-down themes matched to their scope type, phrased as questions **the Stage 1 viewer would actually ask** (see `CLAUDE.md` §*Reference outcome* for the per-scope structures), then confirm with `multiSelect: true`.

Either way, let the story/stats answer shape the framing — for storytelling, order the themes as chapters with a one-line takeaway each; for stats, present them as metric groups — and always include the two fixed elements regardless of the answer: the **at-a-glance landing page** and the **"What's missing?" coverage panel**.

## Stage 3 — Data reconnaissance (do the work, then report)

Before promising anything, verify coverage with the query skills against the user's scope:

- `query-neo4j` — does the org/repo set exist in the graph? How many repos, contributors, edges? Remember: identifier properties hold **full GitHub URLs**, not slugs.
- `query-opensearch` — commit history depth for the scope (time series live here, not in Neo4j).
- `query-sparql` / `op-collections` — publications, ORCID/ROR links, other metadata for the scope.
- `query-chaoss` — spot-check 2–3 metrics on the scope's flagship repos.

Watch for the classic traps: **forks inflating repo counts** (check `FORK_OF` / fork flags and say which number you report), **sparse publication links** (a software→papers theme may need to be reframed as a coverage panel), and hub API result caps. Report what you found in a short table — *theme → data present? → caveat* — and ask one question: proceed with these themes, or adjust?

## Stage 4 — Stack & publishing

One AskUserQuestion call:

1. **Framework** — suggest what fits their design brief; options like "Plain HTML/CSS/JS (lightest)" · "Svelte" · "React" · "Astro". Any choice is fine; the design system is framework-neutral.
2. **Publishing** — "Static, GitHub Pages (recommended)" · "Live queries via a server-side proxy". If static: plan a build-time snapshot script (`scripts/fetch-data.mjs`, see `.claude/SKILLS.md` §1 note) that queries the stores with the same transports as the `query-*` skills and writes typed JSON into `src/data/` — credentials stay at build time. If live: credentials must sit behind a server endpoint the browser calls; never in client code.

## Stage 5 — Scaffold, wire, verify

Now build, without further questions unless something contradicts an earlier answer:

1. Scaffold the chosen framework in `src/your-web/` with the attribution bar (build-time ISO-8601 UTC timestamp), design tokens, and the landing page fed by **real snapshot data from Stage 3** — no lorem-ipsum numbers. Shape the landing to the Stage 1 posture: a narrative lede with annotated highlights (storytelling/hybrid) or a headline stat-tile row (stats reference), written in the primary viewer's vocabulary.
2. Stub each chosen theme page with its headline metric wired to real data and a clearly-marked TODO body.
3. Verify in the browser (Playwright MCP when available — navigate, screenshot, check the console). A passing build is not verification.
4. Close by reporting what was built, what data feeds it, and the 2–3 highest-leverage next steps (usually: flesh out theme #1, add the coverage panel, set up the Pages deploy workflow).

## Tone

Suggest, don't interrogate: every question should carry a recommended default ("(Recommended)" as the first option). Keep each stage's message short — the user is choosing, not reading a report.
