/* "How is this computed?" — the one standardized provenance disclosure used
 * by every data card on the dashboard (cross-cutting requirement #1).
 * Four fixed fields: source, method, refresh cadence, caveats. No bespoke
 * per-section explanation components — always use this. */

export type ProvenanceSource =
  | 'Neo4j'
  | 'GraphDB (SPARQL)'
  | 'GrimoireLab'
  | 'GitHub API'
  | 'Infoscience'
  | 'OpenAlex';

export type ProvenanceMethod =
  | 'Graph crawler'
  | 'git-metadata-extractor (LLM)'
  | 'Classifier'
  | 'CHAOSS metrics API'
  | 'Direct query';

export interface Provenance {
  /** Which of the three engines (or upstream API) the numbers come from. */
  source: ProvenanceSource | ProvenanceSource[];
  /** Which pipeline step produced/filled the fields. */
  method: ProvenanceMethod | ProvenanceMethod[];
  /** How often the underlying snapshot refreshes. */
  cadence: string;
  /** Honest limitations, e.g. "discipline inferred by classifier, may be wrong". */
  caveats: string;
}

const asList = (v: string | string[]) => (Array.isArray(v) ? v.join(' + ') : v);

/** Render the standard compact disclosure. Append it inside any data card. */
export function provenanceBox(p: Provenance): HTMLElement {
  const details = document.createElement('details');
  details.className = 'op-provenance';
  details.innerHTML = `
    <summary><span aria-hidden="true">ⓘ</span> How is this computed?</summary>
    <dl>
      <div><dt>Source</dt><dd class="mono">${asList(p.source)}</dd></div>
      <div><dt>Method</dt><dd class="mono">${asList(p.method)}</dd></div>
      <div><dt>Refresh</dt><dd>${p.cadence}</dd></div>
      <div><dt>Caveats</dt><dd>${p.caveats}</dd></div>
    </dl>`;
  return details;
}

/** Convenience: attach the box to a card element (keeps call sites terse). */
export function withProvenance(card: HTMLElement, p: Provenance): HTMLElement {
  card.appendChild(provenanceBox(p));
  return card;
}
