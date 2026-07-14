/* __TITLE__ — graph-explorer archetype (frontend-dev §8), scaffolded by the
 * pulseWebKit setup wizard.
 *
 * A force-directed network on the dark dot-grid canvas, with a detail panel
 * fed by node clicks. Sample data lives in src/data/__SLUG__.json — replace
 * it with a real snapshot from your data-fetch step (nodes need a `type`
 * from the NodeType union), then delete this note. */

import { renderShell } from '../shell';
import { el, section, card, badge } from '../components/ui';
import { createPulseGraph } from '../components/pulse-graph';
import type { NodeType, PulseGraphEdge, PulseGraphNode } from '../components/pulse-graph';
import dataJson from '../data/__SLUG__.json';

interface GraphFile {
  generatedAt: string;
  nodes: { id: string; type: string; name: string; weight?: number; meta?: string[] }[];
  edges: { source: string; target: string; type?: string }[];
}

const data = dataJson as unknown as GraphFile;

renderShell('__SLUG__');
const main = el('main');
document.querySelector('footer')!.before(main);

main.appendChild(
  section(
    '__LABEL__',
    '__TITLE__',
    `Graph-explorer archetype: drag to pan the simulation, click a node to
     inspect it. The network below is sample data from
     src/data/__SLUG__.json.`,
  ),
);

const wrap = el('div', 'op-container op-section');
const canvasCard = card('', 'op-card--sm');
const canvas = el('div');
canvasCard.appendChild(canvas);
wrap.appendChild(canvasCard);

const EMPTY_DETAIL = '<p class="small muted">Click a node to see its details.</p>';
const detail = card(EMPTY_DETAIL, 'op-card--sm');
detail.style.marginTop = '16px';
wrap.appendChild(detail);
main.appendChild(wrap);

const nodes: PulseGraphNode[] = data.nodes.map((n) => ({ ...n, type: n.type as NodeType }));
const edges: PulseGraphEdge[] = data.edges;

// The canvas measures its container width, so give layout one frame first.
requestAnimationFrame(() => {
  createPulseGraph(canvas, {
    nodes,
    edges,
    height: 520,
    onSelect: (n) => {
      detail.innerHTML = n
        ? `<div class="op-gap-head"><h4>${n.name}</h4>${badge(n.type, 'blue')}</div>
           ${(n.meta ?? [])
             .map((m) => `<p class="small text-2" style="margin-top:6px">${m}</p>`)
             .join('')}`
        : EMPTY_DETAIL;
    },
  });
});
