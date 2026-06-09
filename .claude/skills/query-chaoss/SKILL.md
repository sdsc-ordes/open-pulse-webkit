---
name: query-chaoss
description: Query the Open Pulse CHAOSS Metrics API — 35 community/popularity/quality metrics computed live per GitHub repository or per GrimoireLab project, over the Neo4j+SPARQL+OpenSearch stores. TRIGGER when the user asks for a ready-made health/community/popularity/quality metric on a repo or project (contributors, bus/absence factor, first-response time, issue/PR throughput, license coverage, release frequency, academic impact, etc.), or asks to browse the metric catalogue. SKIP when they want a raw Cypher/SPARQL/DSL query against a single store (use query-neo4j / query-sparql / query-opensearch) rather than a pre-computed CHAOSS metric.
---

# Query CHAOSS Metrics (Open Pulse hub)

This skill ships two equivalent scripts that hit the Open Pulse CHAOSS Metrics API. Every endpoint is a `GET` returning JSON, computed live by the hub on top of the three stores (Neo4j + Oxigraph/SPARQL + OpenSearch). Both scripts read `CHAOSS_ENDPOINT` (base URL, e.g. `https://openpulse.epfl.ch`) and `CHAOSS_AUTH` (format `user/password`) from `.env` at the repo root.

Auth is **HTTP Basic, password-only** — the username is ignored, only the password matters. The read-only password `read-me-only` is enough for every query here. So `CHAOSS_AUTH=dev/read-me-only` works.

```
.claude/skills/query-chaoss/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

> Prefer the live API over re-deriving these numbers by hand. The hub already unifies the three stores per metric (e.g. "largest non-zero of OpenSearch / SPARQL / Neo4j") and exposes the exact store queries via `include=traces` — only drop down to `query-neo4j`/`query-sparql`/`query-opensearch` when you need a value the catalogue doesn't compute.

## Run

```bash
# Catalogue (static specs) — all 35, the 3 topic buckets, or one spec
python .claude/skills/query-chaoss/query.py catalogue
python .claude/skills/query-chaoss/query.py catalogue --category Quality
python .claude/skills/query-chaoss/query.py topics
python .claude/skills/query-chaoss/query.py spec contributors

# Per repository — all metrics, or one slug
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie contributors --window 730
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie contributors --include traces,recipes,series

# Per project — list, all metrics, one slug, or member repos
python .claude/skills/query-chaoss/query.py projects
python .claude/skills/query-chaoss/query.py project bioeng
python .claude/skills/query-chaoss/query.py project bioeng contributors --refresh
python .claude/skills/query-chaoss/query.py project-repos protein_ai_ecosystem

# Arbitrary path fall-through (relative to /api/v1/metrics/chaoss, or absolute with a leading /)
python .claude/skills/query-chaoss/query.py get repositories/github.com/sdsc-ordes/gimie/metrics

