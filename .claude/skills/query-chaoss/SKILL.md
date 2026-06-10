---
name: query-chaoss
description: Query the Open Pulse CHAOSS Metrics API — 35 community/popularity/quality metrics computed live per GitHub repository or per GrimoireLab project, over the Neo4j+SPARQL+OpenSearch stores. TRIGGER when the user asks for a ready-made health/community/popularity/quality metric on a repo or project — especially the featured dashboard set (activity dates, contributors, closure ratio, issue/PR response times, change-request reviews, new contributors, org diversity, committers, absence factor, academic impact, forks, popularity, docs discoverability, license coverage, programming languages, release frequency, test coverage, upstream dependencies). SKIP when they want a raw Cypher/SPARQL/DSL query against a single store (use query-neo4j / query-sparql / query-opensearch) rather than a pre-computed CHAOSS metric.
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

## Featured dashboard metrics

When building a repo health dashboard, **start here**. These are the headline CHAOSS cards the template targets — grouped by the three API topic buckets. Each row maps the **display name** → **slug**, the **default window**, what to read from the payload, and a **narrative pattern** (replace placeholders with live `value` / `secondary` / `visual` / `examples`).

Fetch the whole set in one call (default window 365 unless you re-query individual slugs with `--window`):

```bash
python .claude/skills/query-chaoss/query.py repo <owner> <repo>
```

For richer cards (sparklines, contributor bars, doc-signal checklist), add `--include series` on metrics that support it, or fetch all metrics then re-fetch individual slugs with the right flags.

### Community — *is the project alive & kicking?*

| Display name | slug | Default window | Read from payload | Narrative pattern |
|---|---|---|---|---|
| **Activity Dates and Times** | `activity_dates` | 365 | `value` = total commits; `secondary` = busiest month; `series[]` = monthly histogram | "Peak activity: {secondary}" — render `series` as a sparkline. Day-of-week / hour-of-day peaks are **not** in the API yet (monthly only). |
| **Contributors** | `contributors` | 365 | `value` = count; `examples[]` or `visual.bars` = top names; `secondary` = per-store breakdown | "{value} contributors" — list names from `examples` or `visual.bars` when present. |
| **Change Request Closure Ratio** | `closure_ratio` | 30 | `value` = % closed; `secondary` = merged vs declined split | "{value} of change requests closed within {window_days} days" |
| **Issue Response Time** | `issue_response_time` | 365 | `value` = median hours | "Median first response to issues: {value}" |
| **Change Request Reviews** | `cr_reviews` | 30 | `value` = reviewed PR count; pair with `cr_accepted` for avg | "{value} reviews this month" — divide `cr_reviews` by `cr_accepted` for "avg. N per change request" when both have data |
| **New Contributors** | `new_contributors` | 30 | `value` = first-time contributors in window | "{value} new contributors joined in the last month" |
| **Change Requests** | `cr_accepted` + `cr_declined` | 90 | `cr_accepted` = merged PRs; `cr_declined` = closed-without-merge | "{cr_accepted} merged this quarter" — **open** PR count is **not** a catalogue metric; use `query-opensearch` on the PR index if you need it |
| **Organizational Diversity** | `org_diversity` | snapshot | `value` = distinct org count | "Contributions from {value} organizations" |
| **Committers** | `committers` | 90 | `value` = distinct committers | "{value} committers pushed code in the last 90 days" |
| **Time to First Response** | `first_response` | 365 | `value` = median hours (PRs + issues) | "Average time to first reply: {value}" — sibling of `issue_response_time` but includes PRs |
| **Contributor Absence Factor** | `absence_factor` | 365 | `value` = bus-factor N; `secondary` = share line; `visual.kind=rank_bars` | "{value} contributors account for 50% of commits" — read exact share from `secondary` (e.g. "top 1 of 3 carry 62%") |
| **Types of Contributions** | — | — | **Not in API** | Code / docs / review % breakdown is not computed. Approximate with `code_lines` (code churn) + `cr_reviews` (review activity); docs share needs a custom query |

