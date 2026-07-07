---
name: frontend-dev
description: Frontend / UI work on the pulseWebKit web app. The permanent-dark Open Pulse dashboard theme — a delta on top of the `sdsc-ui-kit` design system. Defines the dark `--op-*` token set, the light→dark translation of the SDSC brand, dashboard-only components (attribution bar, provenance disclosure, graph explorer), and the deliberate deviations from the base kit. Framework-agnostic. TRIGGER when editing anything under `src/your-web/`; adding or restyling a page, component, or design token; rewriting layouts; changing colors, fonts, radius, or spacing; reviewing UI PRs; or when the user says "design", "restyle", "rebrand", "dark mode", "make it pretty". Read `sdsc-ui-kit` first — it owns the brand; this skill owns the dark translation. SKIP for backend, devcontainer, Docker, CI, or shell-script work.
---

# Frontend dev — Open Pulse dashboard theme (dark delta over `sdsc-ui-kit`)

> **This skill is a theme delta, not a standalone design system.** The base system is the **`sdsc-ui-kit` skill** (SDSC brand, datascience.ch): it owns all **brand colour values**, typography anatomy, component anatomy (buttons, inputs, toggles, spinners, nav), the ten layout archetypes, icons (Lucide), logo rules, and accessibility. This file defines only:
>
> 1. the **permanent-dark translation** of that system (§1) and the `--op-*` tokens that implement it (§2),
> 2. **dashboard-only components** with no sdsc counterpart — attribution bar, provenance disclosure, graph explorer (§7.4, §7.5, §8),
> 3. the short list of **deliberate deviations** from the base kit (§1.2).
>
> **Precedence:** for any brand value (a hex, a scale step, component anatomy) `sdsc-ui-kit` wins; for dark-theme values and dashboard components this file wins. Anything not mentioned here follows the base kit unchanged.
>
> **Permanent dark.** There is **no light mode** — do not add one. Do **not** use sdsc-ui-kit's `.dark` block either: that is a neutral-grey dark for general SDSC sites; the dashboard uses the blue-tinted near-black palette in §2.
>
> **Framework-agnostic.** Tokens are CSS custom properties; examples use Tailwind-style utility classes plus `var(--op-*)` for clarity, but nothing depends on a specific framework — translate the markup to whatever `src/your-web/` is built with.

---

## 0. How to use this skill

1. **Read `sdsc-ui-kit/SKILL.md` first**, plus the reference that matches the task (`design-tokens.md` for colours/type, `components.md` for interactive elements, `layouts.md` for page composition). That is the anatomy.
2. Then read this file for the dark values, the dashboard components, and the deviations.
3. Cross-reference `CLAUDE.md` for the **UI verification rule** (every visible change must be exercised through the Playwright MCP browser against the running dev server).
4. When you need a colour, radius, or spacing value that exists in neither skill, **add it to §2 of this file first**, then use it in code. Never invent ad-hoc values inline.

---

## 1. Mission & posture

The UI is **dark, Swiss, sharp-edged**:

- **Swiss / academic** — minimal, structured, no glow chrome, no neon.
- **Ink-blue on near-black** — near-black surfaces (`#0c0c12` → `#1c1c2c`) with the SDSC brand blues (`#26235c`, `#5561a6`) as the only chrome accents. White text reads at high contrast on top.
- **Two blues are the only chrome colour** the UI projects. Status colours appear only on badges and toasts. The data-viz palette (§2.6) stays inside the graph canvas.
- Everything else — button shape, `〇 LABEL` pattern, spacing rhythm, uppercase button text — is the base kit unchanged.

### 1.1 Light → dark translation table

How the sdsc-ui-kit (light) values map onto this theme. Brand hexes are the sdsc-ui-kit ones (`SDSC_Design_System.pdf`, June 2026 — the ground truth).

