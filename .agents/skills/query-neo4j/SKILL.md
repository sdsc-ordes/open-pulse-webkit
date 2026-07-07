---
name: query-neo4j
description: Run a Cypher query against the Open Pulse Neo4j instance and get JSON rows back. TRIGGER when the user asks anything that requires reading from the graph database — exploring labels, counting nodes/relationships, listing repositories/contributors/commits, sampling properties, or running a Cypher query they paste in. SKIP for SPARQL/RDF questions (use query-sparql) or log/index questions (use query-opensearch).
---

# Query Neo4j

This skill ships two equivalent scripts that talk to the Neo4j HTTP transactional API. Both read `NEO4J_HTTP_ENDPOINT` and `NEO4J_AUTH` (format `user/password`) from `.env` at the repo root.

```
.agents/skills/query-neo4j/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.agents/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.agents/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# Inline Cypher
python .agents/skills/query-neo4j/query.py 'MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n ORDER BY n DESC'

# From stdin
echo 'MATCH (n) RETURN count(n)' | python .agents/skills/query-neo4j/query.py -

# From a file
python .agents/skills/query-neo4j/query.py -f path/to/query.cypher

# Node equivalent (same flags)
node .agents/skills/query-neo4j/query.mjs 'MATCH (n) RETURN count(n)'
```

Output is a JSON array of objects, one per row. Errors print to stderr and exit non-zero — surface the message verbatim to the user, don't pretend success.

## Live schema (verified 2026-06-05)

Four labels (counts as of 2026-06-05):

| Label | Count | What it is |
|---|---|---|
| `Repo`   | ~230,500 | GitHub repositories |
| `User`   | ~52,700  | GitHub user accounts |
| `RorOrg` | ~1,535   | Research institutions, identified by a ROR URI *(added since the 2026-05 refresh)* |
| `Org`    | ~1,120   | GitHub organisations |

There are *no* `Repository`, `Person`, `Commit`, or `PullRequest` nodes —
**commits live only in OpenSearch** (`git_demo_enriched`), and PRs/issues/
reviews/comments are encoded as **edges**, not nodes.

**Identifier properties hold full GitHub URLs** (not bare slugs):

| Property | Value form |
|---|---|
| `Org.login`      | `https://github.com/<owner>` |
| `User.login`     | `https://github.com/<user>`  |
| `Repo.full_name` | `https://github.com/<owner>/<repo>` |
| `Repo.owner`     | `<owner>` *(still a plain slug, no URL)* |

When matching by login or full_name, **use the full URL literal** — passing
just the slug returns zero rows.

### Relationship types (verified 2026-06-05)

| Type | Direction | Count | Meaning |
|---|---|---|---|
| `DEPENDS_ON`      | `(Repo)→(Repo)` | ~259k | Dependency edge between repos |
| `OWNS`            | `(Org)→(Repo)`  | ~163k | Org owns repo |
| `CONTRIBUTES_TO`  | `(User)→(Repo)` | ~55k  | Authored commits to repo |
| `STARRED`         | `(User)→(Repo)` | ~46k  | Stargazer |
| `WATCHES`         | `(User)→(Repo)` | ~19k  | Watcher/subscriber |
| `COMMENTED_ON`    | `(User)→(Repo)` | ~12k  | Issue/PR comment |
| `OPENED_ISSUE`    | `(User)→(Repo)` | ~11k  | Opened an issue |
| `MEMBER_OF`       | `(User)→(Org)`  | ~9k   | GitHub org membership |
| `FOLLOWS`         | `(User)→(User)` | ~9k   | Social follow |
| `OPENED_PR`       | `(User)→(Repo)` | ~6.7k | Opened a pull request |
| `FORK_OF`         | `(Repo)→(Repo)` | ~4.1k | Fork lineage |
| `REVIEWED_PR`     | `(User)→(Repo)` | ~2.5k | Reviewed a PR |
| `AFFILIATED_WITH` | `(User)→(RorOrg)` | ~373 | Institutional affiliation (ROR) |

Edges carry **no temporal properties** (no per-event timestamps) — they are
plain counts of activity. For commit-level time series use OpenSearch.

