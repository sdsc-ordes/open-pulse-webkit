/* __TITLE__ — card-grid archetype (frontend-dev §7.4), scaffolded by the
 * pulseWebKit setup wizard.
 *
 * Sample data lives in src/data/__SLUG__.json. Replace it with a real
 * snapshot written by your fetch-data step (see scripts/fetch-data.mjs for
 * how the ENAC dashboard does it), adjust the interfaces below to match,
 * then delete this note. */

import { renderShell } from '../shell';
import { el, section, card, statTile, badge, fmtInt } from '../components/ui';
import dataJson from '../data/__SLUG__.json';

type ItemStatus = 'success' | 'running' | 'error' | 'pending' | 'warning';

interface CardItem {
  id: string;
  name: string;
  status: ItemStatus;
  /** Human wording for the badge, e.g. "operational", "degraded". */
  statusLabel: string;
  description: string;
  metricLabel: string;
  metricValue: number;
}

interface CardsFile {
  generatedAt: string;
  items: CardItem[];
}

const data = dataJson as unknown as CardsFile;

renderShell('__SLUG__');
const main = el('main');
document.querySelector('footer')!.before(main);

main.appendChild(
  section(
    '__LABEL__',
    '__TITLE__',
    `One card per item with a status badge — the mixed-status card-grid
     archetype. The cards below render sample data from
     src/data/__SLUG__.json; replace it with a snapshot from your own
     data-fetch step.`,
  ),
);

/* --- headline numbers --- */

const stats = el('div', 'op-container op-section');
const sGrid = el('div', 'op-grid op-grid--4');
const count = (s: ItemStatus) => data.items.filter((i) => i.status === s).length;
sGrid.append(
  statTile({ num: fmtInt(data.items.length), label: 'Items tracked' }),
  statTile({ num: fmtInt(count('success')), label: 'Healthy' }),
  statTile({ num: fmtInt(count('warning')), label: 'Degraded' }),
  statTile({ num: fmtInt(count('error')), label: 'Failing' }),
);
stats.appendChild(sGrid);
main.appendChild(stats);

/* --- the grid --- */

const gridSection = section('ITEM BY ITEM', 'Current status');
const grid = el('div', 'op-grid op-grid--3');
for (const item of data.items) {
  grid.appendChild(
    card(
      `<div class="op-gap-head">
         <h4>${item.name}</h4>
         ${badge(item.statusLabel, item.status)}
       </div>
       <p class="small text-2" style="margin-top:8px">${item.description}</p>
       <p class="small muted" style="margin-top:6px">${item.metricLabel}:
         <span class="mono">${fmtInt(item.metricValue)}</span></p>`,
      'op-card--sm',
    ),
  );
}
gridSection.appendChild(grid);
main.appendChild(gridSection);
