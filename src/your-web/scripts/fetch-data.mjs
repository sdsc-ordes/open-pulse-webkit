#!/usr/bin/env node
/* Build-time data snapshot for the ENAC Open Pulse dashboard.
 *
 * Queries the three Open Pulse engines (Neo4j, Oxigraph/SPARQL, OpenSearch/
 * GrimoireLab) plus the hub's CHAOSS metrics API, scopes everything to the
 * ENAC lab organisations, and writes static JSON snapshots to src/data/.
 * The site is fully static — the browser never touches the stores directly
 * (credentials stay here, at build time).
 *
 * Usage:  node scripts/fetch-data.mjs        (needs repo-root .env)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'data');

/* ENAC scope — the GitHub organisations of ENAC labs, as tagged in the
 * GrimoireLab `epfl-enac` project (verified against OpenSearch + Neo4j). */
const ENAC_ORGS = [
  'EPFL-ENAC',
  'vita-epfl',
  'ibois-epfl',
  'eesd-epfl',
  'ENAC-CNPA',
  'GeoEnergyLab-EPFL',
  'RESSLab-Team',
  'openpifpaf',
  'ceat-epfl',
  'cryos-epfl',
  'LDM-EPFL',
  'StructuralXplorationLab',
];
const ORG_URLS = ENAC_ORGS.map((o) => `https://github.com/${o}`);

/* ---------------- .env + transports ---------------- */

async function loadDotenv() {
  let dir = HERE;
  for (let i = 0; i < 10; i++) {
    try {
      const text = await readFile(join(dir, '.env'), 'utf8');
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#') || !t.includes('=')) continue;
        const idx = t.indexOf('=');
        const key = t.slice(0, idx).trim();
        if (process.env[key] === undefined) process.env[key] = t.slice(idx + 1).trim();
      }
      return;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return;
      dir = parent;
    }
  }
}

