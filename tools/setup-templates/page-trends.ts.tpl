/* __TITLE__ — trends archetype, scaffolded by the pulseWebKit setup wizard.
 *
 * Headline stat tiles plus an interactive time-series chart, routed through
 * the four chart states (frontend-dev §6.8). Sample data lives in
 * src/data/__SLUG__.json — replace it with a real snapshot from your
 * data-fetch step, then delete this note. */

import { renderShell } from '../shell';
import { el, section, card, statTile, trendBadge, fmtInt } from '../components/ui';
import { seriesChart } from '../components/charts';
import type { SeriesPoint } from '../components/charts';
import { renderChartState } from '../components/chart-state';
import dataJson from '../data/__SLUG__.json';

interface TrendsFile {
  generatedAt: string;
  /** What one y-unit means, e.g. "commits". Shown in the hover readout. */
  unit: string;
  /** One complete period per point (e.g. one month). Keep the in-progress
   * period out of the snapshot — a partial last point reads as a false
   * decline (see trendBadge()). */
  series: { x: string; y: number }[];
}

const data = dataJson as unknown as TrendsFile;

renderShell('__SLUG__');
const main = el('main');
document.querySelector('footer')!.before(main);

main.appendChild(
  section(
    '__LABEL__',
    '__TITLE__',
    `Trends archetype: headline numbers with a period-over-period arrow, and
     the full series as an interactive chart below. Sample data from
     src/data/__SLUG__.json.`,
  ),
);

/* --- headline tiles --- */

const points: SeriesPoint[] = data.series;
const total = points.reduce((s, p) => s + p.y, 0);
const latest = points[points.length - 1];
const previous = points[points.length - 2];

const stats = el('div', 'op-container op-section');
const sGrid = el('div', 'op-grid op-grid--3');
sGrid.append(
  statTile({ num: fmtInt(total), label: `Total ${data.unit}` }),
  statTile({
    num: latest ? fmtInt(latest.y) : '—',
    label: latest ? `${data.unit} in ${latest.x}` : 'Latest period',
    trend:
      latest && previous
        ? trendBadge(latest.y, previous.y, 'vs the previous period')
        : undefined,
  }),
  statTile({
    num: fmtInt(points.length),
    label: 'Periods in this snapshot',
  }),
);
stats.appendChild(sGrid);
main.appendChild(stats);

/* --- the chart --- */

const chartSection = section('OVER TIME', 'The full series');
const chartCard = card();
const host = el('div');
chartCard.appendChild(host);
chartCard.appendChild(
  el('p', 'small muted', `One point per period; hover for the exact ${data.unit} count.`),
);
chartSection.appendChild(chartCard);
main.appendChild(chartSection);

const HEIGHT = 300;
// seriesChart measures its container, so it needs a layout frame first:
// skeleton synchronously, real chart inside requestAnimationFrame (§6.8).
renderChartState<SeriesPoint[]>(host, HEIGHT, { status: 'loading' }, () => {});
requestAnimationFrame(() => {
  renderChartState<SeriesPoint[]>(
    host,
    HEIGHT,
    points.length ? { status: 'loaded', data: points } : { status: 'empty' },
    (container, pts) => seriesChart(container, pts, { height: HEIGHT, unit: data.unit }),
  );
});
