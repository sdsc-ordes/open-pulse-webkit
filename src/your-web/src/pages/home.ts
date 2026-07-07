/* Landing page — "ENAC Open Source at a glance".
 * Headline numbers + the signature collaboration graph; every element links
 * down into one of the four themes (or the coverage panel). */

import { renderShell } from '../shell';
import { el, section, statTile, fmtInt, card } from '../components/ui';
import { withProvenance } from '../components/provenance';
import { PROV } from '../components/provenance-presets';
import { createPulseGraph } from '../components/pulse-graph';
import type { GraphFile, SummaryFile } from '../types';
import summaryJson from '../data/summary.json';
import graphJson from '../data/graph.json';

const summary = summaryJson as SummaryFile;
const graph = graphJson as unknown as GraphFile;

renderShell('home');
const main = el('main');
document.querySelector('footer')!.before(main);

/* --- hero --- */

const hero = el('section', 'op-container op-hero');
hero.innerHTML = `
  <p class="op-label">EPFL ENAC · OPEN PULSE</p>
  <h1>ENAC open source<br>at a glance</h1>
  <p class="op-lead" style="margin-top:16px">
    What open-source software the School of Architecture, Civil and
    Environmental Engineering produces, who builds it, how healthy it is, and
    what research it feeds. Discovered and monitored automatically by
    <a href="https://openpulse.science">Open Pulse</a> — snapshot of
    <span class="mono">${summary.meta.fetchedAt.slice(0, 10)}</span>.
  </p>`;
main.appendChild(hero);

/* --- headline numbers --- */

const h = summary.headline;
const numbers = el('section', 'op-section');
const band = el('div', 'op-keynumbers');
const bandInner = el('div', 'op-container op-grid op-grid--6');
bandInner.append(
  statTile({
    num: fmtInt(h.repos),
    label: 'Repositories',
    sub: `${fmtInt(h.original)} original · ${fmtInt(h.forks)} forks`,
    href: 'landscape.html',
    go: 'The Landscape',
  }),
  statTile({
    num: fmtInt(h.contributors),
    label: 'Contributors',
    href: 'people.html',
    go: 'People & Community',
  }),
  statTile({ num: fmtInt(h.labs), label: 'Lab organisations', href: 'people.html', go: 'People & Community' }),
  statTile({
    num: fmtInt(h.disciplines),
    label: 'Disciplines covered',
    href: 'landscape.html',
    go: 'The Landscape',
  }),
  statTile({
    num: fmtInt(h.commits),
    label: 'Commits authored',
    sub: 'vendored forks excluded',
    href: 'health.html',
    go: 'Health & Activity',
  }),
  statTile({
    num: fmtInt(h.publications),
    label: 'Publications linked',
    sub: 'coverage is the bottleneck',
    href: 'impact.html',
    go: 'Research Impact',
  }),
);
band.appendChild(bandInner);
numbers.appendChild(band);
const numbersProv = el('div', 'op-container');
numbersProv.appendChild(
  withProvenance(
    el('div'),
    PROV.mixed(
      ['Neo4j', 'GraphDB (SPARQL)', 'GrimoireLab'],
      ['Graph crawler', 'git-metadata-extractor (LLM)', 'Classifier'],
      'Counts cover the 12 ENAC lab GitHub organisations tagged in the epfl-enac project. Repos the crawler has not yet walked are missing.',
    ),
  ),
);
numbers.appendChild(numbersProv);
main.appendChild(numbers);

/* --- signature visual: trimmed collaboration graph --- */

const graphSection = section(
  'SIGNATURE VISUAL',
  'The collaboration constellation',
  'Labs (purple), their most-connected repositories (blue) and the people who commit to them (green). Hover to focus a neighbourhood, click to pin it.',
);
const graphCard = el('div');

const orgNodes = graph.nodes.filter((n) => n.type === 'Organisation');
const topRepos = graph.nodes
  .filter((n) => n.type === 'Repository')
  .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  .slice(0, 70);
