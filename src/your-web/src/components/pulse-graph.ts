/* pulse-graph — the reusable PulseWebKit force-directed collaboration graph
 * (Open Pulse's signature visual). SVG + d3-force, restyled for readability:
 *   - degree-scaled node radii, labels only where they stay legible
 *     (organisations + high-degree nodes; everything else labels on hover)
 *   - hover focuses the node's neighbourhood and fades the rest
 *   - zoom/pan, drag, click-to-pin, built-in legend + tooltip
 * Colours live in the single NODE_COLORS map (frontend-dev §2.6) — hex
 * literals are allowed here because SVG/D3 drawing can't read CSS vars. */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select,
  zoom,
  zoomIdentity,
  drag,
  type Simulation,
  type D3ZoomEvent,
  type D3DragEvent,
} from 'd3';

export type NodeType =
  | 'Person'
  | 'Repository'
  | 'Commit'
  | 'Organisation'
  | 'Institution'
  | 'PullRequest';

/** Single source of truth for node colours (frontend-dev §2.6).
 * `Institution` (ROR-identified research org) reuses the amber slot — no
 * Commit nodes ever appear in this dashboard's graphs. */
export const NODE_COLORS: Record<NodeType, string> = {
  Person: '#4ade80',
  Repository: '#60a5fa',
  Commit: '#fbbf24',
  Organisation: '#a78bfa',
  Institution: '#fbbf24',
  PullRequest: '#f472b6',
};

const LINK_COLOR = '#5461a6'; // --op-blue
const RING_COLOR = '#8a94c9'; // --op-blue-light
const LABEL_COLOR = '#c0c0dc'; // --op-text-2
const FONT = "'Switzer', system-ui, sans-serif";

export interface PulseGraphNode {
  id: string;
  type: NodeType;
  name: string;
  /** Optional weight (e.g. contribution count) — scales the radius. */
  weight?: number;
  /** Extra lines for the tooltip. */
  meta?: string[];
}

export interface PulseGraphEdge {
  source: string;
  target: string;
  type?: string;
}

export interface PulseGraphOptions {
  nodes: PulseGraphNode[];
  edges: PulseGraphEdge[];
  height?: number;
  /** Called with the node on click (e.g. to fill a detail panel). */
  onSelect?: (node: PulseGraphNode | null) => void;
  /** Show the type legend overlay (default true). */
  legend?: boolean;
}

interface SimNode extends PulseGraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  degree: number;
  r: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  type?: string;
}

export interface PulseGraph {
  destroy: () => void;
}

