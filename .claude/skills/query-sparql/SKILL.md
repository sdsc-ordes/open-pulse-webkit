---
name: query-sparql
description: Run a SPARQL query against the Open Pulse Oxigraph triplestore via its Caddy HTTP-Basic proxy. TRIGGER when the user asks anything that requires reading from the RDF metadata graph — listing named graphs, counting triples, exploring a vocabulary/predicate, or running a SPARQL SELECT/ASK/CONSTRUCT they paste in. SKIP for graph property questions (use query-neo4j) or log/index questions (use query-opensearch).
---

# Query SPARQL (Oxigraph behind Caddy)

This skill ships two equivalent scripts that talk to `/query` on the SPARQL endpoint. Both read `SPARQL_ENDPOINT` and `SPARQL_AUTH` (format `user/password`) from `.env`. They deliberately do not support `/update` — use curl directly if you need to mutate.

```
.claude/skills/query-sparql/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

## Run

```bash
# Inline SELECT — JSON bindings flattened to {var: value}
python .claude/skills/query-sparql/query.py 'SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }'

# From a file
python .claude/skills/query-sparql/query.py -f query.rq

# CONSTRUCT or DESCRIBE — switch to turtle
python .claude/skills/query-sparql/query.py --accept turtle 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 10'

# Raw passthrough (no JSON pretty-printing)
python .claude/skills/query-sparql/query.py --accept csv --raw 'SELECT ?s WHERE { ?s a ?t } LIMIT 5'

# Node equivalent (same flags)
node .claude/skills/query-sparql/query.mjs -f query.rq
```

For `SELECT` the script flattens the SPARQL JSON Results envelope to a plain `[{var: value}, ...]` array. For `ASK`, `CONSTRUCT`, `DESCRIBE`, or any non-`json` accept, the response is passed through.

## Default graph vs named graphs (verified 2026-06-10)

Oxigraph holds production RDF in **named graphs**, but the hub also configures a **default graph** so plain SPARQL (no `GRAPH` clause) works.

### Two query modes

| Mode | Syntax | When to use |
|---|---|---|
| **Default graph** | `{ ?s ?p ?o }` — no `GRAPH` wrapper | Most ad-hoc queries. Oxigraph resolves this to the **current production snapshot** (~2.45M triples today, same data as `…/graph/2026-05/hybrid`). |
| **Named graph** | `GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid> { … }` | Pin a specific snapshot, query utility graphs, or compare graphs side by side. Required for `_backup/…`, `_links/identity`, or in-progress `2026-06/hybrid`. |

```sparql
# Default graph mode — fine for everyday repo/metadata lookups
SELECT ?name WHERE {
  <https://github.com/biopython/biopython> schema:name ?name .
}

# Named graph mode — pin a snapshot or reach non-default graphs
SELECT ?name WHERE {
  GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid> {
    <https://github.com/biopython/biopython> schema:name ?name .
  }
}
```

Default mode does **not** union every named graph — backups and in-progress snapshots are invisible unless you name them explicitly.

### Named-graph IRI pattern

| Kind | Pattern | Example |
|---|---|---|
| **Production snapshot** | `https://open-pulse.epfl.ch/graph/{YYYY-MM}/hybrid` | `…/graph/2026-05/hybrid` |
| **Utility / backup** | `https://open-pulse.epfl.ch/graph/_…` | `…/_backup/2026-05-hybrid-prenorm`, `…/_links/identity` |

Pipeline `sparql_upload` (op-extractor) lands triples in the named graph for that month; the hub also promotes the current snapshot into the default graph. CHAOSS SPARQL traces may use either form.

### Current named graphs (live)

| Named graph | Triples | Role |
|---|---|---|
| `https://open-pulse.epfl.ch/graph/2026-05/hybrid` | ~2.45M | **Current production snapshot** — also what default-graph queries see |
| `https://open-pulse.epfl.ch/graph/_backup/2026-05-hybrid-prenorm` | ~2.12M | Pre-normalisation backup — named graph only |
| `https://open-pulse.epfl.ch/graph/2026-06/hybrid` | ~329k | In-progress next snapshot — named graph only |
| `https://open-pulse.epfl.ch/graph/_links/identity` | ~204 | Cross-store identity links — named graph only |

Refresh sizes: `python .claude/skills/op-collections/query.py stats` → `sparql.named_graphs`, or the inventory query below.

## Prefixes used in this graph

```sparql
PREFIX op:     <https://open-pulse.epfl.ch/ontology#>
PREFIX gme:    <https://openpulse.science/git-metadata-extractor#>
PREFIX schema: <http://schema.org/>
PREFIX org:    <http://www.w3.org/ns/org#>
PREFIX rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
```

**Identifiers are full URLs.** A repo subject is `<https://github.com/owner/repo>`,
a person is `<https://github.com/login>` or `<https://orcid.org/xxxx-…>`, an
institution is `<https://ror.org/…>`. Match the full URL literal.