# Node equivalent (same subcommands + flags)
node .claude/skills/query-chaoss/query.mjs repo sdsc-ordes gimie contributors
```

Output is the API's JSON, pretty-printed. `--raw` prints the body verbatim. Errors print `http <code>: <body>` to stderr and exit non-zero — surface them verbatim.

## Query-param flags

| Flag | Maps to | Notes |
|---|---|---|
| `--window N` | `window=N` | default 365; **snaps** to 30/90/180/365/730/1825/3650 |
| `--include a,b,c` | `include=…` | add `traces` (exact store queries), `recipes` (repro scripts: `python`/`js`/`bash`), `series` (time-series) to metric payloads |
| `--refresh` | `refresh=1` | **project endpoints only** — bypass the 30-min aggregation cache |
| `--category X` | `category=…` | `Community` \| `Popularity` \| `Quality` — filter catalogue/lists |
| `--param k=v` | `k=v` | escape hatch for any param not modelled above (repeatable) |

## The 35 metrics

Three topic buckets. Every metric is windowed unless noted as a lifetime/snapshot value. Fetch the live, authoritative spec for any one with `spec <slug>` (or the whole set with `catalogue`) — the one-liners below are a map, not the source of truth. The **Store** column is where the headline number is computed (OS = OpenSearch/GrimoireLab, SP = SPARQL, N4 = Neo4j); several metrics reconcile more than one store via the `unification` field.

### Community (19) — *is the project alive & kicking?*

| slug | Measures | Store |
|---|---|---|
| `contributors` | Distinct people who contributed in the window | OS·SP·N4 |
| `new_contributors` | People whose **first** contribution falls inside the window (growth) | SP·OS |
| `committers` | Distinct people who **landed** commits (`committer_name`) — narrower than contributors | OS |
| `inactive_contributors` | Past contributors whose last commit predates the window | OS |
| `occasional_contributors` | Drive-by authors: ≤4 commits in the window (outreach vs retention) | OS |
| `absence_factor` | **Bus factor** — fewest contributors making ≥50% of commits; low = risk | OS |
| `org_diversity` | Distinct orgs in the contributor pool (single-vendor vs distributed) | SP |
| `project_demographics` | Pool breakdown: total / core (top 80%) / recent (<90d) / dormant (>180d) | OS |
| `activity_dates` | Monthly commit histogram (steady vs bursty) — rendered as a sparkline | OS |
| `burstiness` | Goh–Barabási B on commit inter-arrival: −1 periodic, 0 random, +1 bursty | OS |
| `first_response` | Median hours to first non-bot, non-author reply on a PR/issue | OS |
| `issue_response_time` | Median hours to first reply, **issues only** | OS |
| `issue_resolution` | Median days from issue open → close (PRs excluded) | OS |
| `closure_ratio` | Closed / total PRs in window (merged vs closed split in secondary) | OS |
| `issues_new` | Issues opened in the window (backlog inflow) | OS |
| `issues_active` | Issues with any update — comment/label/state change (liveness) | OS |
| `issues_closed` | Issues closed in the window (backlog outflow) | OS |
| `cr_duration` | Median days PR open → **merge** (merge-only; acceptance speed) | OS |
| `pr_time_to_close` | Median days PR open → close (**all** closed: merged + declined) | OS |

### Popularity (3) — *who sees, uses & reuses it?*

| slug | Measures | Store |
|---|---|---|
| `project_popularity` | Composite: stars + forks (SPARQL) + dependents (inbound `DEPENDS_ON`) | SP·N4 |
| `technical_fork` | Total fork count (GitHub-reported via SPARQL; in-graph subset via Neo4j) | SP·N4 |
| `academic_impact` | Scholarly articles whose authors also contribute to the repo | SP |

### Quality (13) — *can others understand & reuse it?*

| slug | Measures | Store |
|---|---|---|
| `licenses_declared` | Whether ≥1 license is declared (`schema:license` triple) | SP |
| `license_coverage` | Declares an SPDX license (per-repo yes/no; project mean = share licensed) | SP |
| `programming_languages` | Distinct declared languages (presence-set, no byte shares) | SP |
| `code_lines` | Lines added + removed in window; file-change count in secondary | OS |
| `docs_discoverability` | Scores 4 signals: README, homepage/docs, wiki, GitHub Pages | SP |
| `test_coverage` | Static coverage % advertised in README (shields badge / `coverage: NN%`) | SP |
| `release_frequency` | Lifetime release cadence (releases/year, first→latest release) | SP |
| `upstream_dependencies` | Distinct upstream repos depended on (`DEPENDS_ON` graph) | N4 |
| `cr_reviews` | PRs with ≥1 non-bot review comment (pair with `self_merge`) | OS |
| `cr_accepted` | Merged PRs in window (acceptance half of `closure_ratio`) | OS |
| `cr_declined` | PRs closed without merging (rejections / stale cleanup) | OS |
| `self_merge` | Fraction of merged PRs the author merged themselves — review-culture signal | OS |
| `bot_activity` | Share of commits by recognised bots (dependabot, renovate, `*[bot]`, …) | OS |

> **Phase / freshness note:** the issue/PR-based rows (`first_response`, `issue_*`, `issues_*`, `cr_*`, `pr_time_to_close`, `closure_ratio`, `self_merge`) and the newest signals (`test_coverage`, `release_frequency`) depend on GitHub-backend enrichment that is sparse in the current 2026-05 snapshot — expect `"—"` for many repos until a re-extraction lands.

## Response shape (verified 2026-06-08)

A **single repo metric** carries the spec fields (`slug`, `name`, `category`, `chaoss_topic`, `question`, `description`, `chaoss_url`, `is_time_based`) plus the computed result:

- `value` — **a display string** (`"6"`, `"72%"`, `"4.2 h"`, `"—"`). `"—"` means *no data*, **never 0** — don't read it as zero.
- `secondary` — per-store breakdown, e.g. `"Neo4j (all-time): 10 · SPARQL (windowed): 0 · OpenSearch (windowed): 6"`.
- `label` — which store/window produced the headline (e.g. `"last 730 days · OpenSearch"`).
- `unification` — prose explaining how the three stores were reconciled into `value`.
- `headline_tone`, `notes`, `window_days`, `computed_at`, `canonical_url`.
- With `--include`: `visual` (block to render), `traces[]` (`store`/`engine`/`query`/`result_summary`), `recipes` (`python`/`js`/`bash`), `series[]` (`date`/`value`/`series_unit`).

**All repo metrics** returns `{repo, canonical_url, window_days, computed_at, metric_count: 35, metrics: [...]}` (each entry is one metric object as above).

A **project metric** adds `repo_count`, `truncated`, `cached_at`, and an `aggregate` block: `{rule: "sum"|…, n_repos, n_with_value, sum, mean, min, max, value, …}`. **`n_with_value`** tells you how many member repos actually had data — lean on it, since distinct-people counts carry an `approx` flag.

## Live state (verified 2026-06-08)

- The hub serves the **2026-05 snapshot**. The newest signals (`test_coverage`, `release_frequency`) and the issue/PR-based metrics (`first_response`, `cr_*`, `issues_*`) read `"—"` for most repos until a fresh re-extraction lands — **expect them sparse**.
- Repos are **GitHub-only**: `repo <owner> <repo>` → `/repositories/github.com/...`.
- Projects are discipline/topic buckets of repos. **The set and count change over time, so always read it from `projects` — never hardcode a number.** At time of writing the largest are `info-eng` (~109 repos), `bioeng` (~95), `stats` (~63), with domain-relevant ones like `protein_ai_ecosystem` (~26), `bio` (~42), `chem` (~10). Use the exact `project` slug returned by `projects` (e.g. `protein_ai_ecosystem`, not `protein-ai`). `project-repos <project>` returns the project header plus both a `metrics[]` summary and a `repositories[]` list.
- A browsable UI to explore first: `https://openpulse.epfl.ch/chaoss` (same auth).

## Conventions

- **Treat `value` as a string.** For numbers, parse `value` or read the `visual` block — and remember `"—"` ≠ 0.
- This API is **read-only and GET-only**; there is nothing to mutate. The read password suffices.
- `--window` snaps server-side — passing 400 lands on 365; don't expect arbitrary windows.
- Project aggregates are cached 30 min; add `--refresh` only when you need a recompute, since it's slower.