| sdsc-ui-kit (light) | This UI (dark) |
|---|---|
| Page `--background-color-white` `#ffffff` | Page `--op-bg` `#0c0c12` |
| Card `--background-color-grey` `#f4f3f8` | Card `--op-surface` `#141420` |
| Border `--color-border-2` `#c9c9c9` | Border `--op-border` `#242438` |
| Body text `--text-color-black` `#000000` | Body text `--op-text` `#f4f4fc` |
| Secondary text / labels `--text-color-grey` `#848484` | `--op-text-2` `#c0c0dc` (body) / `--op-text-muted` `#9898b8` (labels) |
| Banner soft `--light-blue-bg` `#dddeec` | Banner soft `--op-blue-pale` `#1a1834` (deep blue, slightly elevated) |
| Banner loud `--secondary-color` `#26235c` | Unchanged (`--op-blue-dark`) |
| Footer black `#000000` | Unchanged |
| Primary blue `--primary-color` `#5561a6` | Unchanged (`--op-blue`) |
| Hover on primary `#26235c` | `--op-blue-mid` `#434e85` (Primary-scale *dark* step — going all the way to `#26235c` vanishes on dark) |
| Link `#5561a6` | Link `--op-blue-light` `#8a94c9` (Primary-scale *lighter* step, for legibility on dark) |
| Success `--success` `#10b981` | `--op-success` `#34d399` (Success-scale *light* step) |
| Warning `--warning` `#f59e0b` | `--op-warning` `#fbbf24` (Warning-scale *light* step) |
| Error `--error` `#ef4444` | `--op-error` `#f87171` (Error-scale *light* step) |
| Info `--info` `#3b82f6` | `--op-info` = `--op-blue` `#5561a6` (aliased to brand blue) |
| Green accent `--green` `#90ca42` | **Not used in chrome** (see §1.2) |

Translation rule for anything not in the table: semantic colours step **up one scale step** (base → light) so they read on near-black; brand blues keep their base values; every step must exist on an sdsc-ui-kit scale (`references/design-tokens.md`) — never invent intermediate hexes.

### 1.2 Deliberate deviations from sdsc-ui-kit

Everything the dashboard intentionally does differently from the base kit. If a difference isn't in this table, it's drift — fix it toward sdsc-ui-kit.

| # | Deviation | Base kit says | This theme does | Why |
|---|---|---|---|---|
| 1 | **Permanent dark, own palette** | Light default + `.dark` toggle (`#1a1a1a`/`#2d2d2d` neutral) | Always dark, blue-tinted near-black (§2.1), no toggle | Data-dashboard identity; the graph canvas needs the dark ground |
| 2 | **Bordered cards** | Cards are borderless — fill contrast + shadow on hover | Cards carry `1px solid var(--op-border)` | On near-black the fill contrast between `#0c0c12` and `#141420` is too subtle for dense data panels; hairline borders keep boundaries legible |
| 3 | **Sharp badges** | Tags/badges are `2rem` pills | Badges use `rounded` (4px) like buttons | Denser, data-table-friendly; matches `CLAUDE.md` ("buttons and badges use rounded (4px) only") |
| 4 | **Compressed type scale** | H1 64px … H6 16px (marketing scale) | H1 48px … micro 11px (§3.2) | Dashboards are information-dense; 64px display headings waste canvas |
| 5 | **JetBrains Mono added** | Two fonts (Space Grotesk + Switzer) | Third family for code, IDs, SHAs, queries (`.mono`) | Dashboards render identifiers constantly |
| 6 | **Fonts from npm, not CDN** | Google Fonts / Fontshare links | `@fontsource-*` + `@carrot-kpi/switzer-font` npm packages (§3.1) | Static GitHub-Pages build must be self-contained; no runtime CDN dependency |
| 7 | **Disabled buttons via tokens, not opacity** | 50% opacity + `cursor: not-allowed` | `bg-op-surface-2 text-op-text-faint cursor-not-allowed` | `opacity-50` smudges on dark surfaces |
| 8 | **No green accent in chrome** | Green `#90ca42` as accent / CTA highlight | Chrome is strictly the two blues; greens appear only as `--op-success` on badges | "Two blues only" keeps status colour unambiguous on a data UI |

---

## 2. Color tokens

Define all tokens as **CSS custom properties** in your app's global stylesheet `:root`. If you use a utility framework (e.g. Tailwind v4 `@theme`), mirror the same values there so `bg-op-*` / `text-op-*` utilities generate — **keep the two definitions in sync**. Code that can't use utilities (inline styles, canvas/D3) reads `var(--op-*)`.