### Popularity — *who sees, uses & reuses it?*

| Display name | slug | Default window | Read from payload | Narrative pattern |
|---|---|---|---|---|
| **Academic Open Source Project Impact** | `academic_impact` | snapshot | `value` = paper count; `secondary` / `examples` for detail | "Cited in {value} papers" — JOSS/publication subtype not split in current spec |
| **Clones** | — | — | **Not in API** | GitHub clone traffic is not in the hub snapshot |
| **Number of Downloads** | — | — | **Not in API** | Package-registry downloads (PyPI, npm, …) are not indexed |
| **Organizational Project Skill Demand** | — | — | **Not in API** | Job-posting demand is not indexed |
| **Project Popularity** | `project_popularity` | snapshot | `value` = composite score; `secondary` = stars/forks/dependents | "Top {value} visibility" — read component breakdown from `secondary`; percentile ranking ("top 5%") is **not** computed |
| **Project Recommendability** | — | — | **Not in API** | Survey / scorecard data is not indexed |
| **Technical Fork** | `technical_fork` | snapshot | `value` = total forks; `secondary` = SPARQL vs Neo4j | "{value} forks" — active forks in last year needs a custom OpenSearch/Neo4j query |

### Quality — *can others understand & reuse it?*

| Display name | slug | Default window | Read from payload | Narrative pattern |
|---|---|---|---|---|
| **Documentation Discoverability** | `docs_discoverability` | snapshot | `value` = score (e.g. `4/4`); `secondary` = signal list; `examples[]` = per-signal yes/no | "README links to docs, API reference, and tutorials" — map from `examples` signals (README · homepage · wiki · Pages) |
| **License Coverage** | `license_coverage` | snapshot | `value` = yes/no or % at project level | "{value} of files have declared licenses" — per-repo is binary; project aggregate reads as mean share |
| **Licenses Declared** | `licenses_declared` | snapshot | `value` = count; `examples[]` = SPDX ids | "{license} declared" — e.g. "MIT license declared in LICENSE file" from `examples` |
| **Programming Language Distribution** | `programming_languages` | snapshot | `visual.kind=pill_cloud` or `examples[]` | "Python 62%, C++ 28%, …" — API currently returns a **presence set** (language names), not byte shares; say so honestly when shares aren't available |
| **Release Frequency** | `release_frequency` | snapshot | `value` = releases/year or count; `secondary` = date span | "{value} releases in the past 12 months" |
| **Test Coverage** | `test_coverage` | snapshot | `value` = % from README badge | "{value} line coverage on main branch" — parsed statically from README shields, not CI |
| **Upstream Code Dependencies** | `upstream_dependencies` | snapshot | `value` = direct dep count; `secondary` = outdated count if present | "{value} direct dependencies; {outdated} outdated" |

### Recommended windows for the dashboard

| User-facing period | `--window` |
|---|---|
| last month | `30` |
| last quarter | `90` |
| last 90 days (committers) | `90` |
| last year | `365` |
| all-time / snapshot | omit or `3650` (metrics with `is_time_based: false` ignore the window) |

Re-fetch individual slugs when the dashboard needs mixed windows (e.g. `closure_ratio --window 30` alongside `contributors --window 365`).

### Rendering hints (`visual` block)

Several featured slugs ship a `visual` object even without `--include` — use it when building UI cards:

| slug | `visual.kind` | Use for |
|---|---|---|
| `activity_dates` | (use `series[]`) | monthly sparkline |
| `absence_factor` | `rank_bars` | contributor commit-share bars + `headline_tone` |
| `docs_discoverability` | `donut` | fraction of doc signals present |
| `programming_languages` | `pill_cloud` | language tags |
| `license_coverage` | `donut` | licensed vs unlicensed |

Add `--include traces,series` when you need the exact store query behind a number or a time-series for charts.

## Full catalogue (35 metrics)

