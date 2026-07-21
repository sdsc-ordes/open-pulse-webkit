---
name: query-opensearch
description: Query the Open Pulse OpenSearch cluster via the hub HTTPS gateway — SQL (SELECT/SHOW/DESCRIBE) or full search DSL (aggregations, filters). TRIGGER when the user asks anything that requires reading from the GrimoireLab/OpenSearch indices — counting docs, searching commits by enriched fields, running aggregations, or running a SQL/DSL query they paste in. SKIP for graph (use query-neo4j) or RDF (use query-sparql) questions.
---

# Query OpenSearch

This skill ships two equivalent scripts that POST to the hub gateway at `{OPENPULSE_ENDPOINT}/api/databases/opensearch/query` over HTTPS. Both read `OPENPULSE_ENDPOINT` and `OPENPULSE_AUTH` (format `user/password`; the username is ignored — the token is what matters) from `.env`. The gateway returns `{columns, rows, row_count, raw}`; the scripts flatten rows to a JSON array of objects (`--raw` prints the envelope verbatim, including the untabulated `raw` DSL response).

### Transport — two modes

The raw cluster ports (`:9200`, Dashboards `:7508`) are plain HTTP / self-signed and must not be used — the gateway is the only supported transport. It accepts `{"mode": …, "query": …}`:

- **SQL** (scripts' default) — `mode: "sql"`, query is an **OpenSearch SQL plugin** string starting with `SELECT`, `SHOW` or `DESCRIBE`; index names are the `FROM` targets. Good for quick lookups and counts.
- **DSL** (`--dsl <index>` flag) — `mode: "dsl"`, query is a JSON object `{"index": …, …search body}`. The scripts add the `index` key from the flag. Use this for **aggregations**, filters, `_source` projections — anything SQL can't express. The gateway tabulates simple agg buckets into `columns/rows` and puts the full response envelope in `raw`.

Reader tokens can query freely, but `SHOW TABLES` (403, needs `indices:admin/get`) and `DESCRIBE` (empty result) don't work for readers — discover fields with `SELECT * FROM <index> LIMIT 1` instead, and take index names from the table below. Mutating operations are blocked for readers in both modes.

```
.claude/skills/query-opensearch/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

## Identifiers — how this store keys things

| Field | Value form | Notes |
|---|---|---|
| `repo_name` | clone URL — **`.git` suffix NOT guaranteed** | `https://github.com/biopython/biopython.git` *but* `https://github.com/Biohub/esm` |
| `author_uuid` | opaque stable id | use for `cardinality` / `terms`, not `author_name` |
| `author_name` | display name | several aliases per human is normal |
| `_id` | commit SHA | |

`repo_name` is the one that bites. An exact `term` match on the wrong form returns **0 hits with no error**, so resolve the real key before matching — the scripts warn when a `repo_name` value isn't a URL:

```bash
python .claude/skills/query-opensearch/query.py --dsl git_demo_enriched \
  '{"size":0,"query":{"wildcard":{"repo_name":"*/<repo>*"}},"aggs":{"r":{"terms":{"field":"repo_name","size":20}}}}'
```

A renamed repo can appear under **both** owners (`Biohub/esm` and `evolutionaryscale/esm.git` are the same commits) — match all aliases with `terms`, but don't sum them.

Cross-store: SPARQL and Cypher use `https://github.com/{owner}/{repo}` with no suffix; CHAOSS and collections take `owner` + `repo` separately. See `.claude/SKILLS.md` §12.

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.claude/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.claude/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# Recent commits from an index
python .claude/skills/query-opensearch/query.py 'SELECT hash, author_date FROM git ORDER BY author_date DESC LIMIT 5'

# Count docs in an index
python .claude/skills/query-opensearch/query.py 'SELECT count(*) FROM git_demo_enriched'

# Discover an index's fields (DESCRIBE is empty for readers)
python .claude/skills/query-opensearch/query.py 'SELECT * FROM git_demo_enriched LIMIT 1'

# From stdin or a file
echo 'SELECT count(*) FROM git' | python .claude/skills/query-opensearch/query.py -
python .claude/skills/query-opensearch/query.py -f path/to/query.sql

# DSL — aggregation over an index (body inline, from stdin, or -f file)
python .claude/skills/query-opensearch/query.py --dsl git_demo_enriched \
  '{"size":0,"aggs":{"repos":{"terms":{"field":"repo_name","size":10}}}}'

# DSL — full response envelope (nested/multi-agg results live in `raw`)
python .claude/skills/query-opensearch/query.py --raw --dsl git_demo_enriched -f body.json

# Node equivalent (same flags)
node .claude/skills/query-opensearch/query.mjs 'SELECT count(*) FROM git'
```

## Live index state (verified 2026-07-21)

Commit (git) data dominates; ingestion is **live**, so counts below are moving
targets. `github_demo_enriched` now has data too (~21k docs), but Neo4j edges
(`OPENED_PR`, `OPENED_ISSUE`, …) remain the richer source for social activity.

| Index | Docs | Use it for |
|---|---|---|
| `git_demo_enriched` | ~2.43M | **The one you want** — enriched per-commit docs with the fields below (`git` resolves to the same docs) |
| `git-aoc_demo_enriched` | ~28.3M | "age of code" enrichment (heavy — always aggregate or LIMIT) |
| `git_demo_raw` | ~5.4M | Raw commit JSON — only when you truly need it |
| `github_demo_enriched` | ~21k | GitHub backend enrichment |

**What's actually in it:** the index is the GrimoireLab *demo* dataset, which is
a **mix** — Moodle, dataverse, bioconda, ckan, prometheus — **plus** many of the
protein/SDSC repos of interest (biopython ~16k commits, RosettaCommons/rosetta
~12k, openfold, ColabDesign, boltz, alphafold3, alphafold, RFdiffusion, …). Not
every repo is present; ~20/22 protein seeds were found. Always check coverage
with a `terms` agg on `repo_name` before assuming.

Never construct `repo_name` as `seed_url + ".git"` — the suffix varies and a
wrong exact match returns 0 silently. See **Identifiers** above for the
discovery recipe and the renamed-repo alias trap.

### Key fields on `git_demo_enriched`

| Field | Meaning |
|---|---|
| `repo_name` | clone URL, `.git` suffix **not** guaranteed (keyword; use directly in `terms`) |
| `author_uuid` / `Author_uuid` | stable author identity (use for `cardinality`/`terms`) |
| `author_name` | display name |
| `author_org_name` | **almost always `"Unknown"`** — affiliation NOT resolved here; get orgs from SPARQL (default graph or named graph — see `query-sparql`) or Neo4j instead |
| `grimoire_creation_date` | canonical commit timestamp (use for `date_histogram`, min/max) |
| `author_date`, `commit_date` | raw git dates |
| `lines_added`, `lines_removed`, `lines_changed`, `files` | churn (`sum`-able) |

Run `indices` first if anything above looks stale; backends get reloaded.

### CHAOSS / commit-metric recipes

Simple counts work in SQL; anything aggregation-shaped is cleaner in DSL (`--dsl git_demo_enriched`, `"size": 0`):

- **Commits per repo**: `terms(repo_name)` agg — or SQL `SELECT repo_name, count(*) FROM git_demo_enriched GROUP BY repo_name ORDER BY count(*) DESC LIMIT 25`.
- **Authors**: `cardinality(author_uuid)`, optionally under a `terms(repo_name)` agg.
- **Active authors (12 mo)**: `filter` with `range grimoire_creation_date >= now-365d` → `cardinality(author_uuid)`.
- **Project age / recency**: `min`/`max` of `grimoire_creation_date` filtered on `repo_name`.
- **Code churn**: `sum(lines_added)` + `sum(lines_removed)`.
- **Bus factor**: `terms(author_uuid, size 250)` filtered on `repo_name` → in code, count top authors covering >50% of commits.
- **Time series**: `date_histogram(grimoire_creation_date, calendar_interval=month)` with `sum(lines_*)` sub-aggs. Commits & churn are additive → re-aggregate month→quarter→year client-side; `cardinality` is **not** additive, so don't sum monthly distinct-author counts.
- **Enumerate a GrimoireLab project's repos**: `terms(repo_name, size 500)` filtered by `{"term":{"project":"<slug>"}}` — the authoritative membership list (the CHAOSS API's `project-repos` truncates at 150). Docs carry the applied `projects.json` tag.
- **Exclude forks from a project series**: `bool.must_not: {"terms":{"repo_name":[…fork urls + ".git"]}}` with the fork set built from Neo4j `FORK_OF` ∪ SPARQL `op:isForkOf` (see those skills).
- **Affiliation fields are often empty** (`author_org_name` = Unknown/-- UNDEFINED --) — check before promising CHAOSS Organizational Diversity; say "not computable" when it is.

## Conventions

- Always add `LIMIT` (SQL) or `"size"` (DSL) to row-returning queries — the raw indices hold millions of docs; use `"size": 0` for aggregation-only DSL bodies.
- On `git_demo_enriched` the fields you need (`repo_name`, `author_uuid`) are already keyword-typed — use them directly in `terms`/`cardinality`, no `.keyword` suffix. Other indices/fields may need `.keyword`; if a `terms` agg errors, sample the field first.
- Mutating operations are rejected at the gateway for reader tokens in both modes.
- The gateway tabulates single-agg buckets into `columns/rows`; for nested or multi-agg bodies read the full envelope via `--raw` (`raw.aggregations…`).
- Errors come back as JSON with `error.reason` inside the gateway's `detail` field — print verbatim, do not paraphrase.
- Prefer aggregations over deep pagination; both the SQL plugin and DSL cap result windows (`row_count` can report the match total, e.g. 10000, while rows are capped to the requested size).
