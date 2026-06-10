---
name: query-opensearch
description: Query the Open Pulse OpenSearch cluster (3.x, security plugin, self-signed TLS) for indices, mappings, doc counts, and DSL searches. TRIGGER when the user asks anything that requires reading from the GrimoireLab/OpenSearch indices — listing indices, counting docs, searching commits/issues/PRs by enriched fields, inspecting a mapping, or running a DSL query they paste in. SKIP for graph (use query-neo4j) or RDF (use query-sparql) questions.
---

# Query OpenSearch

This skill ships two equivalent scripts that hit the OpenSearch REST API. Both read `OPENSEARCH_ENDPOINT`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD` from `.env`. TLS verification is **disabled by default** because the cluster ships a self-signed cert — pass `--verify` once you've got a trusted CA in place.

### Transport

The cluster's `:9200` port is not exposed externally on this deployment. Queries are tunnelled through **OpenSearch Dashboards' `/api/console/proxy`** (the same endpoint Dashboards' Dev Tools console uses). The scripts auto-switch when `OPENSEARCH_DASHBOARDS_PROXY=true` in `.env`:

- `OPENSEARCH_ENDPOINT` points at the Dashboards base URL (e.g. `http://openpulse.epfl.ch:7508`)
- Inner request becomes the `path` and `method` query params; outer request is always `POST` with header `osd-xsrf: true`
- Credentials are the OpenSearch admin user (`admin` / `Replace-Me-1!` on this deployment)

Unset / `false` keeps the historical direct transport — useful once `:9200` is reachable again.

```
.claude/skills/query-opensearch/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

## Run

```bash
# Cluster sanity
python .claude/skills/query-opensearch/query.py health

# List indices (pattern optional, defaults to *)
python .claude/skills/query-opensearch/query.py indices
python .claude/skills/query-opensearch/query.py indices 'github*'

# Count docs in an index
python .claude/skills/query-opensearch/query.py count git

# DSL search — body inline, from stdin, or from a file
python .claude/skills/query-opensearch/query.py search git '{"query":{"match_all":{}}}'
echo '{"query":{"term":{"author_name":"alice"}}}' | python .claude/skills/query-opensearch/query.py search git -
python .claude/skills/query-opensearch/query.py search git -f path/body.json --size 50

# Arbitrary GET — fall-through for endpoints the wrapper doesn't model
python .claude/skills/query-opensearch/query.py get /_cluster/state?filter_path=metadata.indices.*.settings

# Node equivalent (same flags)
node .claude/skills/query-opensearch/query.mjs indices
```

## Live index state (verified 2026-06-05)

**Only git (commit) data is loaded. Every `github_*` index is EMPTY** — the
GitHub backend ran but produced 0 docs. So issues/PRs/comments are **not** in
OpenSearch; get those from Neo4j edges (`OPENED_PR`, `OPENED_ISSUE`, …).

| Index | Docs | Use it for |
|---|---|---|
| `git_demo_enriched` | ~45k | **The one you want** — enriched per-commit docs with the fields below |
| `git-aoc_demo_enriched` | ~572k | "age of code" enrichment (heavier) |
| `git_demo_raw` | ~3.95M | Raw commit JSON — only when you truly need it |
| `git-onion_demo_enriched_*` | ~15k | Onion-model enrichment |
| `github_demo_*`, `github_*`, `github-repo_*` | **0** | Empty — do not use |

**What's actually in it:** the index is the GrimoireLab *demo* dataset, which is
a **mix** — Moodle, dataverse, bioconda, ckan, prometheus — **plus** many of the
protein/SDSC repos of interest (biopython ~16k commits, RosettaCommons/rosetta
~12k, openfold, ColabDesign, boltz, alphafold3, alphafold, RFdiffusion, …). Not
every repo is present; ~20/22 protein seeds were found. Always check coverage
with a `terms` agg on `repo_name` before assuming.

**`repo_name` is the clone URL *with a `.git` suffix***: e.g.
`https://github.com/biopython/biopython.git`. Build it as `seed_url + ".git"`.
Some repos were ingested under a **pre-rename** owner (e.g.
`evolutionaryscale/esm.git`, now `Biohub/esm` on GitHub) — keep an alias map
when matching.

### Key fields on `git_demo_enriched`

| Field | Meaning |
|---|---|
| `repo_name` | clone URL + `.git` (keyword; use directly in `terms`) |
| `author_uuid` / `Author_uuid` | stable author identity (use for `cardinality`/`terms`) |
| `author_name` | display name |
| `author_org_name` | **almost always `"Unknown"`** — affiliation NOT resolved here; get orgs from SPARQL (default graph or named graph — see `query-sparql`) or Neo4j instead |
| `grimoire_creation_date` | canonical commit timestamp (use for `date_histogram`, min/max) |
| `author_date`, `commit_date` | raw git dates |
| `lines_added`, `lines_removed`, `lines_changed`, `files` | churn (`sum`-able) |

Run `indices` first if anything above looks stale; backends get reloaded.

### CHAOSS / commit-metric recipes (one `terms(repo_name)` agg, `--size 0`)

- **Commits**: `doc_count`. **Authors**: `cardinality(author_uuid)`.
- **Active authors (12 mo)**: `filter range grimoire_creation_date >= now-365d` → `cardinality(author_uuid)`.
- **Project age / recency**: `min`/`max` of `grimoire_creation_date`.
- **Code churn**: `sum(lines_added)` + `sum(lines_removed)`.
- **Bus factor**: `terms(author_uuid, size 250)` → in code, count top authors covering >50% of commits.
- **Time series**: `date_histogram(grimoire_creation_date, calendar_interval=month)` with `sum(lines_*)` sub-aggs. **New contributors**: `terms(author_uuid, size N)` + `min(grimoire_creation_date)`, then bucket each author's first-commit month in code. Commits & churn are additive → re-aggregate month→quarter→year client-side; `cardinality` is **not** additive, so don't sum monthly distinct-author counts.

## Conventions

- **Always pass `--size 0` for aggregations.** The `search` subcommand appends `?size=N` (default 10) to the URL, and that query-param **overrides the `size` in your body** — so a body with `"size":0` still returns 10 hits unless you also pass `--size 0`. (Aggregations still compute either way; `--size 0` just drops the noise hits.)
- On `git_demo_enriched` the fields you need (`repo_name`, `author_uuid`) are already keyword-typed — use them directly in `terms`/`cardinality`, no `.keyword` suffix. Other indices/fields may need `.keyword`; check the mapping if a `terms` agg errors.
- Avoid mutating endpoints (`PUT`, `DELETE`). The scripts only do GET/POST `_search`/`_count`; for anything destructive go through curl explicitly.
- Errors come back as JSON with `error.reason` — print verbatim, do not paraphrase.
- For deep pagination, prefer `search_after` over `from + size`; the cluster rejects deep `from` by default.