Three topic buckets. Every metric is windowed unless noted as a lifetime/snapshot value. Fetch the live, authoritative spec for any one with `spec <slug>` (or the whole set with `catalogue`) — the one-liners below are a map, not the source of truth. The **Store** column is where the headline number is computed (OS = OpenSearch/GrimoireLab, SP = SPARQL, N4 = Neo4j); several metrics reconcile more than one store via the `unification` field.

**Bold slugs** appear in the featured dashboard above.

### Community (19)

| slug | Measures | Store |
|---|---|---|
| **`contributors`** | Distinct people who contributed in the window | OS·SP·N4 |
| **`new_contributors`** | People whose **first** contribution falls inside the window (growth) | SP·OS |
| **`committers`** | Distinct people who **landed** commits (`committer_name`) — narrower than contributors | OS |
| `inactive_contributors` | Past contributors whose last commit predates the window | OS |
| `occasional_contributors` | Drive-by authors: ≤4 commits in the window (outreach vs retention) | OS |
| **`absence_factor`** | **Bus factor** — fewest contributors making ≥50% of commits; low = risk | OS |
| **`org_diversity`** | Distinct orgs in the contributor pool (single-vendor vs distributed) | SP |
| `project_demographics` | Pool breakdown: total / core (top 80%) / recent (<90d) / dormant (>180d) | OS |
| **`activity_dates`** | Monthly commit histogram (steady vs bursty) — rendered as a sparkline | OS |
| `burstiness` | Goh–Barabási B on commit inter-arrival: −1 periodic, 0 random, +1 bursty | OS |
| **`first_response`** | Median hours to first non-bot, non-author reply on a PR/issue | OS |
| **`issue_response_time`** | Median hours to first reply, **issues only** | OS |
| `issue_resolution` | Median days from issue open → close (PRs excluded) | OS |
| **`closure_ratio`** | Closed / total PRs in window (merged vs closed split in secondary) | OS |
| `issues_new` | Issues opened in the window (backlog inflow) | OS |
| `issues_active` | Issues with any update — comment/label/state change (liveness) | OS |
| `issues_closed` | Issues closed in the window (backlog outflow) | OS |
| `cr_duration` | Median days PR open → **merge** (merge-only; acceptance speed) | OS |
| `pr_time_to_close` | Median days PR open → close (**all** closed: merged + declined) | OS |

### Popularity (3)

| slug | Measures | Store |
|---|---|---|
| **`project_popularity`** | Composite: stars + forks (SPARQL) + dependents (inbound `DEPENDS_ON`) | SP·N4 |
| **`technical_fork`** | Total fork count (GitHub-reported via SPARQL; in-graph subset via Neo4j) | SP·N4 |
| **`academic_impact`** | Scholarly articles whose authors also contribute to the repo | SP |

### Quality (13)

| slug | Measures | Store |
|---|---|---|
| **`licenses_declared`** | Whether ≥1 license is declared (`schema:license` triple) | SP |
| **`license_coverage`** | Declares an SPDX license (per-repo yes/no; project mean = share licensed) | SP |
| **`programming_languages`** | Distinct declared languages (presence-set, no byte shares yet) | SP |
| `code_lines` | Lines added + removed in window; file-change count in secondary | OS |
| **`docs_discoverability`** | Scores 4 signals: README, homepage/docs, wiki, GitHub Pages | SP |
| **`test_coverage`** | Static coverage % advertised in README (shields badge / `coverage: NN%`) | SP |
| **`release_frequency`** | Lifetime release cadence (releases/year, first→latest release) | SP |
| **`upstream_dependencies`** | Distinct upstream repos depended on (`DEPENDS_ON` graph) | N4 |
| **`cr_reviews`** | PRs with ≥1 non-bot review comment (pair with `self_merge`) | OS |
| **`cr_accepted`** | Merged PRs in window (acceptance half of `closure_ratio`) | OS |
| `cr_declined` | PRs closed without merging (rejections / stale cleanup) | OS |
| `self_merge` | Fraction of merged PRs the author merged themselves — review-culture signal | OS |
| `bot_activity` | Share of commits by recognised bots (dependabot, renovate, `*[bot]`, …) | OS |