function basic(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

async function neo4j(cypher, parameters = {}) {
  const endpoint = process.env.NEO4J_HTTP_ENDPOINT.replace(/\/$/, '');
  const [user, ...rest] = process.env.NEO4J_AUTH.split('/');
  const res = await fetch(`${endpoint}/db/neo4j/tx/commit`, {
    method: 'POST',
    headers: {
      Authorization: basic(user, rest.join('/')),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ statements: [{ statement: cypher, parameters }] }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(`neo4j: ${JSON.stringify(body.errors)}`);
  const { columns, data } = body.results[0];
  return data.map((d) => Object.fromEntries(columns.map((c, i) => [c, d.row[i]])));
}

async function sparql(query) {
  const endpoint = process.env.SPARQL_ENDPOINT.replace(/\/$/, '');
  const [user, ...rest] = process.env.SPARQL_AUTH.split('/');
  const res = await fetch(`${endpoint}/query`, {
    method: 'POST',
    headers: {
      Authorization: basic(user, rest.join('/')),
      'Content-Type': 'application/sparql-query',
      Accept: 'application/sparql-results+json',
    },
    body: query,
  });
  if (!res.ok) throw new Error(`sparql http ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  return body.results.bindings.map((b) =>
    Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])),
  );
}

async function opensearch(path, body) {
  const endpoint = process.env.OPENSEARCH_ENDPOINT.replace(/\/$/, '');
  const useProxy = ['1', 'true', 'yes'].includes(
    (process.env.OPENSEARCH_DASHBOARDS_PROXY || '').trim().toLowerCase(),
  );
  const headers = {
    Authorization: basic(process.env.OPENSEARCH_USERNAME, process.env.OPENSEARCH_PASSWORD),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  let url = `${endpoint}${path}`;
  let method = 'POST';
  if (useProxy) {
    const qs = new URLSearchParams({ path: path.replace(/^\//, ''), method: 'POST' });
    url = `${endpoint}/api/console/proxy?${qs}`;
    headers['osd-xsrf'] = 'true';
  }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // self-signed cluster cert
  const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`opensearch http ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function chaoss(path) {
  const endpoint = process.env.CHAOSS_ENDPOINT.replace(/\/$/, '');
  const [user, ...rest] = process.env.CHAOSS_AUTH.split('/');
  const res = await fetch(`${endpoint}/api/v1/metrics/chaoss/${path}`, {
    headers: { Authorization: basic(user, rest.join('/')), Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`chaoss http ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function wikidataLabels(qids) {
  const out = {};
  for (let i = 0; i < qids.length; i += 45) {
    const batch = qids.slice(i, i + 45);
    const url =
      'https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=en&format=json&ids=' +
      batch.join('|');
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'open-pulse-webkit/0.1 (ENAC dashboard build)' },
      });
      const body = await res.json();
      for (const [qid, ent] of Object.entries(body.entities ?? {})) {
        out[qid] = ent.labels?.en?.value ?? qid;
      }
    } catch (e) {
      console.warn(`  wikidata labels failed (${e.message}) — keeping QIDs`);
      for (const q of batch) out[q] = q;
    }
  }
  return out;
}

/* ---------------- helpers ---------------- */

const SPARQL_PREFIXES = `
PREFIX op: <https://open-pulse.epfl.ch/ontology#>
PREFIX gme: <https://openpulse.science/git-metadata-extractor#>
PREFIX schema: <http://schema.org/>
PREFIX org: <http://www.w3.org/ns/org#>
`;

const ENAC_FILTER = ORG_URLS.map((u) => `STRSTARTS(STR(?r), "${u}/")`).join(' || ');

const slugOf = (url) => url.replace('https://github.com/', '').replace(/\.git$/, '');
const shortIri = (iri) =>
  iri
    .replace('https://open-pulse.epfl.ch/ontology#', '')
    .replace('https://spdx.org/licenses/', '')
    .replace(/\.html$/, '');

const monthKey = (iso) => iso.slice(0, 7);

async function writeJson(name, data) {
  await writeFile(join(OUT_DIR, name), JSON.stringify(data));
  const kb = Math.round(JSON.stringify(data).length / 1024);
  console.log(`  wrote src/data/${name} (${kb} kB)`);
}

/* ---------------- main ---------------- */

await loadDotenv();
await mkdir(OUT_DIR, { recursive: true });
const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const meta = { fetchedAt, scope: 'epfl-enac', orgs: ENAC_ORGS };

console.log('1/7 Neo4j: orgs, repos, contribution + social edges …');

const orgRows = await neo4j(
  `MATCH (o:Org) WHERE o.login IN $orgs RETURN o.login AS login, o.name AS name`,
  { orgs: ORG_URLS },
);
const orgName = new Map(orgRows.map((o) => [slugOf(o.login), o.name || slugOf(o.login)]));

const repoRows = await neo4j(
  `MATCH (o:Org)-[:OWNS]->(r:Repo) WHERE o.login IN $orgs
   RETURN o.login AS org, r.full_name AS url, r.name AS name`,
  { orgs: ORG_URLS },
);

const contribRows = await neo4j(
  `MATCH (o:Org)-[:OWNS]->(r:Repo)<-[:CONTRIBUTES_TO]-(u:User)
   WHERE o.login IN $orgs
   RETURN r.full_name AS repo, u.login AS user, u.name AS name`,
  { orgs: ORG_URLS },
);

const socialRows = await neo4j(
  `MATCH (o:Org)-[:OWNS]->(r:Repo)<-[rel]-(u:User)
   WHERE o.login IN $orgs AND type(rel) IN ['OPENED_PR','OPENED_ISSUE','REVIEWED_PR','COMMENTED_ON','STARRED']
   RETURN r.full_name AS repo, type(rel) AS t, count(*) AS edges, count(DISTINCT u) AS users`,
  { orgs: ORG_URLS },
);

const memberRows = await neo4j(
  `MATCH (u:User)-[:MEMBER_OF]->(o:Org) WHERE o.login IN $orgs
   RETURN u.login AS user, o.login AS org`,
  { orgs: ORG_URLS },
);

const affiliationRows = await neo4j(
  `MATCH (o:Org)-[:OWNS]->(:Repo)<-[:CONTRIBUTES_TO]-(u:User)
   WHERE o.login IN $orgs
   MATCH (u)-[:AFFILIATED_WITH]->(i:RorOrg)
   RETURN DISTINCT u.login AS user, i.name AS name, i.id AS id, i.ror AS ror`,
  { orgs: ORG_URLS },
);

const forkRows = await neo4j(
  `MATCH (o:Org)-[:OWNS]->(r:Repo)-[:FORK_OF]->(p:Repo)
   WHERE o.login IN $orgs
   RETURN r.full_name AS repo, p.full_name AS parent`,
  { orgs: ORG_URLS },
);
const forkParent = new Map(forkRows.map((f) => [f.repo, f.parent]));

console.log(
  `  ${repoRows.length} repos, ${contribRows.length} contribution edges, ` +
    `${affiliationRows.length} affiliations`,
);

console.log('2/7 SPARQL: repo metadata, disciplines, languages …');

const metaRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?r (SAMPLE(?name) AS ?n) (SAMPLE(?type) AS ?t) (SAMPLE(?license) AS ?lic)
       (SAMPLE(?stars) AS ?st) (SAMPLE(?forks) AS ?fk) (SAMPLE(?created) AS ?cr)
       (SAMPLE(?stub) AS ?stb) (SAMPLE(?desc) AS ?d) (SAMPLE(?fkOf) AS ?fo)
       (SAMPLE(?cff) AS ?ccf)
WHERE {
  ?r a schema:SoftwareSourceCode . FILTER(${ENAC_FILTER})
  OPTIONAL { ?r schema:name ?name }
  OPTIONAL { ?r op:repositoryType ?type }
  OPTIONAL { ?r schema:license ?license }
  OPTIONAL { ?r op:githubRepoStars ?stars }
  OPTIONAL { ?r op:githubRepoForks ?forks }
  OPTIONAL { ?r schema:dateCreated ?created }
  OPTIONAL { ?r gme:stub ?stub }
  OPTIONAL { ?r gme:description ?desc }
  OPTIONAL { ?r op:isForkOf ?fkOf }
  OPTIONAL { ?r gme:citation_cff_url ?cff }
} GROUP BY ?r`);

const disciplineRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?r ?d WHERE { ?r a schema:SoftwareSourceCode ; op:discipline ?d . FILTER(${ENAC_FILTER}) }`);

const languageRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?r ?l WHERE { ?r a schema:SoftwareSourceCode ; schema:programmingLanguage ?l . FILTER(${ENAC_FILTER}) }`);

const citationRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?r ?art WHERE { ?r a schema:SoftwareSourceCode ; schema:citation ?art . FILTER(${ENAC_FILTER}) }`);

console.log(`  ${metaRows.length} repos in metadata graph`);

const qids = [
  ...new Set(disciplineRows.map((d) => d.d.split('/').pop()).filter((q) => /^Q\d+$/.test(q))),
];
console.log(`  resolving ${qids.length} Wikidata discipline labels …`);
const qidLabel = await wikidataLabels(qids);

console.log('3/7 SPARQL: publications (ORCID bridge → scholarly articles) …');

const bridgeRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?orcid ?gh WHERE {
  ?orcid schema:url ?gh .
  FILTER(STRSTARTS(STR(?orcid), "https://orcid.org/") && CONTAINS(STR(?gh), "github.com"))
}`);

const membershipRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?u ?o WHERE { ?u org:hasMembership ?m . ?m org:organization ?o }`);

const rorNameRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?ror ?name WHERE { ?ror schema:name ?name . FILTER(STRSTARTS(STR(?ror), "https://ror.org/")) }`);

const articleRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?art (SAMPLE(?title) AS ?t) (SAMPLE(?date) AS ?dt) (SAMPLE(?doi) AS ?d) (SAMPLE(?inf) AS ?i)
WHERE {
  ?art a schema:ScholarlyArticle .
  OPTIONAL { ?art schema:name ?title }
  OPTIONAL { ?art schema:datePublished ?date }
  OPTIONAL { ?art schema:identifier ?doi }
  OPTIONAL { ?art op:infoscienceArticleIdentifier ?inf }
} GROUP BY ?art`);

const articleAuthorRows = await sparql(`${SPARQL_PREFIXES}
SELECT ?art ?a WHERE { ?art a schema:ScholarlyArticle ; schema:author ?a }`);

/* ORCID-identified authors of typed Contribution nodes on ENAC repos —
 * richer than the schema:url bridge for "contributors with an ORCID". */
const contributionOrcidRows = await sparql(`${SPARQL_PREFIXES}
SELECT DISTINCT ?r ?orcid WHERE {
  ?c a op:Contribution ; op:contributionTo ?r ; schema:author ?orcid .
  FILTER(${ENAC_FILTER})
  FILTER(STRSTARTS(STR(?orcid), "https://orcid.org/"))
}`);

console.log(
  `  ${articleRows.length} articles, ${bridgeRows.length} ORCID↔GitHub links, ` +
    `${membershipRows.length} memberships`,
);

console.log('4/7 OpenSearch (GrimoireLab): commit history for project epfl-enac …');

/* Forks (Neo4j FORK_OF ∪ SPARQL op:isForkOf) are excluded from the ecosystem
 * activity/community series — a vendored fork of assimp or imgui carries the
 * whole upstream commit history, which would swamp ENAC's own numbers. */
const forkUrls = new Set(forkRows.map((f) => f.repo));
for (const m of metaRows) if (m.fo) forkUrls.add(m.r);
const forkGitUrls = [...forkUrls].map((u) => `${u}.git`);
console.log(`  excluding ${forkUrls.size} forks from ecosystem series`);

const PROJECT_Q = {
  bool: {
    filter: [{ term: { project: 'epfl-enac' } }],
    must_not: [{ terms: { repo_name: forkGitUrls } }],
  },
};
const PROJECT_ALL_Q = { term: { project: 'epfl-enac' } };

const histo = await opensearch('/git_demo_enriched/_search', {
  size: 0,
  query: PROJECT_Q,
  aggs: {
    months: {
      date_histogram: { field: 'grimoire_creation_date', calendar_interval: 'month' },
      aggs: { authors: { cardinality: { field: 'author_uuid' } } },
    },
    total_authors: { cardinality: { field: 'author_uuid' } },
  },
});

const perRepoAgg = await opensearch('/git_demo_enriched/_search', {
  size: 0,
  query: PROJECT_ALL_Q,
  aggs: {
    repos: {
      terms: { field: 'repo_name', size: 500 },
      aggs: {
        authors: { cardinality: { field: 'author_uuid' } },
        last: { max: { field: 'grimoire_creation_date' } },
        first: { min: { field: 'grimoire_creation_date' } },
      },
    },
  },
});

const authorAgg = await opensearch('/git_demo_enriched/_search', {
  size: 0,
  query: PROJECT_Q,
  aggs: {
    authors: {
      terms: { field: 'author_uuid', size: 3000 },
      aggs: { first: { min: { field: 'grimoire_creation_date' } } },
    },
    names: { terms: { field: 'author_name', size: 40 } },
    orgs: { terms: { field: 'author_org_name', size: 30 } },
  },
});

const repoBuckets = perRepoAgg.aggregations.repos.buckets;
const flagshipBucket = repoBuckets.find((b) => !forkUrls.has(b.key.replace(/\.git$/, '')));
const flagshipSlug = slugOf(flagshipBucket.key);
const flagship = await opensearch('/git_demo_enriched/_search', {
  size: 0,
  query: { term: { repo_name: flagshipBucket.key } },
  aggs: {
    months: {
      date_histogram: { field: 'grimoire_creation_date', calendar_interval: 'month' },
      aggs: { authors: { cardinality: { field: 'author_uuid' } } },
    },
    authors: {
      terms: { field: 'author_uuid', size: 2000 },
      aggs: { first: { min: { field: 'grimoire_creation_date' } } },
    },
  },
});

console.log(
  `  ${repoBuckets.length} repos with commits; flagship (non-fork): ${flagshipSlug} ` +
    `(${flagshipBucket.doc_count} commits)`,
);

console.log('5/7 CHAOSS API: per-repo metric table for project epfl-enac …');

let chaossRepos = [];
let chaossTruncated = false;
try {
  const pr = await chaoss('projects/epfl-enac/repositories');
  chaossRepos = pr.repositories ?? [];
  chaossTruncated = Boolean(pr.truncated);
  console.log(`  ${chaossRepos.length} repos (truncated: ${chaossTruncated})`);
} catch (e) {
  console.warn(`  chaoss unavailable (${e.message}) — health table will omit API values`);
}

console.log('6/7 Assembling snapshots …');

/* --- repos.json --- */

const byUrlMeta = new Map(metaRows.map((m) => [m.r, m]));
const disciplinesByRepo = new Map();
for (const d of disciplineRows) {
  const qid = d.d.split('/').pop();
  const label = qidLabel[qid] ?? qid;
  if (!disciplinesByRepo.has(d.r)) disciplinesByRepo.set(d.r, []);
  disciplinesByRepo.get(d.r).push(label);
}
const languagesByRepo = new Map();
for (const l of languageRows) {
  if (!languagesByRepo.has(l.r)) languagesByRepo.set(l.r, []);
  languagesByRepo.get(l.r).push(l.l);
}
const citationsByRepo = new Map();
for (const c of citationRows) {
  if (!citationsByRepo.has(c.r)) citationsByRepo.set(c.r, []);
  citationsByRepo.get(c.r).push(c.art);
}

const contribsByRepo = new Map();
for (const c of contribRows) {
  if (!contribsByRepo.has(c.repo)) contribsByRepo.set(c.repo, []);
  contribsByRepo.get(c.repo).push(c.user);
}
const socialByRepo = new Map();
for (const s of socialRows) {
  if (!socialByRepo.has(s.repo)) socialByRepo.set(s.repo, {});
  socialByRepo.get(s.repo)[s.t] = { edges: s.edges, users: s.users };
}
const commitsByRepo = new Map(
  repoBuckets.map((b) => [
    slugOf(b.key),
    {
      commits: b.doc_count,
      authors: b.authors.value,
      first: b.first.value_as_string?.slice(0, 10) ?? null,
      last: b.last.value_as_string?.slice(0, 10) ?? null,
    },
  ]),
);

const repos = repoRows.map((row) => {
  const m = byUrlMeta.get(row.url);
  const social = socialByRepo.get(row.url) ?? {};
  const gl = commitsByRepo.get(slugOf(row.url));
  return {
    slug: slugOf(row.url),
    name: row.name,
    org: slugOf(row.org),
    url: row.url,
    contributors: contribsByRepo.get(row.url)?.length ?? 0,
    stars: m?.st != null ? Number(m.st) : null,
    forks: m?.fk != null ? Number(m.fk) : null,
    prs: social.OPENED_PR?.edges ?? 0,
    issues: social.OPENED_ISSUE?.edges ?? 0,
    reviews: social.REVIEWED_PR?.edges ?? 0,
    stargazersInGraph: social.STARRED?.users ?? 0,
    type: m?.t ? shortIri(m.t) : null,
    disciplines: disciplinesByRepo.get(row.url) ?? [],
    languages: languagesByRepo.get(row.url) ?? [],
    license: m?.lic ? shortIri(m.lic) : null,
    created: m?.cr ? m.cr.slice(0, 10) : null,
    description: m?.d ?? null,
    inMetadataGraph: Boolean(m),
    stub: m?.stb === 'true',
    isFork: forkUrls.has(row.url),
    forkOf: forkParent.get(row.url) ? slugOf(forkParent.get(row.url)) : m?.fo ? slugOf(m.fo) : null,
    citationCff: Boolean(m?.ccf),
    citedBy: citationsByRepo.get(row.url)?.length ?? 0,
    commits: gl?.commits ?? null,
    lastCommit: gl?.last ?? null,
    firstCommit: gl?.first ?? null,
  };
});
repos.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || b.contributors - a.contributors);

const orgs = ENAC_ORGS.map((o) => ({
  slug: o,
  name: orgName.get(o) ?? o,
  repoCount: repos.filter((r) => r.org === o).length,
}));

await writeJson('repos.json', { meta, orgs, repos });

/* --- graph.json --- */

const userRepoCount = new Map();
const userName = new Map();
for (const c of contribRows) {
  userRepoCount.set(c.user, (userRepoCount.get(c.user) ?? 0) + 1);
  if (c.name) userName.set(c.user, c.name);
}
const usersByEdges = [...userRepoCount.entries()].sort((a, b) => b[1] - a[1]);
const keptUsers = new Set(
  usersByEdges.filter(([, n], i) => n >= 2 || i < 60).map(([u]) => u),
);
const keptRepos = new Set(
  repos.filter((r) => r.contributors > 0).map((r) => r.url),
);

const affByUser = new Map();
for (const a of affiliationRows) {
  if (!affByUser.has(a.user)) affByUser.set(a.user, []);
  affByUser.get(a.user).push(a);
}

const nodes = [];
const edges = [];
for (const o of orgs) {
  nodes.push({
    id: `https://github.com/${o.slug}`,
    type: 'Organisation',
    name: o.name,
    meta: [`${o.repoCount} repositories`],
  });
}
for (const r of repos) {
  if (!keptRepos.has(r.url)) continue;
  nodes.push({
    id: r.url,
    type: 'Repository',
    name: r.name,
    weight: r.contributors,
    lab: r.org,
    meta: [
      `${orgName.get(r.org) ?? r.org}`,
      `${r.contributors} contributors` + (r.stars != null ? ` · ★ ${r.stars}` : ''),
      ...(r.isFork ? [`fork of ${r.forkOf ?? 'an upstream project'}`] : []),
    ],
  });
  edges.push({ source: `https://github.com/${r.org}`, target: r.url, type: 'OWNS' });
}
const institutionIds = new Map();
for (const u of keptUsers) {
  nodes.push({
    id: u,
    type: 'Person',
    name: userName.get(u) ?? slugOf(u),
    weight: userRepoCount.get(u),
    meta: [`${userRepoCount.get(u)} ENAC repositories`],
  });
  for (const a of affByUser.get(u) ?? []) {
    const instId = a.ror ?? a.id ?? `inst:${a.name}`;
    if (!institutionIds.has(instId)) {
      institutionIds.set(instId, true);
      nodes.push({ id: instId, type: 'Institution', name: a.name ?? instId, meta: ['ROR-identified institution'] });
    }
    edges.push({ source: u, target: instId, type: 'AFFILIATED_WITH' });
  }
}
for (const c of contribRows) {
  if (keptUsers.has(c.user) && keptRepos.has(c.repo)) {
    edges.push({ source: c.user, target: c.repo, type: 'CONTRIBUTES_TO' });
  }
}
for (const m of memberRows) {
  if (keptUsers.has(m.user)) {
    edges.push({ source: m.user, target: m.org, type: 'MEMBER_OF' });
  }
}

/* lab ↔ lab: shared contributors (computed, rendered as its own matrix) */
const labUsers = new Map(ENAC_ORGS.map((o) => [o, new Set()]));
for (const c of contribRows) {
  const org = slugOf(c.repo).split('/')[0];
  labUsers.get(org)?.add(c.user);
}
const labLinks = [];
for (let i = 0; i < ENAC_ORGS.length; i++) {
  for (let j = i + 1; j < ENAC_ORGS.length; j++) {
    const a = labUsers.get(ENAC_ORGS[i]);
    const b = labUsers.get(ENAC_ORGS[j]);
    const shared = [...a].filter((u) => b.has(u)).length;
    if (shared > 0) labLinks.push({ a: ENAC_ORGS[i], b: ENAC_ORGS[j], shared });
  }
}
labLinks.sort((x, y) => y.shared - x.shared);

await writeJson('graph.json', {
  meta,
  nodes,
  edges,
  labLinks,
  stats: {
    totalUsers: userRepoCount.size,
    keptUsers: keptUsers.size,
    totalRepos: repos.length,
    keptRepos: keptRepos.size,
  },
});

/* --- health.json --- */

const months = histo.aggregations.months.buckets.map((b) => ({
  m: monthKey(b.key_as_string),
  commits: b.doc_count,
  authors: b.authors.value,
}));

const reposByYear = {};
for (const r of repos) {
  if (!r.created || r.isFork) continue;
  const y = r.created.slice(0, 4);
  reposByYear[y] = (reposByYear[y] ?? 0) + 1;
}
const years = Object.keys(reposByYear).sort();
let cum = 0;
const ecosystemGrowth = years.map((y) => {
  cum += reposByYear[y];
  return { year: y, created: reposByYear[y], cumulative: cum };
});

const firstByAuthor = authorAgg.aggregations.authors.buckets.map((b) => ({
  commits: b.doc_count,
  first: b.first.value_as_string,
}));
const newAuthorsByYear = {};
for (const a of firstByAuthor) {
  const y = a.first.slice(0, 4);
  newAuthorsByYear[y] = (newAuthorsByYear[y] ?? 0) + 1;
}

/* bus factor / elephant curve on commit shares */
const commitCounts = firstByAuthor.map((a) => a.commits).sort((a, b) => b - a);
const totalCommits = commitCounts.reduce((s, n) => s + n, 0);
let running = 0;
let busFactor = 0;
for (const n of commitCounts) {
  running += n;
  busFactor++;
  if (running >= totalCommits / 2) break;
}

const topAuthors = authorAgg.aggregations.names.buckets.map((b) => ({
  name: b.key,
  commits: b.doc_count,
  share: Math.round((1000 * b.doc_count) / totalCommits) / 10,
}));
const authorOrgs = authorAgg.aggregations.orgs.buckets.map((b) => ({
  org: b.key,
  commits: b.doc_count,
}));

const nowYear = Number(fetchedAt.slice(0, 4));
const last12 = months.filter((m) => m.m >= `${nowYear - 1}${fetchedAt.slice(4, 7)}`);

const chaossBySlug = new Map(
  chaossRepos.map((r) => [r.repo, Object.fromEntries(r.metrics.map((m) => [m.slug, m.value]))]),
);

const perRepo = repos
  .filter((r) => r.commits != null)
  .map((r) => ({
    slug: r.slug,
    org: r.org,
    isFork: r.isFork,
    commits: r.commits,
    authors: commitsByRepo.get(r.slug)?.authors ?? null,
    lastCommit: r.lastCommit,
    firstCommit: r.firstCommit,
    stars: r.stars,
    forks: r.forks,
    prs: r.prs,
    issues: r.issues,
    chaoss: chaossBySlug.get(r.slug) ?? null,
  }))
  .sort((a, b) => b.commits - a.commits);

const flagshipMonths = flagship.aggregations.months.buckets.map((b) => ({
  m: monthKey(b.key_as_string),
  commits: b.doc_count,
  authors: b.authors.value,
}));
const flagshipFirsts = flagship.aggregations.authors.buckets
  .map((b) => b.first.value_as_string.slice(0, 7))
  .sort();
let fcum = 0;
const flagshipContribGrowth = [];
for (const m of flagshipFirsts) {
  fcum++;
  const last = flagshipContribGrowth[flagshipContribGrowth.length - 1];
  if (last && last.m === m) last.cumulative = fcum;
  else flagshipContribGrowth.push({ m, cumulative: fcum });
}

await writeJson('health.json', {
  meta,
  ecosystem: {
    monthly: months,
    growth: ecosystemGrowth,
    newContributorsByYear: Object.entries(newAuthorsByYear)
      .map(([year, n]) => ({ year, n }))
      .sort((a, b) => a.year.localeCompare(b.year)),
  },
  totals: {
    commits: totalCommits,
    authors: histo.aggregations.total_authors.value,
    reposWithCommits: repoBuckets.length,
    commits12m: last12.reduce((s, m) => s + m.commits, 0),
    activeRepos12m: perRepo.filter(
      (r) => !r.isFork && r.lastCommit && r.lastCommit >= `${nowYear - 1}`,
    ).length,
    busFactor,
    forksExcluded: forkUrls.size,
  },
  community: { topAuthors, authorOrgs },
  perRepo,
  flagship: {
    slug: flagshipSlug,
    monthly: flagshipMonths,
    contributorGrowth: flagshipContribGrowth,
  },
  chaossTruncated,
});

/* --- impact.json --- */

const ghToOrcid = new Map();
for (const b of bridgeRows) {
  ghToOrcid.set(b.gh.replace(/\/$/, '').toLowerCase(), b.orcid);
}
const enacUsers = new Set(contribRows.map((c) => c.user));
const enacOrcids = new Map(); // orcid -> gh login (or null when only repo-linked)
for (const u of enacUsers) {
  const orcid = ghToOrcid.get(u.toLowerCase());
  if (orcid) enacOrcids.set(orcid, u);
}
/* ORCIDs attached to typed Contribution nodes on ENAC repos */
const orcidRepos = new Map(); // orcid -> Set(repo slug)
for (const c of contributionOrcidRows) {
  if (!enacOrcids.has(c.orcid)) enacOrcids.set(c.orcid, null);
  if (!orcidRepos.has(c.orcid)) orcidRepos.set(c.orcid, new Set());
  orcidRepos.get(c.orcid).add(slugOf(c.r));
}

const rorName = new Map(rorNameRows.map((r) => [r.ror, r.name]));
const articleMeta = new Map(articleRows.map((a) => [a.art, a]));
const articlesByAuthor = new Map();
for (const aa of articleAuthorRows) {
  if (!articlesByAuthor.has(aa.a)) articlesByAuthor.set(aa.a, []);
  articlesByAuthor.get(aa.a).push(aa.art);
}

const reposByUser = new Map();
for (const c of contribRows) {
  if (!reposByUser.has(c.user)) reposByUser.set(c.user, []);
  reposByUser.get(c.user).push(slugOf(c.repo));
}

const articleHits = new Map(); // art -> {viaOrcids, viaRepos}
for (const [orcid, gh] of enacOrcids) {
  for (const art of articlesByAuthor.get(orcid) ?? []) {
    if (!articleHits.has(art)) articleHits.set(art, { orcids: new Set(), repos: new Set() });
    const hit = articleHits.get(art);
    hit.orcids.add(orcid);
    for (const r of gh ? (reposByUser.get(gh) ?? []) : []) hit.repos.add(r);
    for (const r of orcidRepos.get(orcid) ?? []) hit.repos.add(r);
  }
}
/* plus the (sparse) direct repo→citation links */
for (const c of citationRows) {
  if (!articleHits.has(c.art)) articleHits.set(c.art, { orcids: new Set(), repos: new Set() });
  articleHits.get(c.art).repos.add(slugOf(c.r));
}

const articles = [...articleHits.entries()]
  .map(([art, hit]) => {
    const m = articleMeta.get(art) ?? {};
    return {
      iri: art,
      doi: m.d ?? (art.includes('doi.org/') ? art.split('doi.org/')[1] : null),
      title: m.t ?? null,
      date: m.dt ? m.dt.slice(0, 10) : null,
      infoscience: m.i ?? null,
      viaRepos: [...hit.repos].sort(),
      orcids: [...hit.orcids].sort(),
    };
  })
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

/* institutions reachable from ENAC ORCID contributors (org:hasMembership) */
const membershipsByUser = new Map();
for (const m of membershipRows) {
  if (!membershipsByUser.has(m.u)) membershipsByUser.set(m.u, []);
  membershipsByUser.get(m.u).push(m.o);
}
const instCount = new Map();
for (const orcid of enacOrcids.keys()) {
  for (const inst of membershipsByUser.get(orcid) ?? []) {
    const name = rorName.get(inst) ?? inst;
    if (name.startsWith('http')) continue; // unlabelled Infoscience orgunit IRIs
    instCount.set(name, (instCount.get(name) ?? 0) + 1);
  }
}
const orcidInstitutions = [...instCount.entries()]
  .map(([name, people]) => ({ name, people }))
  .sort((a, b) => b.people - a.people);

await writeJson('impact.json', {
  meta,
  totals: {
    articles: articles.length,
    withInfoscience: articles.filter((a) => a.infoscience).length,
    directRepoCitations: citationRows.length,
    contributorsWithOrcid: enacOrcids.size,
    contributorsTotal: enacUsers.size,
    linkedRepos: new Set(articles.flatMap((a) => a.viaRepos)).size,
    reposWithCff: repos.filter((r) => r.citationCff).length,
    reposInMetadataGraph: repos.filter((r) => r.inMetadataGraph).length,
    reposTotal: repos.length,
  },
  articles,
  orcidInstitutions,
});

/* --- coverage.json --- */

/* Gap lists cover original (non-fork) repos only — a vendored fork missing a
 * license is not an actionable ENAC to-do. */
const own = repos.filter((r) => !r.isFork);
const gap = (pred) => own.filter(pred).map((r) => r.slug);
const coverage = {
  meta,
  counts: {
    total: repos.length,
    forks: repos.length - own.length,
    original: own.length,
    inMetadataGraph: own.filter((r) => r.inMetadataGraph).length,
  },
  gaps: {
    notInMetadataGraph: gap((r) => !r.inMetadataGraph),
    stubs: gap((r) => r.stub),
    noLicense: gap((r) => r.inMetadataGraph && !r.license),
    noDiscipline: gap((r) => r.inMetadataGraph && r.disciplines.length === 0),
    noType: gap((r) => r.inMetadataGraph && !r.type),
    noLanguage: gap((r) => r.inMetadataGraph && r.languages.length === 0),
    noCitationFile: gap((r) => r.inMetadataGraph && !r.citationCff),
    noPublicationLink: gap((r) => r.inMetadataGraph && r.citedBy === 0),
  },
  perOrg: orgs.map((o) => {
    const rs = own.filter((r) => r.org === o.slug);
    return {
      org: o.slug,
      name: o.name,
      repos: rs.length,
      inMetadataGraph: rs.filter((r) => r.inMetadataGraph).length,
      noLicense: rs.filter((r) => r.inMetadataGraph && !r.license).length,
      noDiscipline: rs.filter((r) => r.inMetadataGraph && r.disciplines.length === 0).length,
    };
  }),
};
await writeJson('coverage.json', coverage);

/* --- summary.json (landing page headline numbers) --- */

const disciplineSet = new Set(repos.flatMap((r) => r.disciplines));
await writeJson('summary.json', {
  meta,
  headline: {
    repos: repos.length,
    original: own.length,
    forks: repos.length - own.length,
    contributors: enacUsers.size,
    labs: ENAC_ORGS.length,
    disciplines: disciplineSet.size,
    publications: articles.length,
    commits: totalCommits,
  },
  licenseCoverage: {
    withLicense: own.filter((r) => r.license).length,
    inMetadataGraph: own.filter((r) => r.inMetadataGraph).length,
  },
});

console.log('7/7 Done.');