### 2.1 Surfaces (dark-theme values — no sdsc counterpart)

| Token | Hex | Role |
|---|---|---|
| `--op-bg` | `#0c0c12` | Page background. The base of every page. |
| `--op-surface` | `#141420` | Default card / panel. |
| `--op-surface-2` | `#1c1c2c` | Elevated surface — table heads, second-level cards, hover targets. |
| `--op-surface-active` | `#1a1834` | Selected / active row, current sidebar item background. |
| `--op-border` | `#242438` | Default border for cards, dividers, table cells. |
| `--op-border-subtle` | `#1a1a28` | Dim/inset border — under headings, badge outlines. |

### 2.2 Brand ink-blues

Base values are the sdsc-ui-kit brand tokens; light/dark steps come from its Primary/Secondary scales (`references/design-tokens.md`). Do not invent intermediate steps.

| Token | Hex | sdsc-ui-kit source | Role |
|---|---|---|---|
| `--op-blue-darker` | `#161438` | Secondary scale → darker | Pressed state for dark-blue banners, footer accents. |
| `--op-blue-dark` | `#26235c` | `--secondary-color` (base) | **SDSC secondary.** Loud banners, key-numbers band, dark hero overlay. |
| `--op-blue-mid` | `#434e85` | Primary scale → dark | Hover/pressed step on primary-blue surfaces. |
| `--op-blue` | `#5561a6` | `--primary-color` (base) | **SDSC interactive blue.** Primary button, icon fill, focus ring, D3 link colour. |
| `--op-blue-light` | `#8a94c9` | Primary scale → lighter | Hyperlinks, lighter accents, hover text colour on dark. |
| `--op-blue-pale` | `#1a1834` | *(dark-adaptation only)* | "Soft banner" replacement for the kit's `#dddeec`. Deep blue elevated band. |

### 2.3 Text (dark-theme values)

| Token | Hex | Role |
|---|---|---|
| `--op-text` | `#f4f4fc` | Primary text. Headings, body. |
| `--op-text-2` | `#c0c0dc` | Secondary text. Long-form body, table cells. |
| `--op-text-muted` | `#9898b8` | Captions, labels, `〇 LABEL` text, table heads. |
| `--op-text-faint` | `#6a6a88` | Fine print, timestamps, disabled labels. |
| `--op-text-on-blue` | `#ffffff` | Text on `--op-blue` or `--op-blue-dark` surfaces. |

### 2.4 Status / feedback (UI chrome only)

Each is the **light step** of the matching sdsc-ui-kit semantic scale (base values read too dark on near-black); info is aliased to brand blue.

| Token | Dark hex | sdsc-ui-kit source | Role |
|---|---|---|---|
| `--op-success` | `#34d399` | Success scale → light | succeeded badges, ✓ confirmations. |
| `--op-error`   | `#f87171` | Error scale → light | failed badges, error toasts, destructive actions. |
| `--op-warning` | `#fbbf24` | Warning scale → light | restarting / degraded states. |
| `--op-info`    | `#5561a6` | = `--op-blue` | Aliased to brand blue (info-blue clashes with the two-blue chrome rule). |

Badge fill convention: `color: var(--op-<state>); background: <state> at 12% alpha` (§6.3).

### 2.5 Neutral surface mapping (reference)

sdsc-ui-kit's `--surface-50…900` grayscale (see its `design-tokens.md`) is **not** exposed as `--op-*` tokens — the §2.1 surfaces cover it. When you need to translate a light-mode surface choice, map by role, not by lightness: page → `--op-bg`, subtle tint → `--op-surface`, divider → `--op-border`, placeholder → `--op-text-faint`, secondary text → `--op-text-muted`, overlay → `--op-surface-2`.

### 2.6 Data-viz palette (Graph Explorer only — §8)

Used **only** inside the graph canvas for node/edge rendering. Never in chrome (headers, buttons, badges).

| Node type | Hex |
|---|---|
| Person       | `#4ade80` |
| Repository   | `#60a5fa` |
| Commit       | `#fbbf24` |
| Organisation | `#a78bfa` |
| Institution  | `#fbbf24` |
| PullRequest  | `#f472b6` |