> **Phase / freshness note:** the issue/PR-based rows (`first_response`, `issue_*`, `issues_*`, `cr_*`, `pr_time_to_close`, `closure_ratio`, `self_merge`) and the newest signals (`test_coverage`, `release_frequency`) depend on GitHub-backend enrichment that is sparse in the current 2026-05 snapshot — expect `"—"` for many repos until a re-extraction lands.

## Response shape (verified 2026-06-10)

A **single repo metric** carries the spec fields (`slug`, `name`, `category`, `chaoss_topic`, `question`, `description`, `chaoss_url`, `is_time_based`) plus the computed result:

- `value` — **a display string** (`"6"`, `"72%"`, `"4.2 h"`, `"—"`). `"—"` means *no data*, **never 0** — don't read it as zero.
- `secondary` — per-store breakdown or extra context, e.g. `"Neo4j (all-time): 10 · SPARQL (windowed): 0 · OpenSearch (windowed): 6"` or `"top 1 of 3 contributors carry 62% of 13 commits"`.
- `label` — which store/window produced the headline (e.g. `"last 730 days · OpenSearch"`).
- `unification` — prose explaining how the three stores were reconciled into `value`.
- `headline_tone`, `notes`, `window_days`, `computed_at`, `canonical_url`.
- `visual` — optional render block (`rank_bars`, `donut`, `pill_cloud`, …) on several featured slugs.
- With `--include`: `traces[]` (`store`/`engine`/`query`/`result_summary`), `recipes` (`python`/`js`/`bash`), `series[]` (`date`/`value`/`series_unit`).

**All repo metrics** returns `{repo, canonical_url, window_days, computed_at, metric_count: 35, metrics: [...]}` (each entry is one metric object as above).

A **project metric** adds `repo_count`, `truncated`, `cached_at`, and an `aggregate` block: `{rule: "sum"|…, n_repos, n_with_value, sum, mean, min, max, value, …}`. **`n_with_value`** tells you how many member repos actually had data — lean on it, since distinct-people counts carry an `approx` flag.

## Live state (verified 2026-06-10)

- The hub serves the **2026-05 snapshot**. SPARQL traces in `--include traces` query `GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid>` (see `query-sparql` named-graph convention). The newest signals (`test_coverage`, `release_frequency`) and the issue/PR-based metrics (`first_response`, `cr_*`, `issues_*`) read `"—"` for most repos until a fresh re-extraction lands — **expect them sparse**.
- Repos are **GitHub-only**: `repo <owner> <repo>` → `/repositories/github.com/...`.
- Projects are discipline/topic buckets of repos. **The set and count change over time, so always read it from `projects` — never hardcode a number.** At time of writing the largest are `info-eng` (~109 repos), `bioeng` (~95), `stats` (~63), with domain-relevant ones like `protein_ai_ecosystem` (~26), `bio` (~42), `chem` (~10). Use the exact `project` slug returned by `projects` (e.g. `protein_ai_ecosystem`, not `protein-ai`). `project-repos <project>` returns the project header plus both a `metrics[]` summary and a `repositories[]` list.
- A browsable UI to explore first: `https://openpulse.epfl.ch/chaoss` (same auth).

## Conventions

- **Treat `value` as a string.** For numbers, parse `value` or read the `visual` block — and remember `"—"` ≠ 0.
- **Use the featured table** when the user names a dashboard card ("closure ratio", "bus factor", "doc discoverability") — map to the slug, pick the window, format with the narrative pattern.
- **Say when data is missing or approximate** — byte-level language shares, open PR counts, clone/download stats, and contribution-type breakdowns are gaps; don't invent them.
- This API is **read-only and GET-only**; there is nothing to mutate. The read password suffices.
- `--window` snaps server-side — passing 400 lands on 365; don't expect arbitrary windows.
- Project aggregates are cached 30 min; add `--refresh` only when you need a recompute, since it's slower.
