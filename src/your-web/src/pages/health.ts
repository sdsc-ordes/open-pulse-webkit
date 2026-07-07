/* Theme 3 — Community Health & Activity: the CHAOSS home.
 * Structured around the three CHAOSS questions (popularity / community /
 * FAIR-quality), with growth-over-time folded in. Ecosystem growth and
 * per-repo growth are deliberately titled apart — they are different cuts. */

import { renderShell } from '../shell';
import { el, section, card, statTile, fmtInt, pct, activityBadge, badge } from '../components/ui';
import { withProvenance } from '../components/provenance';
import { PROV } from '../components/provenance-presets';
import { seriesChart, barList } from '../components/charts';
import type { HealthFile, ReposFile } from '../types';
import healthJson from '../data/health.json';
import reposJson from '../data/repos.json';

const health = healthJson as unknown as HealthFile;
const reposFile = reposJson as unknown as ReposFile;
const own = reposFile.repos.filter((r) => !r.isFork);
const inGraph = own.filter((r) => r.inMetadataGraph);

renderShell('health');
const main = el('main');
document.querySelector('footer')!.before(main);

main.appendChild(
  section(
    'THEME 03 · COMMUNITY HEALTH & ACTIVITY',
    'How alive and healthy is it?',
    `Community-health metrics after the CHAOSS model, computed over ENAC's
     original repositories (the ${health.totals.forksExcluded} vendored forks
     are excluded so upstream history doesn't masquerade as ENAC activity).
     Three questions: who uses it (popularity), who builds and sustains it
     (community), and can others reuse it (FAIR / quality).`,
  ),
);

/* --- headline totals --- */

const totals = el('div', 'op-container op-section');
const tGrid = el('div', 'op-grid op-grid--4');
tGrid.append(
  statTile({ num: fmtInt(health.totals.commits), label: 'Commits authored (all time)' }),
  statTile({ num: fmtInt(health.totals.authors), label: 'Distinct committers (all time)' }),
  statTile({ num: fmtInt(health.totals.commits12m), label: 'Commits, last 12 months' }),
  statTile({ num: fmtInt(health.totals.activeRepos12m), label: 'Repos active in last 12 months' }),
);
totals.appendChild(tGrid);
totals.appendChild(
  withProvenance(
    el('div'),
    PROV.grimoire('Commit counts from the GrimoireLab-enriched git index; committers deduplicated by identity UUID.'),
  ),
);
main.appendChild(totals);

/* --- ecosystem growth (explicitly NOT per-repo growth) --- */

const eco = section(
  'GROWTH · ECOSYSTEM',
  'Ecosystem growth — more ENAC repos over time',
  'These charts describe the whole ENAC portfolio: how many repositories exist and how much is committed across all of them. For a single project’s trajectory, see "Per-repo growth" below — the two are different data cuts.',
);
const ecoGrid = el('div', 'op-grid op-grid--2');

const activityCard = card(`<p class="op-chart-title">Commits per month, all original ENAC repos</p>`);
{
  const since = health.ecosystem.monthly.filter((m) => m.m >= '2012-01');
  const c = el('div');
  activityCard.appendChild(c);
  requestAnimationFrame(() =>
    seriesChart(c, since.map((m) => ({ x: m.m, y: m.commits })), { unit: 'commits' }),
  );
}
withProvenance(activityCard, PROV.grimoire('Truncated to 2012+ for legibility; vendored forks excluded.'));

const growthCard = card(
  `<p class="op-chart-title">New repositories created per year <span class="faint">(dashed: cumulative)</span></p>`,
);
{
  const c = el('div');
  growthCard.appendChild(c);
  requestAnimationFrame(() =>
    seriesChart(
      c,
      health.ecosystem.growth.map((g) => ({ x: g.year, y: g.created })),
      {
        kind: 'bars',
        unit: 'repos created',
        line: health.ecosystem.growth.map((g) => ({ x: g.year, y: g.cumulative })),
      },
    ),
  );
}
withProvenance(
  growthCard,
  PROV.sparqlMeta('Creation dates only exist for repos already processed by the metadata extractor — early years are undercounted.'),
);

