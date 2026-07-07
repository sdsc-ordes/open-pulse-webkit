/* Theme 1 — The Landscape: "What open source exists in ENAC?"
 * Descriptive inventory (type / discipline / license / language breakdowns)
 * plus a catalogue filterable well beyond name search. */

import { renderShell } from '../shell';
import {
  el,
  section,
  card,
  statTile,
  fmtInt,
  pct,
  badge,
  activityBadge,
  activityLevel,
  licenseFamily,
} from '../components/ui';
import { withProvenance } from '../components/provenance';
import { PROV, CLASSIFIER_CAVEAT } from '../components/provenance-presets';
import { barList } from '../components/charts';
import type { ReposFile, RepoEntry } from '../types';
import reposJson from '../data/repos.json';

const data = reposJson as unknown as ReposFile;
const { repos, orgs, meta } = data;
const own = repos.filter((r) => !r.isFork);
const inGraph = own.filter((r) => r.inMetadataGraph);

renderShell('landscape');
const main = el('main');
document.querySelector('footer')!.before(main);

/* --- head --- */

const head = section(
  'THEME 01 · THE LANDSCAPE',
  'What open source exists in ENAC?',
  `${fmtInt(repos.length)} repositories across ${orgs.length} lab organisations —
   ${fmtInt(own.length)} original projects and ${fmtInt(repos.length - own.length)} forks.
   Metadata (type, discipline, license) has been extracted for ${fmtInt(inGraph.length)} of the originals so far.`,
);
main.appendChild(head);

/* --- inventory stats --- */

const inv = el('div', 'op-container op-section');
const invGrid = el('div', 'op-grid op-grid--4');
invGrid.append(
  statTile({ num: fmtInt(repos.length), label: 'Repositories' }),
  statTile({ num: fmtInt(own.length), label: 'Original projects' }),
  statTile({ num: fmtInt(repos.length - own.length), label: 'Forks' }),
  statTile({
    num: pct(inGraph.length, own.length),
    label: 'With extracted metadata',
    href: 'coverage.html',
    go: "What's missing?",
  }),
);
inv.appendChild(invGrid);
main.appendChild(inv);

/* --- breakdowns --- */

const breakdownSection = section(
  'BREAKDOWNS',
  'The inventory, four ways',
  'Repository type and discipline come from the metadata graph (classifier-inferred); licenses are SPDX identifiers from GitHub; repos per lab from the crawler.',
);

/* open decision — flagged, not silently decided */
const decision = el(
  'div',
  'op-banner-soft',
  `<h4>⚑ Open framing decision</h4>
   <p class="text-2 small" style="margin-top:8px;max-width:860px">
     A handful of repositories are classified as <strong>Educational Resource</strong>
     or <strong>Data</strong> rather than Software. Whether ENAC's story should lead
     with Software only — or celebrate all types — is a framing call for the
     ENAC-IT4R team, <em>not</em> decided here: the catalogue below shows
     <strong>all types by default</strong> and the type filter makes either cut
     one click away.</p>`,
);
decision.style.marginBottom = '24px';
breakdownSection.appendChild(decision);

const bGrid = el('div', 'op-grid op-grid--2');