## Predicate reference (what's actually populated)

**Repository** (subject = the GitHub URL):
`schema:name`, `gme:description`, `schema:programmingLanguage` / `gme:primary_language`,
`gme:license_name` / `schema:license`, `op:githubRepoStars`, `op:githubRepoForks`,
`gme:watchers_count`, `gme:open_issues_count`, `gme:subscribers_count`, `gme:network_count`,
`gme:size_kb`, `schema:dateCreated`, `gme:pushed_at`, `gme:updated_at`, `gme:default_branch`,
`gme:archived`, `gme:has_wiki`, `gme:has_discussions`, `gme:has_pages`, `gme:homepage`,
`gme:avatar_url`, `gme:html_url`, `gme:keywords`, `op:discipline`, `op:ownedBy`,
`gme:contributing_url`, `gme:citation_cff_url`, `schema:citation`.

**Contributions** — one `op:Contribution` node per (author, repo), carrying dates:
```sparql
?c a op:Contribution ; schema:author ?author ;
   op:contributionTo ?repo ;
   op:firstContributionDate ?first ; op:lastContributionDate ?last .
```

**People → institutions** (memberships, mostly hung off ORCIDs):
```sparql
?user org:hasMembership ?m . ?m org:organization ?org .   # ?org is usually a ROR URI
```
~3,392 memberships / 1,252 users; **3,118 point at `ror.org`**; ~1,174 users are ORCIDs, ~73 are GitHub URLs. ROR labels are local: `<ror> schema:name ?name`.

**ORCID ↔ GitHub bridge** (~993): `?orcid schema:url ?gh` (filter `?gh` to github.com). Use it to map an ORCID's memberships/publications onto a GitHub contributor.

**Owner → parent institution**: `?owner org:unitOf ?ror`.

**Publications** are `schema:ScholarlyArticle` entities — subject IRI is the `doi.org` URL, with `schema:name` (title), `schema:identifier` (bare DOI), `schema:datePublished`, `schema:author` (ORCIDs), `schema:sourceOrganization` (venue/ROR), `op:infoscienceArticleIdentifier`. Direct repo citations `?repo schema:citation ?article` are **sparse** (664 total / 368 repos; citation targets are typed ScholarlyArticle, 435). Richer: articles authored by people — but **`?x schema:author ?orcid` ALSO matches ~3,800 repositories** (repos carry `schema:author` too), so you MUST constrain `?art a schema:ScholarlyArticle` or repos leak in as fake papers (only 347 articles are genuinely orcid-authored). To find a tool's "related publications", map its contributors' ORCIDs and pull the ScholarlyArticle entities they authored.

## Useful starter queries

| Goal | SPARQL |
|---|---|
| Named graphs + sizes | `SELECT ?g (COUNT(*) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } } GROUP BY ?g ORDER BY DESC(?n)` |
| Triple count (default graph) | `SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }` |
| Triple count (named graph) | `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid> { ?s ?p ?o } }` |
| Predicates on a repo | `SELECT DISTINCT ?p WHERE { <https://github.com/biopython/biopython> ?p ?o }` |
| Stars/forks for repos | `{ VALUES ?r { <…/repo1> <…/repo2> } ?r op:githubRepoStars ?s ; op:githubRepoForks ?f }` |

## Gotchas learned the hard way

- **VALUES over hundreds of URIs times out (504).** For memberships, ORCID bridge, and person-publications, **fetch the whole (small) table once and join in Python** instead of binding a big `VALUES` list. Per-repo `VALUES` of ~25 URIs is fine.
- **IRI-unsafe author logins.** Bot handles like `github-actions[bot]` contain `[]` that break IRI parsing inside `VALUES`. Percent-encode them before interpolating (`[`→`%5B`, `]`→`%5D`).
- **Most affiliations hang off ORCIDs, not GitHub URLs.** A GitHub-only contributor resolves an institution only if an ORCID bridges to their GitHub *and* that ORCID has a membership. Of typical external (non-EPFL) contributors, few do — expect partial coverage and consider the GitHub-profile `company` as a soft fallback.

## Conventions

- Always include `LIMIT` on exploratory queries. **Default graph mode** (`{ … }` without `GRAPH`) is fine for the current production snapshot; use an explicit `GRAPH <https://open-pulse.epfl.ch/graph/{YYYY-MM}/hybrid>` when you need a specific snapshot or a non-default graph.
- Updates require `SPARQL_AUTH` admin role and are destructive — never run them unless the user explicitly asks. Use curl, not these scripts.
- Oxigraph default response is SPARQL XML; the scripts always set `Accept` explicitly.
- A 504 from the proxy means the query timed out — reduce the result set, tighten the pattern, or switch to fetch-and-join.
