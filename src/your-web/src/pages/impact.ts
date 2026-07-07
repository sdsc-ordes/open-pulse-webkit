/* Theme 4 — Research Impact: "What does it produce?"
 * The software → papers → citations recognition story. Infoscience is the
 * *source* for publication links (via the metadata extractor), not a separate
 * section. Today the honest story is a funnel with a coverage bottleneck. */

import { renderShell } from '../shell';
import { el, section, card, fmtInt } from '../components/ui';
import { withProvenance } from '../components/provenance';
import { PROV } from '../components/provenance-presets';
import type { ImpactFile } from '../types';
import impactJson from '../data/impact.json';

const impact = impactJson as unknown as ImpactFile;
const t = impact.totals;

renderShell('impact');
const main = el('main');
document.querySelector('footer')!.before(main);

main.appendChild(
  section(
    'THEME 04 · RESEARCH IMPACT',
    'What does it produce?',
    `Software that feeds papers, and papers that credit software — the CHAOSS
     "Academic Open-Source Project Impact" story, and the core of the
     recognition case Open Pulse exists to make. The pipeline is wired
     (Infoscience → metadata extractor → this graph); linkage coverage is the
     current bottleneck, and it is shown honestly below.`,
  ),
);

/* --- the funnel --- */

const funnel = section(
  'THE CHAIN',
  'From repositories to recognised research',
  'Every step of the software → papers chain, with today’s actual coverage.',
);
const steps = [
  { n: t.reposTotal, label: 'ENAC repositories discovered', hint: 'Graph crawler (Neo4j)' },
  { n: t.reposInMetadataGraph, label: 'with extracted metadata', hint: 'git-metadata-extractor (SPARQL graph)' },
  { n: t.contributorsTotal, label: 'contributors identified', hint: 'Crawler contribution edges' },
  { n: t.contributorsWithOrcid, label: 'contributors ORCID-linked', hint: 'ORCID ↔ GitHub bridge + typed contributions' },
  { n: t.articles, label: 'publications linked to ENAC software', hint: 'Infoscience / DOI via extractor' },
];
const maxN = Math.max(...steps.map((s) => s.n));
const funnelBox = card();
for (const s of steps) {
  const row = el('div', 'op-funnel-row');
  row.innerHTML = `
    <span class="op-funnel-num mono">${fmtInt(s.n)}</span>
    <span class="op-funnel-track"><i style="width:${Math.max(1.2, (100 * s.n) / maxN)}%"></i></span>
    <span class="op-funnel-label">${s.label}<em class="faint">${s.hint}</em></span>`;
  funnelBox.appendChild(row);
}
withProvenance(
  funnelBox,
  PROV.mixed(
    ['Neo4j', 'GraphDB (SPARQL)', 'Infoscience'],
    ['Graph crawler', 'git-metadata-extractor (LLM)'],
    'Publication links require a contributor ORCID or an explicit repo citation; most ENAC contributors are not ORCID-linked yet, so linked publications undercount reality by a wide margin.',
  ),
);
funnel.appendChild(funnelBox);
main.appendChild(funnel);

/* --- linked publications --- */

const pubs = section(
  'LINKED PUBLICATIONS',
  `Publications linked today (${t.articles})`,
  'Each card is a scholarly article the platform can trace to an ENAC repository — via an explicit citation or a shared ORCID author.',
);
if (impact.articles.length === 0) {
  pubs.appendChild(card('<p class="text-2">No publications linked yet.</p>'));
}
const pubGrid = el('div', 'op-grid op-grid--2');
for (const a of impact.articles) {
  const c = card(
    `<p class="op-label">SCHOLARLY ARTICLE${a.date ? ` · ${a.date.slice(0, 4)}` : ''}</p>
     <h4>${a.title ?? a.iri}</h4>
     <p class="small" style="margin-top:10px">
       ${a.doi ? `<a class="mono" href="${a.doi.startsWith('http') ? a.doi : `https://doi.org/${a.doi}`}">DOI</a> · ` : ''}
       ${a.infoscience ? `<a href="${a.infoscience}">Infoscience record</a>` : ''}
     </p>
     <p class="small muted" style="margin-top:8px">via
       ${a.viaRepos.map((r) => `<a class="mono" href="https://github.com/${r}">${r}</a>`).join(', ')}</p>`,
  );
  pubGrid.appendChild(c);
}
pubs.appendChild(pubGrid);
pubs.appendChild(
  withProvenance(
    el('div'),
    PROV.mixed(
      ['GraphDB (SPARQL)', 'Infoscience'],
      'git-metadata-extractor (LLM)',
      'Infoscience is the source of record for EPFL publications; OpenAlex and EPFL Graph complement it. Links shown are machine-extracted and conservative.',
    ),
  ),
);
main.appendChild(pubs);

/* --- how recognition grows --- */

const grow = section(
  'CLOSING THE GAP',
  'How this page fills up',
  'Three lab-side actions make software→paper links machine-visible; the pipeline picks them up automatically on the next snapshot.',
);
const growGrid = el('div', 'op-grid op-grid--3');
const actions = [
  {
    title: 'Add a CITATION.cff',
    body: `A citation file makes a repository formally citable and machine-linkable to its paper.
           Today <strong>${t.reposWithCff}</strong> of ${fmtInt(t.reposInMetadataGraph)} ENAC repos with metadata have one.`,
  },
  {
    title: 'Link GitHub on ORCID',
    body: `The extractor bridges ORCID ↔ GitHub to connect commits to publications.
           <strong>${t.contributorsWithOrcid}</strong> of ${fmtInt(t.contributorsTotal)} ENAC contributors are bridged so far.`,
  },
  {
    title: 'Cite the software in the paper',
    body: `Explicit repo citations (in the paper or the Infoscience record) are the strongest signal —
           <strong>${t.directRepoCitations}</strong> exist today.`,
  },
];
for (const a of actions) {
  growGrid.appendChild(card(`<h4>${a.title}</h4><p class="text-2 small" style="margin-top:10px">${a.body}</p>`));
}
grow.appendChild(growGrid);
const cta = el(
  'div',
  'op-banner-loud',
  `<h4 style="color:#fff">These gaps are listed repo-by-repo in the coverage panel.</h4>
   <p style="margin-top:12px"><a class="op-btn op-btn--outline" style="color:#fff;border-color:rgba(255,255,255,0.5)" href="coverage.html">OPEN "WHAT'S MISSING?"</a></p>`,
);
cta.style.marginTop = '24px';
grow.appendChild(cta);
main.appendChild(grow);
