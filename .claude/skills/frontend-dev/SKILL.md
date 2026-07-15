---
name: frontend-dev
description: Frontend engineering mechanics for the pulseWebKit web app — design-skill-agnostic. Defines the `--op-*` token contract the app consumes, how to install a design skill's tokens, font-loading mechanics, canvas/D3 constraints, build-time injection, the required shared components, and the Playwright UI-verification workflow. Contains NO design values (no hexes, sizes, or component looks) — those come from the ACTIVE design skill declared in CLAUDE.md (default: `openpulse-dark-theme`, over the `sdsc-ui-kit` brand). TRIGGER when editing anything under `src/your-web/`; scaffolding, wiring data or tokens, adding pages or components, reviewing UI PRs. For choosing visual values (colours, spacing, layouts, component looks), ALSO read the active design skill. SKIP for backend, devcontainer, Docker, CI, or shell-script work.
---

# Frontend dev — engineering mechanics (design-skill-agnostic)

> **This skill contains no design information.** Every visual value — colour, radius, type size, spacing, component look, layout — comes from the **active design skill**, declared in `CLAUDE.md` → *Design system* (default: `openpulse-dark-theme`, a theme over the `sdsc-ui-kit` brand). This file defines the *engineering contract* that makes design skills swappable: the app consumes a fixed set of token **names**; a design skill supplies the **values**. Swap the design skill and the app re-skins without touching app code.
>
> For any UI task: read this file for *how to build it*, and the active design skill for *what it looks like*.

---

## 1. The design-skill system

- A design system is delivered as a skill directory (`.claude/skills/<name>/`) containing at minimum a `SKILL.md` (the design language) and an `assets/tokens.css` (the token values). See `.claude/SKILLS.md` §11 for authoring one.
- `CLAUDE.md` → *Design system* names the **active design skill**. Everything visual defers to it; never hardcode a look that belongs there.
- Design skills may layer: a *theme* skill (e.g. `openpulse-dark-theme`) can declare a *base* brand skill (e.g. `sdsc-ui-kit`) that owns component anatomy and brand ground truth. Read base first, theme second; the theme states its own precedence rules.
- **Swapping**: install the new skill directory, replace the app's `:root` token block with the new `assets/tokens.css`, update the active-skill line in `CLAUDE.md`, run `node tools/sync-agents.mjs`. App code does not change — that is the point of the contract below.

## 2. The `--op-*` token contract

The app references **only these token names**; the active design skill's `assets/tokens.css` supplies the values. A design skill must define all of them (aliasing is fine, e.g. `--op-info: var(--op-blue)`).

| Group | Tokens |
|---|---|
| Fonts | `--op-font-heading`, `--op-font-body`, `--op-font-mono` |
| Surfaces | `--op-bg`, `--op-surface`, `--op-surface-2`, `--op-surface-active`, `--op-border`, `--op-border-subtle` |
| Brand accents | `--op-blue-darker`, `--op-blue-dark`, `--op-blue-mid`, `--op-blue`, `--op-blue-light`, `--op-blue-pale` |
| Text | `--op-text`, `--op-text-2`, `--op-text-muted`, `--op-text-faint`, `--op-text-on-blue` |
| Status | `--op-success`, `--op-error`, `--op-warning`, `--op-info` |
| Footer | `--op-footer-bg`, `--op-footer-border` |

(The `--op-blue-*` names are historical — a non-blue brand still uses them as its accent slots rather than renaming, so app code stays stable.)

Wiring rules:

1. **One `:root` block** in the app's global stylesheet holds the values, copied from the active design skill's `assets/tokens.css`.
2. **Utility-framework mirror**: if you use one (e.g. Tailwind v4 `@theme`), expose the same values there so `bg-op-*` / `text-op-*` utilities generate. Keep the two definitions in sync — they are the only two places values may appear.
3. **No raw hex in template markup, ever.** Reference `var(--op-*)` or the mirrored utilities. Canvas/SVG/D3 drawing code is the only exception (§5).
4. **Adding a token**: only when the active design skill defines it first (its §2 / tokens.css). Then add it to the `:root` block, the utility mirror, and — if it's a new *contract* name every design skill must now supply — the table above.

## 3. Font loading

Which families and weights: the active design skill. How to load them:

- Install the font **npm packages** the design skill names and import them as **JS imports once at the app entry point** (the module your bundler runs first). Bundlers resolve npm font packages from JS context; bare npm specifiers in CSS often fail. No CDN fonts — the static build must be self-contained.
- The global stylesheet contains **no** font `@import` statements — only the utility-framework import (if any) and the `:root` token block.
- Apply families via the contract tokens: `--op-font-body` on `body`, `--op-font-heading` on `h1`–`h6`, `--op-font-mono` via a `.mono` utility class.
- Canvas/SVG `<text>` elements need an explicit `font-family` attribute — they don't inherit from CSS.

