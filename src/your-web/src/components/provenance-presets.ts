/* Shared provenance descriptions so every card states source/method/cadence
 * with the same wording. The component itself is provenance.ts — these are
 * just the standard field values per data source. */

import type { Provenance } from './provenance';

const CADENCE =
  'Upstream stores refresh with the monthly pipeline snapshot; this page is baked at site build time (timestamp in the top bar).';

export const PROV = {
  neo4jGraph: (caveats: string): Provenance => ({
    source: 'Neo4j',
    method: 'Graph crawler',
    cadence: CADENCE,
    caveats,
  }),
  sparqlMeta: (caveats: string): Provenance => ({
    source: 'GraphDB (SPARQL)',
    method: 'git-metadata-extractor (LLM)',
    cadence: CADENCE,
    caveats,
  }),
  grimoire: (caveats: string): Provenance => ({
    source: 'GrimoireLab',
    method: 'Direct query',
    cadence: CADENCE,
    caveats,
  }),
  chaoss: (caveats: string): Provenance => ({
    source: 'GrimoireLab',
    method: 'CHAOSS metrics API',
    cadence: CADENCE,
    caveats,
  }),
  mixed: (
    source: Provenance['source'],
    method: Provenance['method'],
    caveats: string,
  ): Provenance => ({ source, method, cadence: CADENCE, caveats }),
};

export const CLASSIFIER_CAVEAT =
  'Repository type and discipline are inferred by the pipeline classifier / LLM extractor and may be wrong for individual repos.';
