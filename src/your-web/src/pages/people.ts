/* Theme 2 — People & Community: "Who's behind it?"
 * The Neo4j layer: the full collaboration graph (reusable pulse-graph
 * component), lab↔lab bridges, cross-institution ties, top contributors. */

import { renderShell } from '../shell';
import { el, section, card, fmtInt } from '../components/ui';
import { withProvenance } from '../components/provenance';
import { PROV } from '../components/provenance-presets';
import { barList } from '../components/charts';
import {
  createPulseGraph,
  type PulseGraph,
  type PulseGraphNode,
} from '../components/pulse-graph';
import type { GraphFile, HealthFile, ImpactFile } from '../types';
import graphJson from '../data/graph.json';
import healthJson from '../data/health.json';
import impactJson from '../data/impact.json';

const graph = graphJson as unknown as GraphFile;
const health = healthJson as unknown as HealthFile;
const impact = impactJson as unknown as ImpactFile;

renderShell('people');
const main = el('main');
document.querySelector('footer')!.before(main);

/* --- head --- */

main.appendChild(
  section(
    'THEME 02 · PEOPLE & COMMUNITY',
    "Who's behind it?",
    `${fmtInt(graph.stats.totalUsers)} people contribute to ENAC repositories.
     The graph below shows the ${fmtInt(graph.stats.keptUsers)} who connect to
     two or more projects (or are top contributors), the repositories they
     work on, the lab organisations that own them — and the research
     institutions they are affiliated with.`,
  ),
);

/* --- the graph with lab filter + detail panel --- */

const graphSection = el('section', 'op-section op-container');
const controls = el('div', 'op-filterbar');
const labSel = el('select', 'op-select') as HTMLSelectElement;
labSel.append(new Option('All labs', ''));
for (const o of graph.nodes.filter((n) => n.type === 'Organisation')) {
  labSel.append(new Option(o.name, o.id));
}
const hint = el(
  'p',
  'small muted',
  'Person → lab (membership), person → repository (commits), lab → repository (ownership), person → institution (ROR affiliation).',
);
hint.style.alignSelf = 'center';
controls.append(labSel, hint);
graphSection.appendChild(controls);

const layout = el('div', 'op-graph-layout');
const canvas = el('div');
const panel = el('aside', 'op-card op-card--sm op-graph-panel');
panel.innerHTML = `<p class="op-chart-title">Node detail</p>
  <p class="small muted" style="margin-top:8px">Click a node to inspect it.</p>`;
layout.append(canvas, panel);
graphSection.appendChild(layout);
graphSection.appendChild(
  withProvenance(
    el('div'),
    PROV.neo4jGraph(
      'Contribution edges are all-time counts from the crawler — there are no per-event timestamps in the graph store. Single-repo contributors are hidden for readability; the totals above count everyone.',
    ),
  ),
);
main.appendChild(graphSection);

function showNode(n: PulseGraphNode | null): void {
  if (!n) {
    panel.innerHTML = `<p class="op-chart-title">Node detail</p>
      <p class="small muted" style="margin-top:8px">Click a node to inspect it.</p>`;
    return;
  }
  const link = n.id.startsWith('http')
    ? `<a href="${n.id}" class="small mono">${n.id.replace('https://', '')}</a>`
    : '';
  panel.innerHTML = `
    <p class="op-chart-title">${n.type}</p>
    <h4 style="margin-top:6px">${n.name}</h4>
    <div class="small text-2" style="margin-top:8px">${(n.meta ?? []).join('<br>')}</div>
    <p style="margin-top:12px">${link}</p>`;
}