function countBy(rows: RepoEntry[], key: (r: RepoEntry) => string[]): { label: string; value: number }[] {
  const acc = new Map<string, number>();
  for (const r of rows) for (const k of key(r)) acc.set(k, (acc.get(k) ?? 0) + 1);
  return [...acc.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

const typeCard = card(`<p class="op-chart-title">By repository type</p>`);
barList(typeCard, countBy(own, (r) => [r.type ?? (r.inMetadataGraph ? 'Unclassified' : 'Not yet extracted')]), {
  total: own.length,
});
withProvenance(typeCard, PROV.sparqlMeta(CLASSIFIER_CAVEAT));

const discCard = card(`<p class="op-chart-title">By discipline (EPFL Graph, 1st level)</p>`);
barList(discCard, countBy(inGraph, (r) => (r.disciplines.length ? r.disciplines : ['None assigned'])), {
  total: inGraph.length,
});
withProvenance(
  discCard,
  PROV.sparqlMeta(
    `${CLASSIFIER_CAVEAT} A repo can carry several disciplines; percentages are of the ${fmtInt(inGraph.length)} repos with metadata.`,
  ),
);

const licCard = card(`<p class="op-chart-title">By license family</p>`);
barList(licCard, countBy(inGraph, (r) => [licenseFamily(r.license)]), { total: inGraph.length });
withProvenance(
  licCard,
  PROV.sparqlMeta(
    'SPDX identifier detected by GitHub. "None declared" is an actionable gap — see the coverage panel.',
  ),
);

const langCard = card(`<p class="op-chart-title">By primary language</p>`);
barList(langCard, countBy(inGraph, (r) => (r.languages.length ? r.languages : ['Unknown'])), {
  total: inGraph.length,
  maxRows: 10,
});
withProvenance(
  langCard,
  PROV.mixed('GitHub API', 'git-metadata-extractor (LLM)', 'Language as reported by GitHub for the default branch.'),
);

bGrid.append(typeCard, discCard, licCard, langCard);
breakdownSection.appendChild(bGrid);

const labCard = card(`<p class="op-chart-title">Repositories per lab organisation</p>`);
barList(
  labCard,
  orgs.map((o) => ({ label: o.name === o.slug ? o.slug : `${o.name} (${o.slug})`, value: o.repoCount })),
  { total: repos.length, maxRows: 12 },
);
withProvenance(labCard, PROV.neo4jGraph('GitHub organisations tagged as ENAC in the epfl-enac project definition.'));
labCard.style.marginTop = '24px';
breakdownSection.appendChild(labCard);
main.appendChild(breakdownSection);

/* --- catalogue --- */

const catalogue = section(
  'CATALOGUE',
  'Browse the repositories',
  'Filter by lab, type, license family, discipline and activity level — or search names and descriptions.',
);

const controls = el('div', 'op-filterbar');
const q = el('input', 'op-input') as HTMLInputElement;
q.placeholder = 'Search name or description…';
q.type = 'search';

function select(label: string, options: string[]): HTMLSelectElement {
  const s = el('select', 'op-select') as HTMLSelectElement;
  s.append(new Option(label, ''));
  for (const o of options) s.append(new Option(o, o));
  return s;
}

const labSel = select('All labs', orgs.map((o) => o.slug));
const typeSel = select('All types', [
  ...new Set(own.map((r) => r.type ?? '').filter(Boolean)),
  'Unclassified',
]);
const licSel = select('All licenses', [
  ...new Set(inGraph.map((r) => licenseFamily(r.license))),
]);
const discSel = select('All disciplines', [...new Set(own.flatMap((r) => r.disciplines))].sort());
const actSel = select('Any activity', ['active', 'quiet', 'dormant', 'unknown']);
const forkChk = el('label', 'op-check', `<input type="checkbox"> include forks`);
const forkInput = forkChk.querySelector('input') as HTMLInputElement;

controls.append(q, labSel, typeSel, licSel, discSel, actSel, forkChk);
catalogue.appendChild(controls);

const countLine = el('p', 'small muted');
countLine.style.margin = '12px 0';
catalogue.appendChild(countLine);

const tableWrap = el('div', 'op-table-wrap');
catalogue.appendChild(tableWrap);
const moreBtn = el('button', 'op-btn op-btn--outline', 'SHOW 50 MORE') as HTMLButtonElement;
moreBtn.style.marginTop = '16px';
catalogue.appendChild(moreBtn);

let shown = 25;
function applyFilters(): RepoEntry[] {
  const term = q.value.trim().toLowerCase();
  return repos.filter((r) => {
    if (!forkInput.checked && r.isFork) return false;
    if (labSel.value && r.org !== labSel.value) return false;
    if (typeSel.value) {
      const t = r.type ?? (r.inMetadataGraph ? 'Unclassified' : null);
      if (t !== typeSel.value) return false;
    }
    if (licSel.value && licenseFamily(r.license) !== licSel.value) return false;
    if (discSel.value && !r.disciplines.includes(discSel.value)) return false;
    if (actSel.value && activityLevel(r.lastCommit, meta.fetchedAt) !== actSel.value) return false;
    if (term && !(`${r.slug} ${r.description ?? ''}`.toLowerCase().includes(term))) return false;
    return true;
  });
}

function renderTable(): void {
  const rows = applyFilters();
  countLine.textContent = `${fmtInt(rows.length)} repositories match`;
  const body = rows
    .slice(0, shown)
    .map((r) => {
      const disc = r.disciplines.slice(0, 2).join(', ');
      return `<tr>
        <td>
          <a href="${r.url}" class="mono">${r.slug}</a>
          ${r.isFork ? badge('fork', 'pending') : ''}
          ${r.description ? `<div class="small muted">${r.description.slice(0, 110)}</div>` : ''}
        </td>
        <td>${r.type ? r.type : r.inMetadataGraph ? '<span class="faint">—</span>' : '<span class="faint">not extracted</span>'}</td>
        <td class="small">${disc || '<span class="faint">—</span>'}</td>
        <td class="mono small">${r.license ?? '<span class="faint">none</span>'}</td>
        <td class="small">${r.languages[0] ?? ''}</td>
        <td class="mono">${r.stars ?? ''}</td>
        <td class="mono">${r.contributors || ''}</td>
        <td>${activityBadge(r.lastCommit, meta.fetchedAt)}</td>
      </tr>`;
    })
    .join('');
  tableWrap.innerHTML = `<table class="op-table">
    <thead><tr>
      <th>Repository</th><th>Type</th><th>Discipline</th><th>License</th>
      <th>Lang</th><th>★</th><th>Contribs</th><th>Activity</th>
    </tr></thead>
    <tbody>${body}</tbody></table>`;
  moreBtn.style.display = rows.length > shown ? '' : 'none';
}

for (const c of [labSel, typeSel, licSel, discSel, actSel, forkInput]) {
  c.addEventListener('change', () => {
    shown = 25;
    renderTable();
  });
}
q.addEventListener('input', () => {
  shown = 25;
  renderTable();
});
moreBtn.addEventListener('click', () => {
  shown += 50;
  renderTable();
});
renderTable();

catalogue.appendChild(
  withProvenance(
    el('div'),
    PROV.mixed(
      ['Neo4j', 'GraphDB (SPARQL)', 'GrimoireLab'],
      ['Graph crawler', 'git-metadata-extractor (LLM)', 'Classifier'],
      `${CLASSIFIER_CAVEAT} Activity level is derived from the last commit indexed by GrimoireLab.`,
    ),
  ),
);
main.appendChild(catalogue);

/* --- latest additions (live repo feed) --- */

const feed = section(
  'LIVE FEED',
  'Latest additions',
  'The most recently created original repositories the crawler has discovered.',
);
const feedGrid = el('div', 'op-grid op-grid--4');
const latest = own
  .filter((r) => r.created)
  .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
  .slice(0, 8);
for (const r of latest) {
  const c = card(
    `<p class="mono small"><a href="${r.url}">${r.slug}</a></p>
     <p class="small muted" style="margin-top:6px">${r.description?.slice(0, 90) ?? ''}</p>
     <p class="micro faint" style="margin-top:10px">created <span class="mono">${r.created}</span></p>`,
    'op-card--sm',
  );
  feedGrid.appendChild(c);
}
feed.appendChild(feedGrid);
feed.appendChild(
  withProvenance(
    el('div'),
    PROV.sparqlMeta('Creation dates exist only for repos already processed by the metadata extractor.'),
  ),
);
main.appendChild(feed);