PR/issue/review/comment data exists *only* as these edges (the OpenSearch
`github_*` indices are empty), so social-engagement metrics must come from
Neo4j, never OpenSearch.

## Useful starter queries

| Goal | Cypher |
|---|---|
| Labels and counts | `MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n ORDER BY n DESC` |
| Relationship types and counts | `MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS n ORDER BY n DESC` |
| Property keys on a label | `MATCH (n:Repo) UNWIND keys(n) AS k RETURN DISTINCT k LIMIT 100` |
| Sample 5 nodes of a label | `MATCH (n:Repo) RETURN n LIMIT 5` |
| Look up an org by URL | `MATCH (o:Org {login: 'https://github.com/sdsc-ordes'}) RETURN o` |
| Look up a repo by URL | `MATCH (r:Repo {full_name: 'https://github.com/sdsc-ordes/open-pulse'}) RETURN r` |
| Repos owned by an org | `MATCH (:Org {login: 'https://github.com/sdsc-ordes'})-[:OWNS]->(r:Repo) RETURN r.full_name LIMIT 20` |
| Everything connected to a repo | `MATCH (r:Repo {full_name:'https://github.com/biopython/biopython'})-[rel]-(n) RETURN type(rel) AS rel, labels(n)[0] AS kind, count(*) AS n ORDER BY n DESC` |
| Social-engagement counts for a repo | `MATCH (u:User)-[rel]->(r:Repo {full_name:$url}) WHERE type(rel) IN ['OPENED_PR','OPENED_ISSUE','REVIEWED_PR','COMMENTED_ON'] RETURN type(rel) AS rel, count(DISTINCT u) AS users, count(*) AS edges` |
| Contributors of a repo | `MATCH (u:User)-[:CONTRIBUTES_TO]->(r:Repo {full_name:$url}) RETURN u.login LIMIT 100` |
| A user's institution(s) | `MATCH (u:User {login:$url})-[:AFFILIATED_WITH]->(o:RorOrg) RETURN o` |

## Recipes learned in practice

- **Owner→repos for several orgs at once**: `MATCH (o:Org)-[:OWNS]->(r:Repo) WHERE o.login IN $logins RETURN o.login, r.full_name` — the basis for org-scoped catalogs.
- **PR/issue/review/comment metrics**: always come from the edge types above. Count `DISTINCT u` for "people" and `count(*)` for "events"; there is no event date to bucket by.
- **`DEPENDS_ON` is large** (~259k). Always scope it to a seed set (`WHERE r.full_name IN $urls`) and add `LIMIT`, or it returns the whole ecosystem.
- **Affiliations**: `(:User)-[:AFFILIATED_WITH]->(:RorOrg)` mirrors the SPARQL `org:hasMembership` data (default graph or `GRAPH <…/graph/{YYYY-MM}/hybrid>`); institutions are ROR-identified in both stores. See `query-sparql` for default vs named-graph modes.
- **Fork detection for honest metrics**: `MATCH (o:Org)-[:OWNS]->(r:Repo)-[:FORK_OF]->(p:Repo) WHERE o.login IN $orgs RETURN r.full_name, p.full_name` gives the vendored-fork set (union it with SPARQL `op:isForkOf`). Exclude those repos from commit/contributor series — a forked `assimp`/`imgui` carries the whole upstream history and can inflate the org's own commit counts several-fold.
- **Repo nodes are thin stubs** (name/owner/id only — no description, stars, or language). Catalogue metadata must come from SPARQL; expect only a subset of crawled repos to be in the metadata graph, and surface the rest as a coverage gap rather than empty columns.

## Conventions

- Always include `LIMIT` on exploratory queries — the graph has hundreds of thousands of nodes.
- Prefer Python `query.py` for one-off shell work; use `query.mjs` when integrating with the web app codebase.
- Bolt access (the `:7504` port) needs a real driver. Both scripts use the HTTP endpoint instead so they have zero install footprint.
- The TLS cert (if you switch to https) is self-signed; on plain `http://` no TLS is involved.
