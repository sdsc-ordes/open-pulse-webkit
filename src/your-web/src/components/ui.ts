/* Tiny DOM helpers shared by all pages — SDSC kit markup (frontend-dev §5/§6). */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/** `〇 LABEL` + title + optional lead paragraph (frontend-dev §5). */
export function sectionHead(label: string, title: string, lead?: string): HTMLElement {
  const head = el('div', 'op-section-head');
  head.appendChild(el('p', 'op-label', label));
  head.appendChild(el('h2', undefined, title));
  if (lead) head.appendChild(el('p', 'op-lead', lead));
  return head;
}

export function section(label: string, title: string, lead?: string): HTMLElement {
  const s = el('section', 'op-section op-container');
  s.appendChild(sectionHead(label, title, lead));
  return s;
}

export function card(html?: string, cls = ''): HTMLElement {
  return el('div', `op-card ${cls}`.trim(), html);
}

/** Clickable stat tile for headline numbers. */
export function statTile(opts: {
  num: string;
  label: string;
  href?: string;
  go?: string;
  sub?: string;
}): HTMLElement {
  const tag = opts.href ? 'a' : 'div';
  const tile = el(tag as 'div', 'op-stat');
  if (opts.href) (tile as unknown as HTMLAnchorElement).href = opts.href;
  tile.innerHTML = `
    <div class="num">${opts.num}</div>
    <div class="lbl">${opts.label}</div>
    ${opts.sub ? `<div class="small muted" style="margin-top:6px">${opts.sub}</div>` : ''}
    ${opts.go ? `<div class="go">${opts.go} →</div>` : ''}`;
  return tile;
}

export function badge(text: string, kind: 'success' | 'running' | 'error' | 'pending' | 'warning' | 'blue'): string {
  return `<span class="op-badge op-badge--${kind}">${text}</span>`;
}

/** Relative "activity level" badge from a last-commit date. */
export function activityBadge(lastCommit: string | null, snapshotDate: string): string {
  if (!lastCommit) return badge('no commit data', 'pending');
  const last = new Date(lastCommit).getTime();
  const now = new Date(snapshotDate).getTime();
  const months = (now - last) / (1000 * 3600 * 24 * 30.4);
  if (months <= 3) return badge('active', 'success');
  if (months <= 12) return badge('quiet', 'warning');
  return badge('dormant', 'pending');
}

export function activityLevel(lastCommit: string | null, snapshotDate: string): 'active' | 'quiet' | 'dormant' | 'unknown' {
  if (!lastCommit) return 'unknown';
  const months =
    (new Date(snapshotDate).getTime() - new Date(lastCommit).getTime()) / (1000 * 3600 * 24 * 30.4);
  if (months <= 3) return 'active';
  if (months <= 12) return 'quiet';
  return 'dormant';
}

/** Group licenses into families for filtering ("license family" facet). */
export function licenseFamily(license: string | null): string {
  if (!license) return 'None declared';
  if (/^(GPL|AGPL|LGPL)/i.test(license)) return 'GPL family';
  if (/^MIT/i.test(license)) return 'MIT';
  if (/^Apache/i.test(license)) return 'Apache';
  if (/^BSD/i.test(license)) return 'BSD';
  if (/^CC/i.test(license)) return 'Creative Commons';
  return 'Other';
}

export function fmtInt(n: number): string {
  return n.toLocaleString('de-CH').replace(/’/g, ' ');
}

export function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((100 * part) / whole)}%` : '—';
}