`Institution` (a ROR-identified research org, distinct from a GitHub `Organisation`) reuses the amber slot — safe because Commit nodes never co-occur with Institutions in the collaboration graphs that use them.

Keep these in a single graph-data module (a `NODE_COLORS` map). All viz code reads from there — no second hex table. (Canvas/D3 can't read CSS variables, so hex literals are allowed here — the one exception to the no-raw-hex rule.)

### 2.7 Footer

| Token | Hex | Role |
|---|---|---|
| `--op-footer-bg` | `#000000` | Footer surface (true black for partner-logo contrast). |
| `--op-footer-border` | `rgba(255,255,255,0.10)` | Dividers within the footer. |

### 2.8 Where to put a new color

1. If it's a **brand value**, it must come from an sdsc-ui-kit scale — check `references/design-tokens.md` before anything else.
2. Add `--op-<name>: <hex>;` to the `:root` block in your global stylesheet.
3. If you use a utility framework, mirror it in the theme config.
4. Document it in §2 of this file (with its sdsc-ui-kit source, if any).
5. Never write a raw hex in template markup. Canvas/D3/SVG drawing code is the only exception.

---

## 3. Typography (dark delta)

Anatomy, weights, and best practices: `sdsc-ui-kit` (`references/design-tokens.md` → Typography). What changes here:

### 3.1 Fonts — three families, loaded from npm (deviations 5–6)

| Family | Where | Source |
|---|---|---|
| **Space Grotesk** | All headings (`h1`–`h6`), display numbers, wordmarks. | Fontsource (`@fontsource-variable/space-grotesk`) |
| **Switzer** | Body, buttons, inputs, navigation, labels — all UI chrome. | npm (`@carrot-kpi/switzer-font`) — **not** the Fontshare CDN |
| **JetBrains Mono** | Code, IDs, SHA fragments, query snippets. Keep the `.mono` utility class. | Fontsource (`@fontsource/jetbrains-mono`) |

Load all three as **JS imports once at your app's entry point** (bundlers resolve npm font packages from JS context; bare npm specifiers in CSS often fail):

```js
import '@fontsource-variable/space-grotesk';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@carrot-kpi/switzer-font/400.css';
import '@carrot-kpi/switzer-font/500.css';
import '@carrot-kpi/switzer-font/600.css';
import '@carrot-kpi/switzer-font/700.css';
```

Your global stylesheet should contain **no** font `@import` statements. Set `'Switzer', system-ui, sans-serif` on `body` and `'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif` on `h1`–`h6`. Canvas/SVG text elements need an explicit `font-family` attribute — they don't inherit from CSS.

### 3.2 Scale — compressed for dashboards (deviation 4)

| Role | Size | Weight | Token |
|---|---|---|---|
| H1 — Display | 48px | Bold (700) | `text-op-h1` |
| H2 — Section | 32px | Bold (700) | `text-op-h2` |
| H3 — Subsection | 24px | Semibold (600) | `text-op-h3` |
| H4 — Component title | 18px | Semibold (600) | `text-op-h4` |
| Body Large (lead) | 18px | Regular (400) | `text-op-lg` |
| Body | 16px | Regular (400) | `text-op-md` |
| Body Small | 14px | Regular (400) | `text-op-sm` |
| Button | 14px | Regular (400), **UPPERCASE**, `tracking-wide` | `text-op-button` |
| Caption | 12px | Regular (400) | `text-op-caps` |
| Micro | 11px | Regular (400) | `text-op-micro` |

Line-height 1.5–1.6 body / 1.2–1.3 headings; letter-spacing −0.02em on H1/H2 (as base kit).

### 3.3 Dark-legibility rules

- Prefer **Regular (400)** body weight; 300/light weights hairline-out on dark. Headings stay Bold/Semibold.
- Hyperlinks: `text-op-blue-light hover:text-op-blue` (base kit uses base-blue links; on dark, start from the lighter step). Trailing `→` on navigational/CTA links, per the base kit.

---

## 4. Spacing & corners (dark delta)

Spacing rhythm is the base kit's rem t-shirt scale (`sdsc-ui-kit` `design-tokens.md` → Spacing). Quick utility values used throughout this repo: card `p-6`/`p-8` (hero `p-12`), section gap `space-y-12`–`space-y-16`, page `max-w-7xl mx-auto px-6` (1280px), content column `max-w-3xl`/`max-w-4xl`.

Radius — same signature as the base kit, with the badge deviation (§1.2 #3):

| Use | Class |
|---|---|
| Cards, panels, tables, banners, hero sections, sidebar nav links | `rounded-none` |
| Buttons (all sizes), **status badges**, icon buttons, date chips | `rounded` (4px) |
| Floating icon button / avatar | `rounded-full` |

**Never** `rounded-md`/`-lg`/`-xl` for chrome. If you see one in existing code, it's legacy — remove it.

---

## 5. Content label (`〇 LABEL`)

Anatomy and spacing (label → title 12px, title → body 16px) are the base kit's — see `sdsc-ui-kit` `design-tokens.md` → *Content hierarchy & labels*. Dark colour mapping:

| Line | Base kit (light) | This theme |
|---|---|---|
| `〇 LABEL` | grey `#848484` | `--op-text-muted`, 14px Switzer Medium, uppercase, `tracking-wide` |
| Section title | black | `--op-text`, Space Grotesk Bold |
| Body | black | `--op-text-2`, 16px Switzer Regular |

```html
<div class="space-y-3">
  <div class="flex items-center gap-2">
    <span class="text-op-button font-bold" style="color:var(--op-text-muted)">〇</span>
    <p class="text-op-sm font-medium uppercase tracking-wide" style="color:var(--op-text-muted)">LABEL</p>
  </div>
  <h2 class="text-op-h2" style="color:var(--op-text)">Section Title</h2>
  <p class="text-op-md leading-relaxed" style="color:var(--op-text-2)">Body content…</p>
</div>
```

---

## 6. Component dark patterns

Component anatomy (padding, borders, states, transitions) is defined in `sdsc-ui-kit` `references/components.md` — copy it from there. This section gives only the dark values and the patterns that differ.

### 6.1 Card (deviation 2 — bordered)

```html
<div class="rounded-none border border-op-border bg-op-surface p-8">…</div>
```

- **Default card**: `bg-op-surface`, `border-op-border`, `p-6`–`p-8`.
- **Elevated card**: `bg-op-surface-2` — table heads, cards sitting "above" other cards.
- **Soft banner**: `bg-op-blue-pale`, no border, `p-8`–`p-12` (replaces the kit's `#dddeec` band).
- **Loud banner / hero**: `bg-op-blue-dark`, white text, `p-8`–`p-12` (same as base kit).

### 6.2 Buttons

Anatomy per base kit (uppercase Switzer 14px w400, `rounded` 4px, 12px/24px padding, 200ms transition, 44px min target). Dark variant colours:

| Variant | Pattern |
|---|---|
| **Primary** | `bg-op-blue text-white hover:bg-op-blue-mid active:bg-op-blue-dark` |
| **Secondary (outline)** | `bg-transparent text-op-text border border-op-blue hover:text-op-blue-light` (base kit's black text → `--op-text` on dark) |
| **Text** | `text-op-blue-light px-4 py-2 hover:bg-op-surface-2 hover:text-op-blue` |
| **Icon (round)** | `rounded-full w-14 h-14 bg-op-blue text-white hover:bg-op-blue-mid` — floating/FAB only |

Focus ring: 2px `var(--op-blue)`. Disabled (deviation 7): `bg-op-surface-2 text-op-text-faint cursor-not-allowed` — **not** `opacity-50`, which smudges on dark.

### 6.3 Status badge (deviation 3 — sharp, not pill)

Semantic colour **only** here and on toasts; 12% alpha fill:

```html
<span class="rounded px-2.5 py-0.5 text-op-sm font-medium uppercase tracking-wide"
      style="color:var(--op-success);background:rgba(52,211,153,0.12)">
  succeeded
</span>
```

| State | Fg token | Bg |
|---|---|---|
| succeeded | `--op-success` `#34d399` | `rgba(52,211,153,0.12)` |
| running | `--op-blue-light` `#8a94c9` | `rgba(138,148,201,0.15)` |
| failed | `--op-error` `#f87171` | `rgba(248,113,113,0.12)` |
| pending | `--op-text-muted` `#9898b8` | `rgba(152,152,184,0.10)` |
| warning | `--op-warning` `#fbbf24` | `rgba(251,191,36,0.12)` |

### 6.4 Table

```html
<div class="overflow-hidden rounded-none border border-op-border">
  <table class="w-full">
    <thead class="bg-op-surface-2">
      <tr><th class="px-4 py-3 text-left text-op-sm font-semibold uppercase tracking-wide"
              style="color:var(--op-text-muted)">Column</th></tr>
    </thead>
    <tbody class="bg-op-surface">
      <tr class="border-t border-op-border">
        <td class="px-4 py-3 text-op-md" style="color:var(--op-text-2)">…</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 6.5 Icon box (feature grids)

Square (`rounded-none`), translucent blue fill at **18% alpha** (higher than the kit's light-mode 10% so it reads on dark), light-blue Lucide icon. 40px compact / 48px standard.

```html
<div class="w-12 h-12 flex items-center justify-center rounded-none"
     style="background:rgba(85,97,166,0.18)">
  <svg class="w-6 h-6" style="color:var(--op-blue-light)">…</svg>
</div>
```

### 6.6 Input

Base-kit anatomy; dark values: `bg-op-surface`, `border-op-border`, text `--op-text`, placeholder `--op-text-muted`, focus `outline-2 outline-op-blue`. `rounded` (4px) per the base kit.

---

## 7. Layouts

The ten page archetypes live in `sdsc-ui-kit` `references/layouts.md`. §7.1–§7.3 give their dark mappings; §7.4–§7.5 are dashboard-required components with no base-kit counterpart.

### 7.1 App header (sticky, dark, branded)

```html
<header class="sticky top-0 z-10 bg-op-surface border-b border-op-border">
  <div class="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
    <img src="/sdsc-logo-white.png" alt="SDSC" class="h-10" />
    <nav class="hidden md:flex items-center gap-6 text-op-sm">
      <a class="text-op-text-muted hover:text-op-blue-light transition-colors">Graph</a>
      <a class="text-op-text-muted hover:text-op-blue-light transition-colors">Health</a>
    </nav>
  </div>
</header>
```

Always the **white logo variant** (`SDSC_logo_horizontal_rgb_white.png`) on the dark header.

### 7.2 Footer (black, partner logos)

`bg-op-footer-bg` (true black), `max-w-7xl` inner container, description + resources columns, then the partner-logo row. Logo files, sizes, 48px gap, and the always-all-four rule are the base kit's (`design-tokens.md` → Logo); on this footer apply `filter: brightness(0) invert(1)` so all render white, hover opacity 70% → 100%.

### 7.3 Archetype dark mappings

For each base-kit layout, substitute:

| Base-kit element | Dark token |
|---|---|
| Hero overlay / loud banner / key-numbers band | `bg-op-blue-dark`, white text, 48px Space Grotesk Bold stats |
| Soft banner / highlighted section | `bg-op-blue-pale` |
| Feature/article/event cards | §6.1 card (bordered — deviation 2) |
| Event-row date chip | `bg-op-blue` text white (`bg-op-blue-dark` for past entries) |
| Article-card top strip | `linear-gradient(135deg, #5561a6, #26235c)` — the only gradient allowed |
| Content + sidebar (list/detail shell) | Asymmetric `grid-cols-[280px_1fr]`; sidebar `bg-op-surface` with right `border-op-border`; active nav item `text-op-blue-light` + 2px left `border-op-blue`; inactive `text-op-text-2` hover `text-op-blue-light` |
| List bullets | `〇` prefix for primary lists, Lucide `Check` in `--op-blue-light` for confirmation lists — no `disc` bullets |

### 7.4 Attribution bar (required, top of every page)

A thin bar at the **very top** of every page (above the §7.1 header) crediting the data source. Required on every route.

```html
<div class="bg-op-surface-2 border-b border-op-border">
  <div class="max-w-7xl mx-auto px-6 py-1.5 text-op-micro" style="color:var(--op-text-muted)">
    Built using
    <a href="https://openpulse.science" class="text-op-blue-light hover:text-op-blue transition-colors">openpulse.science</a>
    at <span class="mono">{BUILD_TIMESTAMP}</span>
  </div>
</div>
```

- `{BUILD_TIMESTAMP}` is injected at **build time** (ISO 8601 UTC, e.g. `2026-06-09T14:32Z`) — never computed in the browser. Inject via your bundler's define/env mechanism or generate it into the HTML at build.
- Topmost element, full-width, elevated surface, muted text, mono timestamp, `openpulse.science` link in `--op-blue-light`.

### 7.5 Provenance disclosure — "How is this computed?" (required on data cards)

Every card showing a number or chart derived from Open Pulse data carries the **same** compact disclosure — one shared component, never bespoke per-section explanations. Four fixed fields: *Source* (Neo4j / GraphDB (SPARQL) / GrimoireLab / GitHub API / Infoscience), *Method* (Graph crawler / git-metadata-extractor (LLM) / Classifier / CHAOSS metrics API / Direct query), *Refresh* (cadence), *Caveats* (honest limitations, e.g. "discipline inferred by classifier, may be wrong").

```html
<details class="op-provenance">
  <summary><span aria-hidden="true">ⓘ</span> How is this computed?</summary>
  <dl>
    <div><dt>Source</dt><dd class="mono">Neo4j + GrimoireLab</dd></div>
    <div><dt>Method</dt><dd class="mono">Graph crawler</dd></div>
    <div><dt>Refresh</dt><dd>Monthly pipeline snapshot; page baked at build time</dd></div>
    <div><dt>Caveats</dt><dd>Only repos the crawler has walked appear.</dd></div>
  </dl>
</details>
```

Styling: `border-top: 1px solid var(--op-border-subtle)`, 12px text; summary in `--op-text-faint` uppercase `tracking-wide`, hover `--op-blue-light`, no disclosure marker; the `<dl>` a two-column `max-content 1fr` grid with `dt` in 11px `--op-text-faint` uppercase and `dd` in 12px `--op-text-muted`. Build it once as a shared component (e.g. `src/components/provenance.ts`) and use it on every data card.

---

## 8. Graph Explorer

A force-directed graph view is one of the reference layouts (full-page canvas). The canvas shares the site's dark tokens. Specifics:

- **Canvas surface** uses the page background `--op-bg` with a subtle dot grid (`radial-gradient(circle, #242438 1px, transparent 1px)` at `28px 28px`). Expose it as a `.dot-grid` utility in your global stylesheet.
- **Floating canvas overlays** (legend, hint strip) use a translucent dark card: `background: rgba(20,20,32,0.85); backdrop-filter: blur(10px); border: 1px solid var(--op-border)`, `rounded-none`.
- **D3 link colour**: `var(--op-blue)` (`#5561a6`) — stored as a hex literal in drawing code since canvas/D3 can't read CSS variables.
- **Selection ring** around an active node: `var(--op-blue-light)` (`#8a94c9`) at 80% opacity.
- **Node fill colours**: from the single `NODE_COLORS` map (§2.6) — never duplicate the hex table.

Chrome around the canvas (header, query sidebar, node-detail panel, timeline strip) uses §6 and the base kit.

---

## 9. Backgrounds & patterns (dark delta)

Pattern files, placement rules (asymmetric `left center`/`right center`, never plain `center`), and usage do/don'ts are the base kit's (`design-tokens.md` → Dot pattern). Dark specifics:

- **Page background**: flat `--op-bg`. The dot grid is reserved for the graph canvas (§8) — don't sprinkle it elsewhere.
- **Hero/banner pattern**: layer over `--op-blue-dark` with `background-blend-mode: overlay` so the pattern stays visible but dim; overlay content cards use `bg-op-surface/85 backdrop-blur-sm`.
- **Gradients**: only `linear-gradient(135deg, #5561a6, #26235c)` (hero surrogates, article-card tops). Nothing else.

---

## 10. Adopting this theme in a new app

When you scaffold `src/your-web/` (or restyle an existing app), apply in this order — each step verifiable with a Playwright MCP screenshot (per `CLAUDE.md`):

1. **Tokens** — add the §2 palette as `--op-*` custom properties in your global stylesheet's `:root` (mirror into your utility framework's theme if you use one).
2. **Fonts** — install the three npm packages and import them at the app entry point (§3.1).
3. **Corners** — `rounded-none` chrome; `rounded` (4px) only on buttons/badges; `rounded-full` only avatars/FAB (§4).
4. **Two blues** — every interactive element uses `--op-blue`/`--op-blue-light`; status colours only on badges/toasts; no chrome greens, no glow.
5. **Shell** — attribution bar (§7.4) + header (§7.1) + black footer (§7.2) on every route; list/detail views use the content+sidebar mapping (§7.3).
6. **Surfaces** — build pages from the base-kit archetypes with the §6/§7.3 dark values; `〇 LABEL` block (§5) on every titled section; provenance disclosure (§7.5) on every data card.
7. **Graph/canvas views** — §8 rules; node colours from the single `NODE_COLORS` map.

If you keep a separate design-doc file, this skill + `sdsc-ui-kit` are the source of truth when they disagree.

---

## 11. Do / Don't (dark-specific)

The base kit's do/don'ts all apply. Additionally:

**Do**
- Keep chrome to the two brand blues; status colours only on badges/toasts.
- Maintain WCAG-AA contrast on dark: body text `--op-text` or `--op-text-2`; never `--op-text-faint` on `--op-surface`.
- Give every interactive element a hover state (`--op-blue` → `--op-blue-mid` surfaces; `--op-blue-light` → `--op-blue` links).

**Don't**
- Don't add a light-mode toggle — the UI is dark by design.
- Don't use sdsc-ui-kit's `.dark` values (`#1a1a1a`/`#2d2d2d`) — this theme has its own palette (§2.1).
- Don't use the green accent `#90ca42` in chrome (§1.2 #8).
- Don't use `opacity-50` for disabled states on dark (§6.2).
- Don't write raw hex in template markup — `var(--op-*)` or utilities only (canvas/SVG drawing is the exception).
- Don't add glow / neon / drop-shadow chrome.

---

## 12. Quick reference card

| Need | Use |
|---|---|
| Page background | `bg-op-bg` (`#0c0c12`) |
| Card | `bg-op-surface border border-op-border rounded-none p-8` |
| Elevated card | `bg-op-surface-2 border border-op-border rounded-none` |
| Primary action | `bg-op-blue text-white hover:bg-op-blue-mid rounded uppercase px-6 py-3 tracking-wide` |
| Secondary action | `bg-transparent text-op-text border border-op-blue rounded uppercase px-6 py-3` |
| Heading | `h2` Space Grotesk 32px Bold `var(--op-text)` |
| Body | `p` Switzer 16px Regular `var(--op-text-2)` |
| Link | `text-op-blue-light hover:text-op-blue` |
| Section label | `〇 LABEL` `var(--op-text-muted)` uppercase 14px Switzer Medium |
| Banner (soft / loud) | `bg-op-blue-pale` / `bg-op-blue-dark` text-white |
| Footer | `bg-op-footer-bg` (`#000000`) + partner logos `filter:brightness(0) invert(1)` |
| Status badge | `rounded` + §6.3 alpha fills |
| Code / IDs | `.mono` (JetBrains Mono) |

---

**Maintained by:** SDSC pulseWebKit team. Update this file when `sdsc-ui-kit` changes (re-derive the §1.1 translation and §2 tokens from its scales) or when a new deliberate deviation is agreed (add it to §1.2 — undocumented differences are drift).
**Ground truth for brand values:** the `sdsc-ui-kit` skill (`SDSC_Design_System.pdf`, datascience.ch Webflow production, June 2026). Restructured 2026-07-07 from the standalone v2.1-Figma-based spec into a delta over `sdsc-ui-kit`; brand hexes corrected to the PDF values (`#5561a6`, `#26235c`), semantic dark steps aligned to the sdsc scales.
