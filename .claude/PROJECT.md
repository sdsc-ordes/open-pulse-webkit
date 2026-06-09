# PROJECT.md — pulseWebKit (Open Pulse web app template)

Longer-form project context for agents. Companion to root `CLAUDE.md` (which covers conventions & dev workflow) and `.claude/SKILLS.md` (which covers concrete how-tos).

---

## Mission

**pulseWebKit** (working name: *pulseNext*) is a starter, intended to be published as a **GitHub template repository**, so that researchers and developers can build their own dashboards or interactive websites that pull variables from the **Open Pulse** platform.

Two audiences read this codebase:

1. **The SDSC team at EPFL/ETH Zürich**, who use views like the Graph Explorer to operate and showcase the live Open Pulse deployment at `openpulse.epfl.ch`.
2. **Downstream users** — anyone who clicks "Use this template" on GitHub to spin up a new project. They will build their own views and expect this codebase to demonstrate idiomatic, reusable patterns.

When deciding between "this is a one-off feature" vs. "this is a pattern others will follow", err toward the second. Naming, file layout, abstractions, and design tokens should generalise.

**Framework-neutral by design.** The template deliberately does not commit to a UI framework. The web app lives in `src/your-web/` and the downstream user picks their own stack. What the template *does* provide and standardise is framework-independent: the **Open Pulse query skills** and the **SDSC design system** (the `frontend-dev` skill). Keep those stable; treat the app shell as replaceable.

---

## The Open Pulse platform (data layer)

Open Pulse is a research-software-observability stack maintained by SDSC. The app does not own data — it surfaces it from three live stores deployed at `openpulse.epfl.ch`. All three live behind plain HTTP/HTTPS on internal ports; the `.env.example` documents the exact endpoints and the auth conventions (`replace-me` upstream placeholders).

### Neo4j — the property graph

- **Endpoints:** `:7503` (HTTP/REST/browser), `:7504` (Bolt for official drivers)
- **Contents:** Repositories, Contributors/Persons, Commits, Organisations, PullRequests, and the relationships between them
- **Use it for:** "Who contributed to what, when?" questions; graph traversal; visualisations of collaboration over time
- **Skill:** `query-neo4j` (Cypher → JSON rows). Always include `LIMIT` on exploratory queries — the graph has tens of thousands of nodes.

### Oxigraph (SPARQL) — RDF metadata

- **Endpoint:** `:7502`, behind a Caddy proxy that terminates HTTP-Basic auth (`/query` for reads, `/update` for writes)
- **Contents:** ~300k triples across multiple named graphs (e.g. `http://open-pulse/repos`, `http://open-pulse/metadata`)
- **Use it for:** Structured metadata, vocabulary/ontology queries, anything that benefits from `SELECT … WHERE { GRAPH ?g { … } }`
- **Skill:** `query-sparql` (SELECT/ASK/CONSTRUCT/DESCRIBE). Updates are intentionally not supported by the skill — use `curl` explicitly if you need to mutate.

### OpenSearch — search & enriched indices

- **Endpoint:** `:9200`, OpenSearch 3.x with the security plugin and self-signed TLS (clients usually disable verification in dev)
- **Contents:** GrimoireLab-enriched indices — `git`, `git_enriched`, `github`, `github_enriched`, `github_pull_requests_enriched`, `github_repo_enriched`, etc.
- **Use it for:** Full-text search across commits/issues/PRs, aggregations over enriched fields, log-like investigations
- **Skill:** `query-opensearch` (health, indices, count, search DSL). Use `--size 0` for aggregation-only queries; `terms` aggs on strings need `.keyword`.

### Higher-level hub skills

Beyond the three raw stores, the Open Pulse hub exposes computed/aggregated APIs with their own skills: `op-collections` (indexed datasets), `op-search` (semantic/vector search), `query-chaoss` (CHAOSS health metrics), `op-crawler` and `op-extractor` (pipeline control). See each skill's `SKILL.md`.

### Pulling them together

The interesting thing this kit is meant to demonstrate is **pulling variables from across all stores into a single coherent view** — e.g. a per-repository panel combining Neo4j contributors, SPARQL metadata, and OpenSearch commit-frequency aggregates.

---

## Reference views (patterns the template demonstrates)

These views are intended both as working tools and as **pattern examples**. They are described by behaviour, not framework:

| View | Pattern it demonstrates |
|---|---|
| **Graph Explorer** | Reactive force-directed visualisation; temporal animation; full-page canvas layout |
| **List / detail** (e.g. pipeline runs) | List + detail; status badges; tables; shared shell |
| **Card grid** (e.g. service health) | Card grid; mixed-status surfaces (containers, endpoints, smoke tests) |

Together they cover the three layout archetypes a downstream user is most likely to need (full-page canvas, list/detail, card grid). Their visual specs live in the `frontend-dev` skill (§7–§8).

---

## How a downstream user is expected to extend this

When suggesting changes, keep these likely user journeys in mind:

1. **Scaffold the app** — choose a framework and scaffold it in `src/your-web/`, then apply the design system (`frontend-dev` skill §10 checklist).
2. **Wire to real data** — add a **server-side** layer (serverless function, small API, or framework server route) that holds Open Pulse credentials and proxies queries, so secrets never reach the browser. Point the client at that endpoint.
3. **Add a new domain-specific view** — follow `.claude/SKILLS.md §2` (Add a new page) and the API/data patterns in §1.
4. **Re-skin the design** — edit the `--op-*` CSS custom properties. The token convention exists so the rename to their own brand is a one-file change.
5. **Add a new data store** — e.g. PostgreSQL, a vector DB. Follow the skill pattern (`.claude/skills/query-*`) and the `.env.example` pattern.
6. **Publish** — build a static bundle and deploy to GitHub Pages (see the README's *Publishing to GitHub Pages* section).

If a change makes one of these journeys harder (e.g. couples the design system to a specific backend, hardcodes `--op-*` colour names into business logic, or assumes a server runtime that GitHub Pages doesn't provide), flag it.

---

## Non-goals

- This template is **not** an Open Pulse SDK or query-builder library — it demonstrates how to consume the platform, not how to abstract it.
- It does **not** prescribe a UI framework, CSS framework, or backend. Those are the downstream user's choice.
- No test runner is wired up; do not add one without explicit ask.

---

## Pointers

- **Conventions, stack-neutral dev workflow, what-not-to-do:** `CLAUDE.md` (repo root)
- **Concrete how-tos** (add page, add endpoint, add token): `.claude/SKILLS.md`
- **Visual rules**: the `frontend-dev` skill (`.claude/skills/frontend-dev/SKILL.md`)
- **Backend endpoints & credentials**: `.env.example`
- **Data store query skills**: `.claude/skills/query-{neo4j,sparql,opensearch}/SKILL.md`
- **Publishing**: README → *Publishing to GitHub Pages*
- **Devcontainer**: `.devcontainer/`
