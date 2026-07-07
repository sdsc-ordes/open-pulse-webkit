/* App shell shared by every page: attribution bar (frontend-dev §7.11),
 * sticky header (§7.1), black footer (§7.2). Text wordmarks stand in for
 * image logos — the repo ships no binary assets. */

import '@fontsource-variable/space-grotesk';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@carrot-kpi/switzer-font/400.css';
import '@carrot-kpi/switzer-font/500.css';
import '@carrot-kpi/switzer-font/600.css';
import '@carrot-kpi/switzer-font/700.css';
import './styles/global.css';

declare const __BUILD_TIMESTAMP__: string;

export type PageId =
  | 'home'
  | 'landscape'
  | 'people'
  | 'health'
  | 'impact'
  | 'coverage';

const NAV: { id: PageId; href: string; label: string }[] = [
  { id: 'home', href: 'index.html', label: 'At a glance' },
  { id: 'landscape', href: 'landscape.html', label: 'Landscape' },
  { id: 'people', href: 'people.html', label: 'People & Community' },
  { id: 'health', href: 'health.html', label: 'Health & Activity' },
  { id: 'impact', href: 'impact.html', label: 'Research Impact' },
  { id: 'coverage', href: 'coverage.html', label: "What's missing?" },
];

export function renderShell(active: PageId): void {
  const body = document.body;

  const top = document.createElement('div');
  top.innerHTML = `
    <div class="op-attribution">
      <div class="op-container">
        Built using <a href="https://openpulse.science">openpulse.science</a>
        at <span class="mono">${__BUILD_TIMESTAMP__}</span>
      </div>
    </div>
    <header class="op-header">
      <div class="op-container op-header-row">
        <a class="op-wordmark" href="index.html">
          <span class="op-wordmark-pulse">OPEN PULSE</span>
          <span class="op-wordmark-sep" aria-hidden="true"></span>
          <span class="op-wordmark-org">ENAC</span>
        </a>
        <nav class="op-nav" aria-label="Themes">
          ${NAV.map(
            (n) => `
            <a href="${n.href}" ${n.id === active ? 'aria-current="page"' : ''}>${n.label}</a>`,
          ).join('')}
        </nav>
      </div>
    </header>`;
  while (top.firstChild) body.insertBefore(top.firstChild, body.firstChild);

  const footer = document.createElement('footer');
  footer.className = 'op-footer';
  footer.innerHTML = `
    <div class="op-container">
      <div class="op-footer-cols">
        <div>
          <p class="op-footer-title">ENAC Open Source — powered by Open Pulse</p>
          <p class="op-footer-body">
            Open Pulse automatically discovers and monitors open-source software
            produced at EPFL, so those contributions become visible, measurable,
            and valued. This dashboard is the ENAC (Architecture, Civil and
            Environmental Engineering) view.
          </p>
        </div>
        <div>
          <p class="op-footer-title">Resources</p>
          <ul class="op-footer-list">
            <li><a href="https://openpulse.science">openpulse.science</a></li>
            <li><a href="https://github.com/sdsc-ordes/open-pulse">Open Pulse on GitHub</a></li>
            <li><a href="https://sdsc-ordes.github.io/open-pulse-ontology/">Open Pulse ontology</a></li>
            <li><a href="https://chaoss.community">CHAOSS metrics</a></li>
          </ul>
        </div>
        <div>
          <p class="op-footer-title">Built by</p>
          <ul class="op-footer-list">
            <li><a href="https://datascience.ch">Swiss Data Science Center</a></li>
            <li><a href="https://www.epfl.ch/schools/enac/">EPFL ENAC</a></li>
            <li><a href="https://www.epfl.ch/research/open-science/">EPFL Open Science</a></li>
          </ul>
        </div>
      </div>
      <div class="op-footer-partners" aria-label="Partner institutions">
        <span>ETH Zürich</span><span>EPFL</span><span>PSI</span><span>Biopôle</span>
      </div>
      <div class="op-footer-copy">© ${__BUILD_TIMESTAMP__.slice(0, 4)} Swiss Data Science Center · EPFL Open Science</div>
    </div>`;
  body.appendChild(footer);
}

/** Format an integer with a thin-space thousands separator (Swiss convention). */
export function fmtInt(n: number): string {
  return n.toLocaleString('de-CH').replace(/’/g, ' ');
}