const newContribCard = card(`<p class="op-chart-title">New contributors per year (first commit to any ENAC repo)</p>`);
{
  const c = el('div');
  newContribCard.appendChild(c);
  requestAnimationFrame(() =>
    seriesChart(
      c,
      health.ecosystem.newContributorsByYear.map((g) => ({ x: g.year, y: g.n })),
      { kind: 'bars', unit: 'new contributors' },
    ),
  );
}
withProvenance(newContribCard, PROV.grimoire('CHAOSS "New Contributors", computed ecosystem-wide from each identity’s first indexed commit.'));

ecoGrid.append(activityCard, growthCard);
eco.appendChild(ecoGrid);
newContribCard.style.marginTop = '24px';
eco.appendChild(newContribCard);
main.appendChild(eco);

/* --- per-repo growth --- */

const flagship = health.flagship;
const perRepoGrowth = section(
  'GROWTH · PER-REPO',
  `Per-repo growth — ${flagship.slug}`,
  'One project’s own trajectory: monthly commits and its cumulative contributor count. This is the largest ENAC-authored (non-fork) repository by commits.',
);
const flagCard = card(
  `<p class="op-chart-title">Commits per month <span class="faint">(dashed: cumulative contributors)</span></p>`,
);
{
  const c = el('div');
  flagCard.appendChild(c);
  requestAnimationFrame(() =>
    seriesChart(
      c,
      flagship.monthly.map((m) => ({ x: m.m, y: m.commits })),
      { unit: 'commits', line: flagship.contributorGrowth.map((g) => ({ x: g.m, y: g.cumulative })) },
    ),
  );
}
withProvenance(flagCard, PROV.grimoire('Contributor curve counts distinct identities by date of first commit to this repository.'));
perRepoGrowth.appendChild(flagCard);
main.appendChild(perRepoGrowth);

/* --- CHAOSS: community --- */

const community = section(
  'CHAOSS · COMMUNITY',
  'Who builds and sustains it?',
  'Contributor concentration is the sustainability risk to watch: a low absence factor means few people carry the ecosystem.',
);
const comGrid = el('div', 'op-grid op-grid--2');

const busCard = card(
  `<p class="op-chart-title">Contributor absence factor (bus factor)</p>
   <div class="op-bignum">${health.totals.busFactor}</div>
   <p class="text-2 small">contributors account for 50% of all ${fmtInt(health.totals.commits)} ENAC commits —
   out of ${fmtInt(health.totals.authors)} total committers. The CHAOSS "elephant factor" analogue for
   organisations is below.</p>`,
);
withProvenance(busCard, PROV.chaoss('CHAOSS Contributor Absence Factor, computed ecosystem-wide (per-repo values are typically 1–3).'));

const orgCard = card(`<p class="op-chart-title">Organizational diversity (commits by affiliation)</p>`);
const namedOrgs = health.community.authorOrgs.filter(
  (o) => o.org && !/unknown|undefined/i.test(o.org),
);
if (namedOrgs.length >= 2) {
  barList(
    orgCard,
    namedOrgs.map((o) => ({ label: o.org, value: o.commits })),
    { total: health.totals.commits, maxRows: 8 },
  );
} else {
  orgCard.appendChild(
    el(
      'p',
      'text-2 small',
      `Not computable yet: GrimoireLab identity profiles carry no organisation for
       ENAC committers, so commits cannot be attributed to institutions here.
       For institutional ties, see the two affiliation traces on
       <a href="people.html">People &amp; Community</a>.`,
    ),
  );
}
withProvenance(
  orgCard,
  PROV.grimoire('CHAOSS "Organizational Diversity" needs affiliations in the GrimoireLab identity database — a known enrichment gap.'),
);

comGrid.append(busCard, orgCard);
community.appendChild(comGrid);
main.appendChild(community);

/* --- CHAOSS: popularity --- */

const popularity = section(
  'CHAOSS · POPULARITY',
  'Who sees, uses and reuses it?',
  'Stars, watchers and technical forks are the reuse signals the platform indexes today. Download and clone counts are not collected yet.',
);
const popGrid = el('div', 'op-grid op-grid--2');

const starCard = card(`<p class="op-chart-title">Most-starred original repositories</p>`);
barList(
  starCard,
  own
    .filter((r) => (r.stars ?? 0) > 0)
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
    .slice(0, 10)
    .map((r) => ({ label: r.slug, value: r.stars ?? 0 })),
  { total: 0, maxRows: 10, unit: ' ★' },
);
withProvenance(starCard, PROV.sparqlMeta('GitHub star counts at last extraction.'));

