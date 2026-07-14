# Scaffold checklist — turning the approved plan into a running dashboard

The concrete recipe for Stage 6. It does **not** repeat the framework-agnostic mechanics —
those live in `frontend-dev` §8 (token/font/shell order, the `--op-*` contract) and §7 (the
two required components). This file adds the *dashboard-specific* layer on top: what to build,
in what order, fed by what data, so the wizard produces the same solid starting app every time.

Build in this order — each step is verifiable with a Playwright screenshot before the next.

## 1. Snapshot first — data before UI

Nothing gets hardcoded. Write `scripts/fetch-data.mjs` following `.agents/SKILLS.md` §10 and
run it before building any page:

- **Resolve the scope as data** (SKILLS.md §10): a set of GitHub orgs (Neo4j `OWNS`), a
  GrimoireLab project tag, a SPARQL facet (`op:discipline` / `op:ownedBy`), or an explicit repo
  list. Use the same `.env` + HTTP transports as the `query-*` skill scripts — credentials stay
  at build time; the browser never touches the stores.
- **Emit only the snapshots the approved themes need.** The usual set: `summary.json` (headline
  numbers), `repos.json` (catalogue), `graph.json` (trimmed nodes/edges), `health.json` (monthly
  series + per-repo table), `impact.json` (funnel + linked articles), `coverage.json` (gap lists).
  Don't bake a snapshot for a theme that didn't make v1.
- **Apply the §9 data rules at fetch time**: exclude vendored forks from health series (keep them
  badged in the catalogue), resolve `op:discipline` QIDs to labels, trim the graph in the script
  (record what was dropped in a `stats` block).
- **Stamp every file** with `fetchedAt` + scope metadata and **print row counts as it runs** —
  then eyeball those counts against the Stage 3 recon table. A count of 0 where Stage 3 promised
  data means stop and reconcile, not ship an empty section.

## 2. Shell & tokens — `frontend-dev` §8

Scaffold the chosen framework in `src/your-web/`, then follow `frontend-dev` §8 verbatim:
copy the active design skill's `assets/tokens.css` into the `:root` block (mirror into the
utility framework if used), install and import the named fonts, and stand up the shell. The
**attribution bar** (`frontend-dev` §7) sits at the top of every route with the build-time
ISO-8601 UTC timestamp injected per §6 — never computed in the browser.

## 3. Landing page — "<Scope> at a glance"

Required (see `dashboard-skeleton.md`). Fed entirely by `summary.json` + `graph.json`. Shape it
to the Stage 1 posture:

- **Storytelling / hybrid** — a narrative lede, 5–6 large headline numbers with a one-line
  takeaway each, and one signature visual (the collaboration graph or a discipline treemap).
- **Stats reference** — a dense headline stat-tile row, no prose padding.

Either way, in the **primary viewer's vocabulary** (leadership → impact/coverage; developers →
health/activity; public → plain language), and **every headline links down into its theme**.

## 4. Theme pages — one per approved theme

For each theme from the plan, stub a page with:

- its headline metric **wired to the real snapshot** (not a placeholder),
- a clearly-marked `TODO` body for the drill-down detail,
- the shared **provenance disclosure** (`frontend-dev` §7) on every data card — the same
  `<details>` with *Source / Method / Refresh / Caveats*, never bespoke per-section text,
- honest empties: render "not computable — <why>" instead of an empty chart (SKILLS.md §9).

## 5. Fixed cross-cutting pieces (always, regardless of theme selection)

- **"What's missing?" coverage panel** fed by `coverage.json` — a first-class data-quality view,
  not a footnote (`dashboard-skeleton.md`).
- **Provenance disclosure** on every Open-Pulse-derived number (step 4).
- **Attribution bar** on every route (step 2).

## 6. Verify — browser, not build

Walk every affected route through Playwright MCP (`frontend-dev` §4): navigate, screenshot
against the design skill's spec, watch the console for runtime/network errors. A passing
type-check/build is a correctness gate, not a feature-correctness gate.

## Definition of done

- [ ] `scripts/fetch-data.mjs` runs clean and its row counts match Stage 3.
- [ ] Every headline number traces to a snapshot file — zero hardcoded figures.
- [ ] Attribution bar (build-time UTC) on every route.
- [ ] Provenance disclosure on every data card; coverage panel present.
- [ ] Landing page matches the Stage 1 posture and links down to each theme.
- [ ] Every route screenshotted in the browser with a clean console.