export function createPulseGraph(
  container: HTMLElement,
  opts: PulseGraphOptions,
): PulseGraph {
  const height = opts.height ?? 560;
  container.classList.add('dot-grid', 'op-graph');
  container.style.position = 'relative';
  container.style.height = `${height}px`;

  const width = container.clientWidth || 960;

  const degree = new Map<string, number>();
  for (const e of opts.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const maxWeight = Math.max(1, ...opts.nodes.map((n) => n.weight ?? 0));
  const nodes: SimNode[] = opts.nodes.map((n) => {
    const d = degree.get(n.id) ?? 0;
    const w = (n.weight ?? 0) / maxWeight;
    return {
      ...n,
      degree: d,
      r:
        n.type === 'Organisation'
          ? 14 + Math.min(8, d * 0.4)
          : 5 + Math.min(9, Math.sqrt(d) * 1.6 + w * 4),
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: SimEdge[] = opts.edges
    .filter((e) => byId.has(e.source) && byId.has(e.target))
    .map((e) => ({
      source: byId.get(e.source)!,
      target: byId.get(e.target)!,
      type: e.type,
    }));

  const adjacency = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adjacency.has(e.source.id)) adjacency.set(e.source.id, new Set());
    if (!adjacency.has(e.target.id)) adjacency.set(e.target.id, new Set());
    adjacency.get(e.source.id)!.add(e.target.id);
    adjacency.get(e.target.id)!.add(e.source.id);
  }

  // Labels stay on for organisations and the most-connected nodes only.
  const labelBudget = new Set(
    nodes
      .filter((n) => n.type === 'Organisation')
      .concat(
        nodes
          .filter((n) => n.type !== 'Organisation')
          .sort((a, b) => b.degree - a.degree)
          .slice(0, 12),
      )
      .map((n) => n.id),
  );

  const svg = select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Collaboration graph');

  const root = svg.append('g');

  const linkSel = root
    .append('g')
    .selectAll('line')
    .data(edges)
    .join('line')
    .attr('stroke', LINK_COLOR)
    .attr('stroke-opacity', 0.35)
    .attr('stroke-width', 1);

  const nodeSel = root
    .append('g')
    .selectAll<SVGCircleElement, SimNode>('circle')
    .data(nodes)
    .join('circle')
    .attr('r', (d) => d.r)
    .attr('fill', (d) => NODE_COLORS[d.type])
    .attr('fill-opacity', 0.9)
    .attr('stroke', '#0c0c12')
    .attr('stroke-width', 1.25)
    .style('cursor', 'pointer');

  const labelSel = root
    .append('g')
    .selectAll('text')
    .data(nodes.filter((n) => labelBudget.has(n.id)))
    .join('text')
    .text((d) => d.name)
    .attr('font-family', FONT)
    .attr('font-size', (d) => (d.type === 'Organisation' ? 13 : 11))
    .attr('font-weight', (d) => (d.type === 'Organisation' ? 600 : 400))
    .attr('fill', LABEL_COLOR)
    .attr('paint-order', 'stroke')
    .attr('stroke', '#0c0c12')
    .attr('stroke-width', 3)
    .attr('pointer-events', 'none');

  const tooltip = document.createElement('div');
  tooltip.className = 'op-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  let selected: SimNode | null = null;

  function applyFocus(focus: SimNode | null): void {
    if (!focus) {
      nodeSel.attr('fill-opacity', 0.9).attr('stroke', '#0c0c12');
      linkSel.attr('stroke-opacity', 0.35).attr('stroke-width', 1);
      labelSel.attr('opacity', 1);
      return;
    }
    const near = adjacency.get(focus.id) ?? new Set<string>();
    nodeSel
      .attr('fill-opacity', (d) =>
        d.id === focus.id || near.has(d.id) ? 1 : 0.15,
      )
      .attr('stroke', (d) => (d.id === focus.id ? RING_COLOR : '#0c0c12'));
    linkSel
      .attr('stroke-opacity', (e) =>
        e.source.id === focus.id || e.target.id === focus.id ? 0.85 : 0.08,
      )
      .attr('stroke-width', (e) =>
        e.source.id === focus.id || e.target.id === focus.id ? 1.6 : 1,
      );
    labelSel.attr('opacity', (d) =>
      d.id === focus.id || near.has(d.id) ? 1 : 0.2,
    );
  }

  nodeSel
    .on('mouseenter', (event: MouseEvent, d) => {
      applyFocus(d);
      tooltip.style.display = 'block';
      tooltip.innerHTML =
        `<strong>${d.name}</strong>` +
        `<div class="muted">${d.type} · ${d.degree} connection${d.degree === 1 ? '' : 's'}</div>` +
        (d.meta ?? []).map((m) => `<div class="muted">${m}</div>`).join('');
      positionTooltip(event);
    })
    .on('mousemove', (event: MouseEvent) => positionTooltip(event))
    .on('mouseleave', () => {
      tooltip.style.display = 'none';
      applyFocus(selected);
    })
    .on('click', (_event: MouseEvent, d) => {
      selected = selected?.id === d.id ? null : d;
      applyFocus(selected);
      opts.onSelect?.(selected);
    });

  function positionTooltip(event: MouseEvent): void {
    tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 340)}px`;
    tooltip.style.top = `${event.clientY + 14}px`;
  }

  const sim: Simulation<SimNode, SimEdge> = forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimEdge>(edges)
        .id((d) => d.id)
        .distance((e) =>
          e.source.type === 'Organisation' || e.target.type === 'Organisation'
            ? 90
            : 46,
        )
        .strength(0.4),
    )
    .force('charge', forceManyBody().strength(-120))
    .force('center', forceCenter(width / 2, height / 2))
    .force('x', forceX(width / 2).strength(0.05))
    .force('y', forceY(height / 2).strength(0.07))
    .force(
      'collide',
      forceCollide<SimNode>().radius((d) => d.r + 2),
    )
    .on('tick', () => {
      linkSel
        .attr('x1', (e) => e.source.x!)
        .attr('y1', (e) => e.source.y!)
        .attr('x2', (e) => e.target.x!)
        .attr('y2', (e) => e.target.y!);
      nodeSel.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
      labelSel
        .attr('x', (d) => d.x! + d.r + 4)
        .attr('y', (d) => d.y! + 4);
    });

  nodeSel.call(
    drag<SVGCircleElement, SimNode>()
      .on('start', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        if (!event.active) sim.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }),
  );

  const zoomBehaviour = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 5])
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      root.attr('transform', event.transform.toString());
    });
  svg.call(zoomBehaviour).call(zoomBehaviour.transform, zoomIdentity);
  svg.on('dblclick.zoom', null);

  if (opts.legend !== false) {
    const present = [...new Set(nodes.map((n) => n.type))];
    const legend = document.createElement('div');
    legend.className = 'op-canvas-overlay op-graph-legend';
    legend.innerHTML = present
      .map(
        (t) =>
          `<span><i style="background:${NODE_COLORS[t]}"></i>${t}</span>`,
      )
      .join('');
    container.appendChild(legend);
  }

  const hint = document.createElement('div');
  hint.className = 'op-canvas-overlay op-graph-hint';
  hint.textContent = 'Scroll to zoom · drag nodes · click to pin a neighbourhood';
  container.appendChild(hint);

  return {
    destroy() {
      sim.stop();
      tooltip.remove();
      container.replaceChildren();
    },
  };
}