const forkCard = card(
  `<p class="op-chart-title">Technical forks of ENAC projects</p>
   <div class="op-bignum">${fmtInt(own.reduce((s, r) => s + (r.forks ?? 0), 0))}</div>
   <p class="text-2 small">GitHub-reported forks of ENAC original repositories — each one is somebody
   building on ENAC code. Stargazers the crawler has walked:
   ${fmtInt(own.reduce((s, r) => s + r.stargazersInGraph, 0))}.</p>`,
);
withProvenance(forkCard, PROV.mixed(['GraphDB (SPARQL)', 'Neo4j'], 'CHAOSS metrics API', 'CHAOSS "Technical Fork". GitHub-reported totals from the last extraction; in-graph counts are the subset the crawler walked.'));

popGrid.append(starCard, forkCard);
popularity.appendChild(popGrid);
main.appendChild(popularity);

/* --- CHAOSS: FAIR / quality --- */

const fair = section(
  'CHAOSS · FAIR & QUALITY',
  'Can others understand and reuse it?',
  'Licensing and documentation signals — the reuse preconditions.',
);
const fairGrid = el('div', 'op-grid op-grid--3');
const withLicense = inGraph.filter((r) => r.license).length;
fairGrid.append(
  statTile({
    num: pct(withLicense, inGraph.length),
    label: 'Licenses declared',
    sub: `${withLicense} of ${inGraph.length} repos with metadata`,
    href: 'coverage.html',
    go: 'See the gap list',
  }),
  statTile({
    num: pct(inGraph.filter((r) => r.type).length, inGraph.length),
    label: 'Repository type classified',
    href: 'landscape.html',
    go: 'The Landscape',
  }),
  statTile({
    num: String(own.filter((r) => r.citationCff).length),
    label: 'With a CITATION.cff',
    sub: 'citability gap — see Research Impact',
    href: 'impact.html',
    go: 'Research Impact',
  }),
);
fair.appendChild(fairGrid);
fair.appendChild(
  withProvenance(
    el('div'),
    PROV.chaoss(
      'CHAOSS "Licenses Declared" / "License Coverage". Documentation-discoverability scoring is not yet computed for ENAC repos.',
    ),
  ),
);
main.appendChild(fair);

/* --- per-repo health table --- */

const table = section(
  'PER-REPO',
  'Repository health leaderboard',
  `The ${health.chaossTruncated ? 'most active' : ''} original repositories by all-time commits.`,
);
const wrap = el('div', 'op-table-wrap');
const top = health.perRepo.filter((r) => !r.isFork).slice(0, 20);
wrap.innerHTML = `<table class="op-table">
  <thead><tr>
    <th>Repository</th><th>Commits</th><th>Committers</th><th>★</th>
    <th>PRs opened</th><th>Issues opened</th><th>Last commit</th><th>Activity</th>
  </tr></thead>
  <tbody>${top
    .map(
      (r) => `<tr>
        <td><a class="mono" href="https://github.com/${r.slug}">${r.slug}</a></td>
        <td class="mono">${fmtInt(r.commits)}</td>
        <td class="mono">${r.authors ?? ''}</td>
        <td class="mono">${r.stars ?? ''}</td>
        <td class="mono">${r.prs || ''}</td>
        <td class="mono">${r.issues || ''}</td>
        <td class="mono small">${r.lastCommit ?? ''}</td>
        <td>${activityBadge(r.lastCommit, health.meta.fetchedAt)}</td>
      </tr>`,
    )
    .join('')}</tbody></table>`;
table.appendChild(wrap);
if (health.chaossTruncated) {
  table.appendChild(
    el(
      'p',
      'small faint',
      `${badge('note', 'blue')} The hub's per-repo CHAOSS table samples 150 of the project's repositories; commit counts here come straight from GrimoireLab and cover everything.`,
    ),
  );
}
table.appendChild(
  withProvenance(
    el('div'),
    PROV.mixed(
      ['GrimoireLab', 'Neo4j'],
      ['Direct query', 'Graph crawler'],
      'PR/issue counts are crawler edge counts (no timestamps); commits and committers from the git index.',
    ),
  ),
);
main.appendChild(table);
