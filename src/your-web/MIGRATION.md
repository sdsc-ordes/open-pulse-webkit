# Migration note — ENAC dashboard restructure

The flat ~9-section dashboard is replaced by a **landing page + 4 themes + a
data-quality panel**. Each theme is anchored to one question and one clear
provenance chain.

> **Caveat on the "old" names.** The nine section names below come from the
> restructuring brief. They could **not be verified** against any public
> sdsc-ordes repository, branch, git history, or deployed page (checked
> 2026-07-07: `open-pulse` incl. full history, `open-pulse-quickstart`,
> `EPFL_OS_Analysis`, live sites and the hub). If the old dashboard lives in a
> private repo or design doc, treat the left column as approximate.

## Old section → new home

| Old section | New home | Notes |
|---|---|---|
| Stats about the Repos | **Landscape** → inventory stats + breakdowns | Headline counts also on the landing page |
| Themes & Technology | **Landscape** → discipline + language breakdowns | Disciplines are EPFL-Graph categories (Wikidata-labelled) |
| Tools Catalogue | **Landscape** → catalogue | Now filterable by lab, type, license family, discipline, activity — not just name search |
| Repos | **Landscape** → catalogue + "Latest additions" feed | Merged with the catalogue; the feed shows newest discoveries |
| Collaboration Graph | **People & Community** → `pulse-graph` component | Rebuilt as a reusable PulseWebKit component (`src/components/pulse-graph.ts`); landing page shows a trimmed cut |
| People & Labs | **People & Community** | Adds lab↔lab bridges, cross-institution ties (ROR + ORCID), top committers |
| Growth & Milestones | **Health & Activity** → "Ecosystem growth" | Deliberately titled apart from "Per-repo growth" — different data cuts |
| Publications | **Research Impact** | Single theme; the software→papers→citations funnel |
| EPFL Infoscience | **Research Impact** (as *source*, not a section) | Infoscience feeds publication links via the metadata extractor; it is provenance, not an output |

New, without an old counterpart:

- **Landing page** (`index.html`) — 6 headline numbers + the signature graph;
  every element links into a theme.
- **"What's missing?"** (`coverage.html`) — gap lists (license, discipline,
  type, CITATION.cff, publication link, not-yet-extracted) as ENAC-IT4R
  to-dos, with a per-lab rollup.
- **"How is this computed?"** — one standardized disclosure component
  (`src/components/provenance.ts`, presets in `provenance-presets.ts`) on
  every data card: source / method / refresh cadence / caveats.

## Open decision (flagged, not decided)

Whether the Landscape should lead with **Software only** or also show
**Educational Resource / Data** repository types is a framing call for the
ENAC-IT4R team. The catalogue currently shows **all types by default**, with
the type filter one click away and a visible banner marking the decision as
open (`landscape.html`, "Open framing decision").

## Data notes

- Scope = the 12 ENAC lab GitHub orgs of the GrimoireLab `epfl-enac` project
  (EPFL-ENAC, vita-epfl, ibois-epfl, eesd-epfl, ENAC-CNPA, GeoEnergyLab-EPFL,
  RESSLab-Team, openpifpaf, ceat-epfl, cryos-epfl, LDM-EPFL,
  StructuralXplorationLab).
- 81 vendored forks (assimp, imgui, OpenSees, …) are excluded from ecosystem
  health series so upstream history doesn't masquerade as ENAC activity; they
  remain in the catalogue, marked.
- Snapshots are baked at build time by `scripts/fetch-data.mjs` (Neo4j +
  SPARQL + OpenSearch + CHAOSS API → `src/data/*.json`); the site is fully
  static and the browser never touches the stores.