let instance: PulseGraph | null = null;
function drawGraph(): void {
  instance?.destroy();
  let nodes = graph.nodes;
  let edges = graph.edges;
  if (labSel.value) {
    const lab = labSel.value;
    const labSlug = lab.replace('https://github.com/', '');
    const repoIds = new Set(
      graph.nodes.filter((n) => n.type === 'Repository' && n.lab === labSlug).map((n) => n.id),
    );
    const peopleIds = new Set(
      graph.edges
        .filter((e) => (repoIds.has(e.target) && e.type === 'CONTRIBUTES_TO') || (e.target === lab && e.type === 'MEMBER_OF'))
        .map((e) => e.source),
    );
    const instIds = new Set(
      graph.edges
        .filter((e) => e.type === 'AFFILIATED_WITH' && peopleIds.has(e.source))
        .map((e) => e.target),
    );
    const kept = new Set([lab, ...repoIds, ...peopleIds, ...instIds]);
    nodes = graph.nodes.filter((n) => kept.has(n.id));
    edges = graph.edges.filter((e) => kept.has(e.source) && kept.has(e.target));
  }
  instance = createPulseGraph(canvas, {
    nodes,
    edges,
    height: 640,
    onSelect: showNode,
  });
}
labSel.addEventListener('change', drawGraph);
requestAnimationFrame(drawGraph);

/* --- lab ↔ lab bridges --- */

const bridges = section(
  'LAB ↔ LAB',
  'Bridges between labs',
  'Two labs are connected when the same person has commits in repositories of both — the informal collaboration network behind the org chart.',
);
const bridgeCard = card(`<p class="op-chart-title">Shared contributors between lab organisations</p>`);
barList(
  bridgeCard,
  graph.labLinks.map((l) => ({ label: `${l.a} ↔ ${l.b}`, value: l.shared })),
  { total: 0, maxRows: 10, unit: ' people' },
);
withProvenance(
  bridgeCard,
  PROV.neo4jGraph('Derived from CONTRIBUTES_TO edges at snapshot build time; percentages omitted (overlaps are not exclusive).'),
);
bridges.appendChild(bridgeCard);
main.appendChild(bridges);

/* --- cross-institution + top contributors --- */

const communitySection = section(
  'BEYOND EPFL',
  'Cross-institution connections',
  'Where ENAC contributors are institutionally anchored, via two independent traces.',
);
const cGrid = el('div', 'op-grid op-grid--2');

const rorCard = card(`<p class="op-chart-title">Institutions of contributors (ROR affiliations)</p>`);
{
  const instCount = new Map<string, number>();
  for (const e of graph.edges.filter((e) => e.type === 'AFFILIATED_WITH')) {
    const inst = graph.nodes.find((n) => n.id === e.target);
    if (inst) instCount.set(inst.name, (instCount.get(inst.name) ?? 0) + 1);
  }
  barList(
    rorCard,
    [...instCount.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    { total: 0, maxRows: 10, unit: ' people' },
  );
}
withProvenance(
  rorCard,
  PROV.neo4jGraph(
    'AFFILIATED_WITH edges exist only for contributors the pipeline could match to a ROR identifier — coverage is partial.',
  ),
);

const orcidCard = card(`<p class="op-chart-title">Institutions via ORCID memberships</p>`);
barList(
  orcidCard,
  impact.orcidInstitutions.map((i) => ({ label: i.name, value: i.people })),
  { total: 0, maxRows: 10, unit: ' people' },
);
withProvenance(
  orcidCard,
  PROV.sparqlMeta(
    `Only ${impact.totals.contributorsWithOrcid} of ${impact.totals.contributorsTotal} contributors are ORCID-linked so far, mostly via Infoscience; unlabelled EPFL org-units are omitted.`,
  ),
);
cGrid.append(rorCard, orcidCard);
communitySection.appendChild(cGrid);
main.appendChild(communitySection);

const topSection = section(
  'TOP CONTRIBUTORS',
  'Who commits the most?',
  'By commits authored across all original ENAC repositories, all time.',
);
const topCard = card(`<p class="op-chart-title">Top committers (share of ${fmtInt(health.totals.commits)} commits)</p>`);
barList(
  topCard,
  health.community.topAuthors.slice(0, 15).map((a) => ({ label: a.name, value: a.commits })),
  { total: health.totals.commits, unit: '', maxRows: 15 },
);
withProvenance(
  topCard,
  PROV.grimoire(
    'Names come from git commit metadata and are not deduplicated across email addresses; vendored forks are excluded.',
  ),
);
topSection.appendChild(topCard);
main.appendChild(topSection);
