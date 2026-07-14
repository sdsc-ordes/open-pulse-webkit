/* __TITLE__ — list/detail archetype (frontend-dev §7.8/§7.9), scaffolded by
 * the pulseWebKit setup wizard.
 *
 * A selectable list (table with status badges) next to a detail panel.
 * Sample data lives in src/data/__SLUG__.json — replace it with a real
 * snapshot from your data-fetch step, adjust the interfaces, then delete
 * this note. */

import { renderShell } from '../shell';
import { el, section, card, badge } from '../components/ui';
import dataJson from '../data/__SLUG__.json';

type ItemStatus = 'success' | 'running' | 'error' | 'pending' | 'warning';

interface ListItem {
  id: string;
  name: string;
  status: ItemStatus;
  statusLabel: string;
  /** ISO 8601 — rendered as-is. */
  startedAt: string;
  duration: string;
  description: string;
  fields: { label: string; value: string }[];
}

interface ListFile {
  generatedAt: string;
  items: ListItem[];
}

const data = dataJson as unknown as ListFile;

renderShell('__SLUG__');
const main = el('main');
document.querySelector('footer')!.before(main);

main.appendChild(
  section(
    '__LABEL__',
    '__TITLE__',
    `List/detail archetype: pick a row on the left to inspect it on the
     right. The rows below are sample data from src/data/__SLUG__.json.`,
  ),
);

const wrap = el('div', 'op-container op-section');
const grid = el('div', 'op-grid op-grid--2');
const listWrap = el('div', 'op-table-wrap');
const detail = card('', 'op-card--sm');
grid.append(listWrap, detail);
wrap.appendChild(grid);
main.appendChild(wrap);

let selectedId = data.items[0]?.id ?? '';

function renderList(): void {
  listWrap.innerHTML = `<table class="op-table">
    <thead><tr><th>Item</th><th>Status</th><th>Started</th></tr></thead>
    <tbody>${data.items
      .map(
        (r) => `
      <tr data-id="${r.id}" style="cursor:pointer${r.id === selectedId ? ';background:var(--op-surface-active)' : ''}">
        <td>${r.name}</td>
        <td>${badge(r.statusLabel, r.status)}</td>
        <td class="mono">${r.startedAt}</td>
      </tr>`,
      )
      .join('')}</tbody></table>`;
  for (const tr of listWrap.querySelectorAll('tr[data-id]')) {
    tr.addEventListener('click', () => {
      selectedId = tr.getAttribute('data-id')!;
      renderList();
      renderDetail();
    });
  }
}

function renderDetail(): void {
  const r = data.items.find((i) => i.id === selectedId);
  if (!r) {
    detail.innerHTML = '<p class="small muted">Nothing selected.</p>';
    return;
  }
  detail.innerHTML = `
    <div class="op-gap-head"><h4>${r.name}</h4>${badge(r.statusLabel, r.status)}</div>
    <p class="small text-2" style="margin-top:8px">${r.description}</p>
    <div class="op-table-wrap" style="margin-top:16px"><table class="op-table"><tbody>
      <tr><td class="muted small">Started</td><td class="mono">${r.startedAt}</td></tr>
      <tr><td class="muted small">Duration</td><td class="mono">${r.duration}</td></tr>
      ${r.fields
        .map((f) => `<tr><td class="muted small">${f.label}</td><td>${f.value}</td></tr>`)
        .join('')}
    </tbody></table></div>`;
}

renderList();
renderDetail();