## 4. UI verification (required)

Any change that touches UI, routes, CSS tokens, or visual behaviour must be verified in the browser via the **Playwright MCP** server (see `CLAUDE.md` for setup):

1. Start the dev server from `src/your-web/`.
2. Drive the affected page — navigate, click, fill, snapshot.
3. Screenshot and visually confirm against the active design skill's spec.
4. Watch the console for runtime errors and network failures.

A passing type-check/build is a correctness gate, **not** a feature-correctness gate — never claim UI work done from a build alone.

## 5. Canvas / D3 rules

- Canvas and D3 drawing code **cannot read CSS custom properties** — hex literals are allowed there, and only there.
- Keep all visualization colours in **one module** (a `NODE_COLORS` map plus link/ring constants), with values taken from the active design skill's data-viz palette. No second hex table anywhere.
- Re-run the force simulation whenever `nodes`/`edges` inputs change; build the graph inside `requestAnimationFrame` (nodes spawning at (0,0) means the simulation wasn't warmed up).
- Time-based visibility filtering (e.g. a `currentDate` scrubber) happens **before** data is passed to the graph component, not inside it.

## 6. Build-time injection

- **Build timestamp**: the required attribution bar (§7) shows the build time in ISO 8601 UTC. Inject it via the bundler's define/env mechanism (e.g. a `__BUILD_TIMESTAMP__` define) or generate it into the HTML at build — **never compute it in the browser**.
- **Data snapshots**: the static-first data path bakes typed JSON at build time (`scripts/fetch-data.mjs` querying the stores with the `query-*` skill transports) — recipe in `.claude/SKILLS.md` §10. Credentials stay at build time; the browser never talks to the stores.
- **Image snapshots**: every image the app renders is baked at build time too — a `scripts/fetch-images.mjs` (run after `fetch-data`) fetches org avatars (`https://github.com/<org>.png?size=128`), repo social-preview thumbnails (`https://opengraph.githubassets.com/1/<owner>/<repo>`), and any partner logos; resizes and converts them to WebP (`sharp`); and inlines them as base64 data URIs in a JSON module pages import. The browser never fetches an image from a third party — no hotlinking, no tracking, nothing breaks offline. Keep the payload bounded: snapshot only images that actually render (e.g. the 8 cards of a "latest additions" feed, not the whole catalogue), and retry-then-skip on fetch failure so markup falls back to its no-image variant. Reference script: [`examples/fetch-images.mjs`](examples/fetch-images.mjs); the media slots' visual spec is the active design skill's (in `openpulse-dark-theme`: §6.7).

## 7. Required shared components

Two components are product requirements on every dashboard, independent of design skill. Build each **once** as a shared component; the active design skill specs the visuals.

- **Attribution bar** — at the very top of every route: `Built using openpulse.science at <build timestamp>` with `openpulse.science` linked and the timestamp from §6. Requirement: `CLAUDE.md`; visual spec: active design skill (in `openpulse-dark-theme`: §7.4).
- **Provenance disclosure** ("How is this computed?") — the same compact `<details>` on every data card, with four fixed fields: *Source*, *Method*, *Refresh*, *Caveats*. Never bespoke per-section explanations. Field semantics: `.claude/SKILLS.md` §9; visual spec: active design skill (in `openpulse-dark-theme`: §7.5).

## 8. Scaffolding / restyling checklist

When you scaffold `src/your-web/` or apply a (new) design skill, work in this order — each step verifiable with a Playwright screenshot (§4):

1. **Tokens** — copy the active design skill's `assets/tokens.css` into the global stylesheet `:root`; mirror into the utility-framework theme if used (§2).
2. **Fonts** — install and import the packages the design skill names (§3).
3. **Shell** — attribution bar + header + footer on every route, per the design skill's layout specs; list/detail views use its content+sidebar archetype.
4. **Surfaces** — build pages from the design skill's component/layout patterns, referencing only contract tokens and mirrored utilities.
5. **Data cards** — attach the shared provenance component (§7) to every card showing Open Pulse-derived numbers.
6. **Canvas views** — apply §5; take viz colours from the design skill's palette.
7. **Verify** — walk every affected route through Playwright (§4).

## 9. Type/lint hygiene

- Keep all API response shapes in one shared types module — source of truth for client and server/build script.
- Regenerate framework-generated types after adding routes; declare build-time env vars in the build config with an inline fallback.
- Give explicit generic types to reactive/state primitives whose initial value is `null`.
- Run the stack's type-check/lint from `src/your-web/` before every commit — CI runs the same.
