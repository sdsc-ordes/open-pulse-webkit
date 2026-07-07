/* Small D3 chart set for the dashboard. All charts are interactive (hover
 * readouts) and draw with hex literals from the frontend-dev §8 palette —
 * SVG drawing code is the sanctioned exception to the no-hex rule. */

import { scaleLinear, scaleBand, select, line as d3line, area as d3area, max } from 'd3';

const C = {
  blue: '#5461a6',
  blueLight: '#8a94c9',
  blueDark: '#26245c',
  grid: '#242438',
  text: '#9898b8',
  textFaint: '#6a6a88',
  bg: '#0c0c12',
};
const FONT = "'Switzer', system-ui, sans-serif";

export interface SeriesPoint {
  /** x label, e.g. "2021-03" or "2021" */
  x: string;
  y: number;
}

interface ChartOpts {
  height?: number;
  /** shown in the hover readout after the value */
  unit?: string;
  color?: string;
  /** draw as area (default) or bars */
  kind?: 'area' | 'bars';
  /** secondary line series drawn on its own scale (e.g. cumulative) */
  line?: SeriesPoint[];
  lineUnit?: string;
}

/** Time/ordinal series chart with a hover crosshair readout. */
export function seriesChart(container: HTMLElement, points: SeriesPoint[], opts: ChartOpts = {}) {
  const height = opts.height ?? 220;
  const width = container.clientWidth || 640;
  const margin = { top: 12, right: 8, bottom: 26, left: 44 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const color = opts.color ?? C.blue;

  container.classList.add('op-chart');
  const svg = select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xs = scaleBand<number>()
    .domain(points.map((_, i) => i))
    .range([0, iw])
    .paddingInner(opts.kind === 'bars' ? 0.25 : 0);
  const ymax = Math.max(max(points, (p) => p.y) ?? 1, 1);
  const ys = scaleLinear().domain([0, ymax]).nice().range([ih, 0]);

  // horizontal gridlines + y labels
  for (const t of ys.ticks(4)) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', iw)
      .attr('y1', ys(t))
      .attr('y2', ys(t))
      .attr('stroke', C.grid)
      .attr('stroke-width', 1);
    g.append('text')
      .attr('x', -8)
      .attr('y', ys(t) + 4)
      .attr('text-anchor', 'end')
      .attr('font-family', FONT)
      .attr('font-size', 11)
      .attr('fill', C.textFaint)
      .text(t >= 10000 ? `${Math.round(t / 1000)}k` : String(t));
  }

  // x labels — first, last, and a few in between
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  points.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return;
    g.append('text')
      .attr('x', (xs(i) ?? 0) + xs.bandwidth() / 2)
      .attr('y', ih + 18)
      .attr('text-anchor', 'middle')
      .attr('font-family', FONT)
      .attr('font-size', 11)
      .attr('fill', C.textFaint)
      .text(p.x.length > 4 ? p.x.slice(0, 7) : p.x);
  });

  if (opts.kind === 'bars') {
    g.selectAll('rect.bar')
      .data(points)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => xs(i) ?? 0)
      .attr('width', xs.bandwidth())
      .attr('y', (p) => ys(p.y))
      .attr('height', (p) => ih - ys(p.y))
      .attr('fill', color)
      .attr('fill-opacity', 0.85);
  } else {
    const areaGen = d3area<SeriesPoint>()
      .x((_, i) => (xs(i) ?? 0) + xs.bandwidth() / 2)
      .y0(ih)
      .y1((p) => ys(p.y));
    const lineGen = d3line<SeriesPoint>()
      .x((_, i) => (xs(i) ?? 0) + xs.bandwidth() / 2)
      .y((p) => ys(p.y));
    g.append('path').datum(points).attr('d', areaGen).attr('fill', color).attr('fill-opacity', 0.25);
    g.append('path')
      .datum(points)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5);
  }

  // optional secondary line (own scale, e.g. cumulative counts)
  if (opts.line?.length) {
    const l2max = max(opts.line, (p) => p.y) ?? 1;
    const ys2 = scaleLinear().domain([0, l2max]).nice().range([ih, 0]);
    const byX = new Map(opts.line.map((p) => [p.x, p.y]));
    let last = 0;
    const filled = points.map((p) => ({ x: p.x, y: (last = byX.get(p.x) ?? last) }));
    const lineGen2 = d3line<SeriesPoint>()
      .x((_, i) => (xs(i) ?? 0) + xs.bandwidth() / 2)
      .y((p) => ys2(p.y));
    g.append('path')
      .datum(filled)
      .attr('d', lineGen2)
      .attr('fill', 'none')
      .attr('stroke', C.blueLight)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3');
  }

  // hover crosshair
  const cursor = g
    .append('line')
    .attr('y1', 0)
    .attr('y2', ih)
    .attr('stroke', C.blueLight)
    .attr('stroke-width', 1)
    .attr('opacity', 0);
  const readout = document.createElement('div');
  readout.className = 'op-tooltip';
  readout.style.display = 'none';
  document.body.appendChild(readout);

  svg
    .on('mousemove', (event: MouseEvent) => {
      const rect = (svg.node() as SVGSVGElement).getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * width - margin.left;
      const i = Math.min(
        points.length - 1,
        Math.max(0, Math.round(px / (iw / Math.max(points.length - 1, 1)))),
      );
      const p = points[i];
      if (!p) return;
      cursor.attr('opacity', 0.7).attr('x1', (xs(i) ?? 0) + xs.bandwidth() / 2).attr('x2', (xs(i) ?? 0) + xs.bandwidth() / 2);
      readout.style.display = 'block';
      readout.innerHTML = `<strong>${p.x}</strong><div class="muted">${p.y.toLocaleString('en')} ${opts.unit ?? ''}</div>`;
      readout.style.left = `${Math.min(event.clientX + 12, window.innerWidth - 220)}px`;
      readout.style.top = `${event.clientY + 12}px`;
    })
    .on('mouseleave', () => {
      cursor.attr('opacity', 0);
      readout.style.display = 'none';
    });

  return {
    destroy() {
      readout.remove();
      container.replaceChildren();
    },
  };
}

/** Horizontal labelled bar list (DOM, not SVG) — for categorical breakdowns. */
export function barList(
  container: HTMLElement,
  rows: { label: string; value: number; hint?: string }[],
  opts: { total?: number; maxRows?: number; unit?: string } = {},
) {
  const maxRows = opts.maxRows ?? 12;
  const shown = rows.slice(0, maxRows);
  const top = Math.max(...shown.map((r) => r.value), 1);
  const total = opts.total ?? rows.reduce((s, r) => s + r.value, 0);
  const list = document.createElement('div');
  list.className = 'op-barlist';
  for (const r of shown) {
    const pctText = total > 0 ? ` <em>${Math.round((100 * r.value) / total)}%</em>` : '';
    const row = document.createElement('div');
    row.className = 'op-barlist-row';
    row.innerHTML = `
      <span class="op-barlist-label" title="${r.label}">${r.label}</span>
      <span class="op-barlist-track"><i style="width:${Math.max(2, (100 * r.value) / top)}%"></i></span>
      <span class="op-barlist-value mono">${r.value.toLocaleString('en')}${opts.unit ?? ''}${pctText}</span>`;
    if (r.hint) row.title = r.hint;
    list.appendChild(row);
  }
  if (rows.length > maxRows) {
    const rest = document.createElement('p');
    rest.className = 'small faint';
    rest.textContent = `+ ${rows.length - maxRows} more`;
    list.appendChild(rest);
  }
  container.appendChild(list);
}