const topPeople = graph.nodes
  .filter((n) => n.type === 'Person')
  .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  .slice(0, 45);
const kept = new Set([...orgNodes, ...topRepos, ...topPeople].map((n) => n.id));
const trimmedEdges = graph.edges.filter((e) => kept.has(e.source) && kept.has(e.target));
// keep people connected to a visible repo/org only
const connected = new Set(trimmedEdges.flatMap((e) => [e.source, e.target]));
const trimmedNodes = [...orgNodes, ...topRepos, ...topPeople].filter(
  (n) => n.type === 'Organisation' || connected.has(n.id),
);

const canvas = el('div');
graphCard.appendChild(canvas);
graphSection.appendChild(graphCard);
const goFull = el(
  'p',
  'small',
  `Trimmed to the ${trimmedNodes.length} most-connected nodes —
   <a href="people.html">explore all ${fmtInt(graph.stats.keptRepos)} repositories and ${fmtInt(graph.stats.keptUsers)} people →</a>`,
);
goFull.style.marginTop = '12px';
graphSection.appendChild(goFull);
graphSection.appendChild(
  withProvenance(
    el('div'),
    PROV.neo4jGraph(
      'Only contributors the crawler has walked appear; people with a single repository connection are hidden here for readability.',
    ),
  ),
);
main.appendChild(graphSection);

requestAnimationFrame(() => {
  createPulseGraph(canvas, {
    nodes: trimmedNodes,
    edges: trimmedEdges,
    height: 540,
  });
});

/* --- theme cards --- */

const themes = section(
  'THE FOUR THEMES',
  'Drill down',
  'The landing page is the summary; each theme answers one question with clear data provenance.',
);
const themeGrid = el('div', 'op-grid op-grid--2');
const themeDefs = [
  {
    href: 'landscape.html',
    label: '01 · THE LANDSCAPE',
    title: 'What open source exists in ENAC?',
    body: 'The descriptive inventory: repository types, disciplines, licenses, languages — and a catalogue you can filter by lab, type, license family and activity level.',
  },
  {
    href: 'people.html',
    label: '02 · PEOPLE & COMMUNITY',
    title: "Who's behind it?",
    body: 'The collaboration network: person → lab, lab → repository, lab ↔ lab and cross-institution connections, straight from the graph database.',
  },
  {
    href: 'health.html',
    label: '03 · HEALTH & ACTIVITY',
    title: 'How alive and healthy is it?',
    body: 'CHAOSS community-health metrics: popularity (who uses it), community (who builds and sustains it), and FAIR quality (can others reuse it).',
  },
  {
    href: 'impact.html',
    label: '04 · RESEARCH IMPACT',
    title: 'What does it produce?',
    body: 'The software → papers → citations recognition story, linked through Infoscience, ORCID and DOIs.',
  },
];
for (const t of themeDefs) {
  const a = el('a', 'op-card op-theme-card');
  (a as HTMLAnchorElement).href = t.href;
  a.innerHTML = `
    <p class="op-label">${t.label}</p>
    <h3>${t.title}</h3>
    <p class="text-2" style="margin-top:10px">${t.body}</p>
    <p class="go" style="margin-top:14px;color:var(--op-blue-light)">Open theme →</p>`;
  themeGrid.appendChild(a);
}
themes.appendChild(themeGrid);

const coverageBanner = card(
  `<div class="op-coverage-banner">
     <div>
       <h4>What's missing?</h4>
       <p class="text-2 small" style="margin-top:6px">
         The data-quality panel lists every repo with no declared license, no
         discipline, no linked publication — an actionable to-do list for the
         ENAC-IT4R team.
       </p>
     </div>
     <a class="op-btn op-btn--outline" href="coverage.html">Open the coverage panel</a>
   </div>`,
  'op-card--sm',
);
coverageBanner.style.marginTop = '24px';
themes.appendChild(coverageBanner);
main.appendChild(themes);
