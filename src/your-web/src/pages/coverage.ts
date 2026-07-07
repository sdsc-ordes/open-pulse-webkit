/* "What's missing?" — the first-class data-quality panel.
 * Turns every metadata gap into an actionable to-do list for ENAC-IT4R. */

import { renderShell } from '../shell';
import { el, section, card, statTile, fmtInt, pct } from '../components/ui';
import { withProvenance } from '../components/provenance';
import { PROV, CLASSIFIER_CAVEAT } from '../components/provenance-presets';
import type { CoverageFile } from '../types';
import coverageJson from '../data/coverage.json';

const cov = coverageJson as unknown as CoverageFile;

renderShell('coverage');
const main = el('main');
document.querySelector('footer')!.before(main);

main.appendChild(
  section(
    'DATA QUALITY',
    "What's missing?",
    `Open Pulse can only make visible what it can see. This panel lists every
     original ENAC repository (forks excluded) with a metadata gap — each list
     is a concrete to-do for the ENAC-IT4R team or the lab that owns the repo.`,
  ),
);

/* --- headline coverage --- */

const stats = el('div', 'op-container op-section');
const sGrid = el('div', 'op-grid op-grid--4');
sGrid.append(
  statTile({ num: fmtInt(cov.counts.original), label: 'Original repositories' }),
  statTile({
    num: pct(cov.counts.inMetadataGraph, cov.counts.original),
    label: 'Metadata extracted',
    sub: `${fmtInt(cov.counts.inMetadataGraph)} of ${fmtInt(cov.counts.original)}`,
  }),
  statTile({
    num: fmtInt(cov.gaps.noLicense?.length ?? 0),
    label: 'No declared license',
  }),
  statTile({
    num: fmtInt(cov.gaps.noPublicationLink?.length ?? 0),
    label: 'No publication link',
  }),
);
stats.appendChild(sGrid);
main.appendChild(stats);

/* --- gap lists --- */

const GAPS: { key: string; title: string; why: string; fix: string }[] = [
  {
    key: 'notInMetadataGraph',
    title: 'Not yet in the metadata graph',
    why: 'The crawler found these repos but the metadata extractor has not processed them — no type, discipline or license is known.',
    fix: 'Pipeline-side: include in the next extractor quest.',
  },
  {
    key: 'stubs',
    title: 'Extracted as stubs only',
    why: 'The extractor created a placeholder but could not fill the metadata fields.',
    fix: 'Pipeline-side: re-run extraction; check repo visibility.',
  },
  {
    key: 'noLicense',
    title: 'No declared license',
    why: 'Without a license the code is legally unusable by others — the single most impactful gap.',
    fix: 'Lab-side: add a LICENSE file (EPFL recommends permissive unless there is a reason not to).',
  },
  {
    key: 'noType',
    title: 'Repository type unclassified',
    why: 'The classifier could not decide whether this is Software, Data, or an Educational Resource.',
    fix: 'Lab-side: a clear README first paragraph usually fixes this.',
  },
  {
    key: 'noDiscipline',
    title: 'No discipline assigned',
    why: 'These repos do not appear in any discipline breakdown.',
    fix: 'Lab-side: add topics/keywords to the GitHub repo.',
  },
  {
    key: 'noLanguage',
    title: 'No programming language recorded',
    why: 'Usually an empty or documentation-only repository.',
    fix: 'Review: archive if abandoned, or push code.',
  },
  {
    key: 'noCitationFile',
    title: 'No CITATION.cff',
    why: 'Without a citation file the software cannot be cited properly, breaking the recognition chain.',
    fix: 'Lab-side: add CITATION.cff (cffinit generates one in 2 minutes).',
  },
  {
    key: 'noPublicationLink',
    title: 'No linked publication',
    why: 'No machine-readable path from this software to any paper.',
    fix: 'Lab-side: cite the repo in the paper / deposit in Infoscience; link ORCID.',
  },
];

const gapsSection = section('THE TO-DO LISTS', 'Gaps, repo by repo');
const gapGrid = el('div', 'op-grid op-grid--2');
for (const g of GAPS) {
  const slugs = cov.gaps[g.key] ?? [];
  const c = card(
    `<div class="op-gap-head">
       <h4>${g.title}</h4>
       <span class="op-gap-count mono">${fmtInt(slugs.length)}</span>
     </div>
     <p class="small text-2" style="margin-top:8px">${g.why}</p>
     <p class="small muted" style="margin-top:6px"><strong>Fix:</strong> ${g.fix}</p>`,
    'op-card--sm',
  );
  if (slugs.length) {
    const details = el('details', 'op-gaplist');
    details.innerHTML = `<summary>Show the ${fmtInt(slugs.length)} repos</summary>
      <div class="op-chips">${slugs
        .map((s) => `<a class="op-chip mono" href="https://github.com/${s}">${s}</a>`)
        .join('')}</div>`;
    c.appendChild(details);
  }
  gapGrid.appendChild(c);
}
gapsSection.appendChild(gapGrid);
gapsSection.appendChild(
  withProvenance(
    el('div'),
    PROV.mixed(
      ['Neo4j', 'GraphDB (SPARQL)'],
      ['Graph crawler', 'git-metadata-extractor (LLM)', 'Classifier'],
      `${CLASSIFIER_CAVEAT} Gap lists cover original repos only; a fork missing a license is not an ENAC to-do.`,
    ),
  ),
);
main.appendChild(gapsSection);

/* --- per-lab rollup --- */

const perOrg = section(
  'BY LAB',
  'Where the gaps live',
  'Extraction coverage and the two highest-value gaps, per lab organisation.',
);
const wrap = el('div', 'op-table-wrap');
wrap.innerHTML = `<table class="op-table">
  <thead><tr>
    <th>Lab organisation</th><th>Original repos</th><th>Metadata extracted</th>
    <th>No license</th><th>No discipline</th>
  </tr></thead>
  <tbody>${cov.perOrg
    .map(
      (o) => `<tr>
      <td><a class="mono" href="https://github.com/${o.org}">${o.org}</a>
          ${o.name && o.name !== o.org ? `<div class="small muted">${o.name}</div>` : ''}</td>
      <td class="mono">${o.repos}</td>
      <td class="mono">${o.inMetadataGraph} <span class="faint">(${pct(o.inMetadataGraph, o.repos)})</span></td>
      <td class="mono">${o.noLicense}</td>
      <td class="mono">${o.noDiscipline}</td>
    </tr>`,
    )
    .join('')}</tbody></table>`;
perOrg.appendChild(wrap);
main.appendChild(perOrg);

/* --- how gaps close --- */

const how = section('PIPELINE', 'How gaps close');
how.appendChild(
  card(
    `<p class="text-2">
       The <strong>graph crawler</strong> discovers repositories from seed
       organisations; the <strong>git-metadata-extractor</strong> pulls GitHub /
       ORCID / DOI metadata and an LLM agent fills missing fields and matches
       repos to Infoscience, ROR and EPFL Graph disciplines; a
       <strong>classifier</strong> decides EPFL-relatedness. Snapshots are
       published to Zenodo and Hugging Face, and this dashboard is rebuilt from
       the latest snapshot — fix a gap upstream (LICENSE, CITATION.cff, ORCID
       link) and it disappears here on the next build.
     </p>`,
  ),
);
main.appendChild(how);
