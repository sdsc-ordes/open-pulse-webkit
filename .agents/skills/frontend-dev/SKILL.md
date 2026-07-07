---
name: frontend-dev
description: Frontend / UI work on the pulseWebKit web app. Encodes the SDSC visual identity (Swiss Data Science Center UI Kit v2.1) translated into a permanent dark theme — colors, typography, spacing, components, and page layouts the UI must follow. Framework-agnostic: tokens are plain CSS custom properties and examples are HTML/CSS, adapt them to whatever stack you build the app in. TRIGGER when editing anything under `src/your-web/`; adding or restyling a page, component, or design token; rewriting layouts; changing colors, fonts, radius, or spacing; reviewing UI PRs; or when the user says "design", "restyle", "rebrand", "dark mode", "match the Figma", "make it pretty". SKIP for backend, devcontainer, Docker, CI, or shell-script work.
---

# Frontend dev — pulseWebKit visual system (dark-mode SDSC)

> **Source of truth for UI work in this repo.** Read this before touching anything in `src/your-web/`. The pulseWebKit UI runs as a **permanent dark theme**: it adopts the Swiss Data Science Center UI Kit v2.1 (Figma Make: `ui-kit-basic--Community-`, file key `xFRPysbb2ni4RXyuT7dVqq`, based on `datascience.ch`) — its typography, spacing, sharp corners, button shape, and `〇` label pattern — and translates the kit's palette into ink-blues on a near-black canvas. There is **no light mode**; do not add one.
>
> **Framework-agnostic.** This system is defined in terms of CSS custom properties and HTML/CSS. The examples below use Tailwind-style utility classes plus `var(--op-*)` for clarity, but nothing here depends on a specific UI framework — translate the markup to whatever you build `src/your-web/` with (plain HTML, React, Vue, Svelte, web components, …). The *tokens, type scale, spacing, and layout archetypes* are the contract; the exact markup is not.

---

## 0. How to use this skill

1. **Read this whole file** the first time you touch a UI surface in a session — it's the design language.
2. Cross-reference `AGENTS.md` for general repo conventions and the **UI verification rule** (every visible change must be exercised through the Playwright MCP server against the running dev server).
3. When in doubt about a colour, radius, or spacing decision, **add it to §2 of this file first**, then use it in code. Never invent ad-hoc tokens.

---

## 1. Mission & posture

The UI is **dark, Swiss, sharp-edged**:

- **Swiss / academic** — minimal, structured, no glow chrome, no neon, no rounded corners.
- **Ink-blue on near-black** — the entire chrome is composed of near-black surfaces (`#0c0c12` → `#1c1c2c`) and SDSC ink-blue accents (`#26245c`, `#5461a6`). White text reads at high contrast on top.
- **Two blues are the only chrome color** the UI is allowed to project. Status colours (success/error/warning) appear only on badges and toasts. The dataviz palette (§2.5) is restricted to inside the graph canvas.
- **All-caps buttons** with `rounded-none`, and the `〇`-prefixed labelling pattern from the Figma kit.

Translation rule from the (light-mode) Figma kit to this dark theme:

| Figma kit (light) | This UI (dark) |
|---|---|
| Page `#fafafa` | Page `#0c0c12` |
| Card `#ffffff` | Card `#141420` |
| Border `#e5e5e5` | Border `#242438` |
| Body text `#000000` | Body text `#f4f4fc` |
| Body secondary `#666666` | Body secondary `#c0c0dc` |
| Labels / captions `#848484` | Labels / captions `#9898b8` |
| Banner soft `#dddeec` | Banner soft `#1a1834` (deep blue, slightly elevated) |
| Banner loud `#26245c` | Banner loud `#26245c` (unchanged) |
| Footer black `#000000` | Footer black `#000000` (unchanged) |
| Primary blue `#5461a6` | Primary blue `#5461a6` (unchanged) |
| Hover on primary `#26245c` | Hover on primary `#3a4585` (lighter step, reads against dark) |
| Link `#5461a6` | Link `#8a94c9` (lighter step for legibility on dark) |
| Success `#10b981` | Success `#4ade80` (brighter green for dark contrast) |
| Warning `#f59e0b` | Warning `#fbbf24` (Figma "light" step, visible on dark) |
| Error `#ef4444` | Error `#f87171` (Figma "light" step, visible on dark) |
| Info `#3b82f6` | Info `#5461a6` (aliased to brand blue) |

Everything else (typography, radius, spacing, label pattern, button shape) is identical to the Figma kit.

---

## 2. Color tokens

Define all design tokens as **CSS custom properties** in your app's global stylesheet (the `:root` block). They are framework-neutral and any markup can reference them via `var(--op-*)`.

If you use a utility-CSS framework (e.g. Tailwind v4), also expose the same values in its theme config — for Tailwind v4 that means an `@theme` block that generates `bg-op-*`, `text-op-*`, `border-op-*` utilities. **Keep the two definitions in sync** (one `:root`, one theme config). Code that can't use utilities (inline styles, canvas/D3 drawing) always reads `var(--op-*)`.

### 2.1 Surfaces

| Token | Hex | Role |
|---|---|---|
| `--op-bg` | `#0c0c12` | Page background. The base of every page. |
| `--op-surface` | `#141420` | Default card / panel. |
| `--op-surface-2` | `#1c1c2c` | Elevated surface — table heads, second-level cards, hover targets on cards. |
| `--op-surface-active` | `#1a1834` | Selected / active row, current sidebar item background. |
| `--op-border` | `#242438` | Default border for cards, dividers, table cells. |
| `--op-border-subtle` | `#1a1a28` | Dim/inset border — under headings, badge outlines. |

### 2.2 Brand ink-blues (SDSC primary)

| Token | Hex | Figma kit step | Role |
|---|---|---|---|
| `--op-blue-darker` | `#161438` | Dark Blue → Darker | Pressed state for dark-blue banners, footer accents. |
| `--op-blue-dark` | `#26245c` | Dark Blue → Base | **SDSC primary brand.** Loud banners, key-numbers band, dark hero overlay. |
| `--op-blue-mid` | `#3a4585` | *(dark-adaptation only)* | Hover step on primary-blue surfaces (between `dark` and `base`). |
| `--op-blue` | `#5461a6` | Light Blue → Base | **SDSC interactive blue.** Primary button background, icon fill, focus ring, D3 link colour. |
| `--op-blue-light` | `#8a94c9` | Light Blue → Lighter | Hyperlinks, lighter accents, hover text colour on dark. |
| `--op-blue-pale` | `#1a1834` | *(dark-adaptation only)* | "Soft banner" replacement for the kit's `#dddeec` on dark. Deep blue elevated band. |

Full Figma scales (source of truth — do not invent intermediate steps):

| Scale | Lighter | Light | Base | Dark | Darker |
|---|---|---|---|---|---|
| Dark Blue | `#4a4889` | `#383673` | `#26245c` | `#1e1c4a` | `#161438` |
| Light Blue | `#8a94c9` | `#6f7ab8` | `#5461a6` | `#434e85` | `#323b64` |

### 2.3 Text

| Token | Hex | Role |
|---|---|---|
| `--op-text` | `#f4f4fc` | Primary text. Headings, body. |
| `--op-text-2` | `#c0c0dc` | Secondary text. Long-form body paragraphs, table cells. |
| `--op-text-muted` | `#9898b8` | Captions, labels, `〇 LABEL` text, table heads. |
| `--op-text-faint` | `#6a6a88` | Fine print, timestamps, disabled labels. |
| `--op-text-on-blue` | `#ffffff` | Text on `--op-blue` or `--op-blue-dark` surfaces. |

### 2.4 Status / feedback (UI chrome only)

Figma kit source values (light mode) → dark-theme adaptation used here:

| Token | Dark hex | Figma source (light) | Role |
|---|---|---|---|
| `--op-success` | `#4ade80` | Base `#10b981` | succeeded badges, ✓ confirmations. Stepped up to green-400 so it reads on near-black. |
| `--op-error`   | `#f87171` | Base `#ef4444` | failed badges, error toasts, destructive actions. Uses Figma "Light" step. |
| `--op-warning` | `#fbbf24` | Base `#f59e0b` | restarting / degraded states. Uses Figma "Light" step. |
| `--op-info`    | `#5461a6` | Base `#3b82f6` | Aliased to `--op-blue` (brand blue reads better than info-blue on dark). |

Full Figma semantic scales (for light-mode context and badge backgrounds):

| Scale | Lighter | Light | Base | Dark | Darker |
|---|---|---|---|---|---|
| Success | `#6ee7b7` | `#34d399` | `#10b981` | `#059669` | `#047857` |
| Warning | `#fcd34d` | `#fbbf24` | `#f59e0b` | `#d97706` | `#b45309` |
| Error   | `#fca5a5` | `#f87171` | `#ef4444` | `#dc2626` | `#b91c1c` |
| Info    | `#93c5fd` | `#60a5fa` | `#3b82f6` | `#2563eb` | `#1d4ed8` |

Badge fill convention: `color: var(--op-<state>); background: <state>/12% alpha`.

### 2.5 Figma neutral surface scale (reference)

The kit defines a 10-step neutral grayscale used in light-mode surfaces, borders, and disabled states. This repo does **not** expose these as `--op-*` tokens (the dark surfaces above cover it), but document them here so you can derive correct dark-side values when introducing new surfaces:

| Step | Hex | Light-mode usage | Dark-mode analogue |
|---|---|---|---|
| 50  | `#fafafa` | Page background | `--op-bg` `#0c0c12` |
| 100 | `#f5f5f5` | Subtle section tint | `--op-surface` `#141420` |
| 200 | `#e5e5e5` | Card border, divider | `--op-border` `#242438` |
| 300 | `#d4d4d4` | Medium border, disabled | `--op-border-subtle` `#1a1a28` |
| 400 | `#a3a3a3` | Placeholder text | `--op-text-faint` `#6a6a88` |
| 500 | `#737373` | Secondary text | `--op-text-muted` `#9898b8` |
| 600 | `#525252` | Strong border, captions | `--op-text-2` `#c0c0dc` (shifted warm/blue) |
| 700 | `#404040` | Overlay background | `--op-surface-2` `#1c1c2c` |
| 800 | `#262626` | Dark section bg | `--op-surface-active` `#1a1834` |
| 900 | `#171717` | Near-black text | `--op-text` `#f4f4fc` (inverted) |

Usage notes: `50–200` = light backgrounds/subtle borders; `300–500` = dividers/placeholder/secondary; `600–900` = strong text/overlays.

### 2.6 Data-viz palette (Graph Explorer only — §8)

These are **only** used inside the graph canvas and node/edge rendering. They must not appear in chrome (headers, buttons, badges).

| Node type | Hex |
|---|---|
| Person       | `#4ade80` |
| Repository   | `#60a5fa` |
| Commit       | `#fbbf24` |
| Organisation | `#a78bfa` |
| Institution  | `#fbbf24` |
| PullRequest  | `#f472b6` |

`Institution` (a ROR-identified research org, distinct from a GitHub `Organisation`) reuses the amber slot — safe because Commit nodes never co-occur with Institutions in the collaboration graphs that use them.

Source: keep these in a single graph-data module (a `NODE_COLORS` map). All viz code reads from there — no second hex table.

### 2.7 Footer

| Token | Hex | Role |
|---|---|---|
| `--op-footer-bg` | `#000000` | Footer surface (true black for partner-logo contrast). |
| `--op-footer-border` | `rgba(255,255,255,0.10)` | Dividers within the footer. |

### 2.8 Where to put a new color

1. Add `--op-<name>: <hex>;` to the `:root` block in your global stylesheet.
2. If you use a utility framework, mirror it in the theme config (e.g. Tailwind `--color-op-<name>: <hex>;` in `@theme`).
3. Document it in §2 of this file.
4. Never write a raw hex in template markup. Canvas/D3/SVG drawing code is the only exception.

---

## 3. Typography

### 3.1 Fonts

| Family | Where | Source |
|---|---|---|
| **Space Grotesk** | All headings (`h1`–`h6`), display numbers, wordmarks. Weight 600–700. | Fontsource (`@fontsource-variable/space-grotesk`) |
| **Switzer** | Body, paragraphs, buttons, inputs, navigation, labels, all UI chrome. Weight 400–600. | npm (`@carrot-kpi/switzer-font`) — **not** the Fontshare CDN |
| **JetBrains Mono** | Code, IDs, SHA fragments, query snippets — anything monospaced. Keep the `.mono` utility class. | Fontsource (`@fontsource/jetbrains-mono`) |

Load all three fonts as **JavaScript/TypeScript imports once at your app's entry point** (the module your bundler — Vite, webpack, etc. — runs first). Bundlers resolve npm font packages from JS context; importing bare npm specifiers directly from CSS often does not work:

```js
import '@fontsource-variable/space-grotesk';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@carrot-kpi/switzer-font/400.css';
import '@carrot-kpi/switzer-font/500.css';
import '@carrot-kpi/switzer-font/600.css';
import '@carrot-kpi/switzer-font/700.css';
```

Your global stylesheet should contain **no** font `@import` statements — only the utility-framework import (if any) and the `:root` token block.

Set `'Switzer', system-ui, sans-serif` on `body`. Set `'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif` on `h1`–`h6`. Canvas/SVG text elements require an explicit `font-family` attribute — they do not inherit from CSS.

### 3.2 Scale

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

Line-height: **1.5–1.6** for body, **1.2–1.3** for headings. Letter-spacing **-0.02em** on H1/H2.

Dark-mode legibility nudge: prefer **Regular (400)** body weight. Avoid 300/light weights on dark — they hairline-out. Headings stay Bold/Semibold.

Apply `.mono` for any monospaced content (IDs, queries, JSON dumps).

### 3.3 Hyperlinks

```html
<a class="text-op-blue-light hover:text-op-blue transition-colors">link text →</a>
```

Trailing `→` arrow is the SDSC convention for navigational/CTA links inside body text.

---

## 4. Spacing & corners

### 4.1 Border radius

The SDSC kit is sharp; buttons carry a subtle 4 px curve:

| Use | Class |
|---|---|
| Cards, panels, tables, banners, hero sections, sidebar nav links | `rounded-none` |
| Buttons (all sizes), status badges, icon buttons, date chips | `rounded` (4 px) |
| Floating icon button / avatar | `rounded-full` |

**Never** use `rounded-md`, `rounded-lg`, `rounded-xl` for chrome. If you see one in existing code, it's legacy and should be removed.

### 4.2 Padding / gap

| Use | Class |
|---|---|
| Card / panel | `p-6` (24px) — small, `p-8` (32px) — standard, `p-12` (48px) — hero |
| Button (medium) | `px-6 py-3` |
| Button (small) | `px-4 py-2` |
| Button (large) | `px-8 py-4` |
| Section gap (vertical) | `space-y-12` (48px) to `space-y-16` (64px) |
| Inside content block | `space-y-3` / `space-y-4` |
| Label → Title | `mb-3` (12px) |
| Title → Body | `mb-4` (16px) |

### 4.3 Page width

| Surface | Class |
|---|---|
| Page max-width | `max-w-7xl mx-auto` (1280px) |
| Content/article column | `max-w-4xl` or `max-w-3xl` |
| Page horizontal padding | `px-6` |

---

## 5. Foundational pattern — Content label

This is the SDSC kit's signature. Every titled section uses a three-line block (translated to dark text colours):

```
〇 LABEL                              ← --op-text-muted #9898b8, 14px Switzer Medium, uppercase, tracking-wide
Section Title Goes Here              ← --op-text #f4f4fc, Space Grotesk Bold
Body text…                           ← --op-text-2 #c0c0dc, 16px Switzer Regular
```

Reusable markup:

```html
<div class="space-y-3">
  <div class="flex items-center gap-2">
    <span class="text-op-button font-bold" style="color:var(--op-text-muted)">〇</span>
    <p class="text-op-sm font-medium uppercase tracking-wide" style="color:var(--op-text-muted)">
      LABEL
    </p>
  </div>
  <h2 class="text-op-h2" style="color:var(--op-text)">
    Section Title
  </h2>
  <p class="text-op-md leading-relaxed" style="color:var(--op-text-2)">
    Body content…
  </p>
</div>
```

Spacing inside the block: **label → title = 12px, title → body = 16px**.

---

## 6. Component patterns

### 6.1 Card

```html
<div class="rounded-none border border-op-border bg-op-surface p-8">
  …
</div>
```

Card hierarchy:
- **Default card**: `bg-op-surface` (`#141420`), `border-op-border` (`#242438`), `rounded-none`, `p-6`–`p-8`. Plain content panels.
- **Elevated card**: `bg-op-surface-2` (`#1c1c2c`), `border-op-border`, used for table heads or when a card needs to sit "above" another card.
- **Soft banner**: `bg-op-blue-pale` (`#1a1834`, deep blue tint), no border, `p-8`–`p-12`. The dark-mode replacement for the kit's `#dddeec`.
- **Loud banner / hero**: `bg-op-blue-dark` (`#26245c`), text white, `p-8`–`p-12`. Same as kit.

### 6.2 Buttons

All buttons share: **UPPERCASE text**, **Switzer Regular**, **`rounded-none`**, **min touch target 44px**, **focus ring 2px `#5461a6`**.

| Variant | When | Pattern |
|---|---|---|
| **Primary** | Single most important action on a screen. | `bg-op-blue text-white hover:bg-op-blue-mid active:bg-op-blue-dark` |
| **Secondary** | Less prominent alternative beside a primary. | `bg-transparent text-op-blue-light border-2 border-op-blue hover:bg-op-surface-2 hover:text-op-blue` |
| **Outline** | Subtle CTA / tertiary. | `bg-transparent text-op-text border border-op-border hover:border-op-blue hover:text-op-blue-light` |
| **Text** | Minimal, in-flow action. | `text-op-blue-light px-4 py-2 hover:bg-op-surface-2 hover:text-op-blue` |
| **Icon (round)** | Floating / FAB only. | `rounded-full w-14 h-14 bg-op-blue text-white hover:bg-op-blue-mid` |

Reference primary:

```html
<button
  class="rounded-none px-6 py-3 text-op-button font-normal uppercase tracking-wide
         bg-op-blue text-white hover:bg-op-blue-mid active:bg-op-blue-dark
         transition-all focus-visible:outline-2 focus-visible:outline-op-blue"
>
  Action
</button>
```

Disabled state: `bg-op-surface-2 text-op-text-faint cursor-not-allowed` (or the equivalent ghost/outline form). Do **not** use opacity-50 on dark — it makes buttons look smudged.

Min-width 120px on text buttons (not icon-only).

### 6.3 Link

```html
<a href="…" class="text-op-blue-light hover:text-op-blue transition-colors inline-flex items-center gap-1">
  Learn more <span aria-hidden>→</span>
</a>
```

### 6.4 Status badge

Status badges use semantic color **only** with subtle fill (no rounded pills).

```html
<span class="rounded-none px-2.5 py-0.5 text-op-sm font-medium uppercase tracking-wide"
      style="color:var(--op-success);background:rgba(74,222,128,0.12)">
  succeeded
</span>
```

| State | Fg token | Bg |
|---|---|---|
| succeeded | `--op-success` `#4ade80` | `rgba(74,222,128,0.12)` |
| running | `--op-blue-light` `#8a94c9` | `rgba(138,148,201,0.15)` |
| failed | `--op-error` `#f87171` | `rgba(248,113,113,0.12)` |
| pending | `--op-text-muted` `#9898b8` | `rgba(152,152,184,0.10)` |
| warning | `--op-warning` `#fbbf24` | `rgba(251,191,36,0.12)` |

### 6.5 Table

```html
<div class="overflow-hidden rounded-none border border-op-border">
  <table class="w-full">
    <thead class="bg-op-surface-2">
      <tr>
        <th class="px-4 py-3 text-left text-op-sm font-semibold uppercase tracking-wide"
            style="color:var(--op-text-muted)">
          Column
        </th>
      </tr>
    </thead>
    <tbody class="bg-op-surface">
      <tr class="border-t border-op-border">
        <td class="px-4 py-3 text-op-md" style="color:var(--op-text-2)">…</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 6.6 Icon box (for feature grids)

```html
<div class="w-12 h-12 flex items-center justify-center rounded-none"
     style="background:rgba(84,97,166,0.18)">
  <!-- your icon -->
  <svg class="w-6 h-6" style="color:var(--op-blue-light)"> … </svg>
</div>
```

Square (`rounded-none`), translucent blue fill (18% alpha — higher than the kit's light-mode 10% so it reads on dark), light-blue icon stroke. 40px for compact, 48px standard.

### 6.7 Input

```html
<input
  class="w-full rounded-none border border-op-border bg-op-surface px-4 py-3
         text-op-md text-op-text placeholder:text-op-text-muted
         focus-visible:outline-2 focus-visible:outline-op-blue"
/>
```

No rounded corners. Surface fill so the field reads against the page background. 2px blue outline on focus.

---

## 7. Layout templates

The Figma kit defines ten page templates. Each is reproduced here in dark-mode form.

### 7.1 App header (sticky, dark, branded)

```html
<header class="sticky top-0 z-10 bg-op-surface border-b border-op-border">
  <div class="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
    <img src="/sdsc-logo-white.png" alt="SDSC" class="h-10" />
    <nav class="hidden md:flex items-center gap-6 text-op-sm">
      <a class="text-op-text-muted hover:text-op-blue-light transition-colors">Graph</a>
      <a class="text-op-text-muted hover:text-op-blue-light transition-colors">Pipeline</a>
      <a class="text-op-text-muted hover:text-op-blue-light transition-colors">Health</a>
    </nav>
  </div>
</header>
```

Always use the **white logo variant** (`SDSC_logo_horizontal_rgb_white.png`) on the dark header.

### 7.2 Footer (black, partner logos)

```html
<footer class="bg-op-footer-bg text-white mt-16">
  <div class="max-w-7xl mx-auto px-6 py-12">
    <!-- description column + Resources + Inspired-by columns -->
    <!-- partner logo row, filter: brightness(0) invert(1) -->
    <!-- copyright row -->
  </div>
</footer>
```

Always include **all four partner logos** (ETH Zürich h-12, EPFL h-10, PSI h-11, Biopôle h-9) with a 48px gap and a hover opacity transition (70% → 100%). Use the `brightness(0) invert(1)` filter so all logos render in white.

### 7.3 Hero — image + content (split)

```html
<section class="grid md:grid-cols-2 gap-0 border border-op-border">
  <div class="h-96"
       style="background:url(/patterns/dots-left.svg) center/cover;
              background-color:var(--op-blue-dark);
              background-blend-mode:overlay"></div>
  <div class="bg-op-surface p-12 flex flex-col justify-center">
    <div class="flex items-center gap-2 mb-4">
      <span style="color:var(--op-text-muted)">〇</span>
      <p class="text-op-sm uppercase tracking-wide" style="color:var(--op-text-muted)">LABEL</p>
    </div>
    <h2 class="text-op-h2 mb-4" style="color:var(--op-text)">Title</h2>
    <p class="text-op-md leading-relaxed mb-6" style="color:var(--op-text-2)">Body…</p>
    <button class="…primary button…">Learn More →</button>
  </div>
</section>
```

### 7.4 Feature grid (2 / 3 / 4 column)

Dark cards (`bg-op-surface` with `border-op-border`) on the page background, OR placed on a `bg-op-blue-pale` band (`#1a1834`) when you want a deeper section. Each card: icon box (§6.6) + title + 1–2 lines of body.

### 7.5 Full-width banner

- **Soft variant**: `bg-op-blue-pale` (`#1a1834`) for low-emphasis CTAs.
- **Loud variant**: `bg-op-blue-dark` (`#26245c`) for high-emphasis CTAs (white text, white-outline button).

### 7.6 Key numbers

Deep blue band (`bg-op-blue-dark`, `#26245c`) with 4 large stats: **48px Space Grotesk Bold white** number above a body-size white-90% label. Same as the kit.

### 7.7 List layout

`〇 prefix` for primary bulleted lists. `Check` icon (`--op-blue-light`) for confirmation lists. No `disc` bullets.

### 7.8 Content + sidebar

Asymmetric `grid-cols-[280px_1fr]`. Sidebar: `bg-op-surface`, right-border `border-op-border`, `p-6`. Active nav item: `text-op-blue-light` + 2px left border `border-op-blue`. Inactive: `text-op-text-2` hovering to `text-op-blue-light`.

This is the template list/detail pages (e.g. a "Pipeline" or "Health" view) should adopt for their shell.

### 7.9 Event index / pipeline run row

The kit's event row pattern (date chip + title + meta line + CTA) is the direct analogue of a list item like a pipeline run. The date chip uses `bg-op-blue` text white (or `bg-op-blue-dark` for past entries).

### 7.10 Article grid

Three-column grid of cards, each with a top gradient strip (`from-op-blue to-op-blue-dark`) + category label + date + title + summary + read-more link. Useful for "example queries" or "saved views" UI.

### 7.11 Attribution bar (required, top of every page)

A thin bar at the **very top** of every page (above the §7.1 app header) crediting the data source. This is a **required** element on every route.

```html
<div class="bg-op-surface-2 border-b border-op-border">
  <div class="max-w-7xl mx-auto px-6 py-1.5 text-op-micro" style="color:var(--op-text-muted)">
    Built using
    <a href="https://openpulse.science" class="text-op-blue-light hover:text-op-blue transition-colors">openpulse.science</a>
    at <span class="mono">{BUILD_TIMESTAMP}</span>
  </div>
</div>
```

- `{BUILD_TIMESTAMP}` is injected at **build time** (ISO 8601 UTC, e.g. `2026-06-09T14:32Z`) — never computed in the browser, so it always reflects when the static site was generated. Inject it via your bundler's define/env mechanism or generate it into the HTML at build.
- Topmost element, full-width, on the elevated surface (`--op-surface-2`), muted text, mono timestamp, and the `openpulse.science` link in `--op-blue-light`. It sits directly above the §7.1 header.

### 7.12 Provenance disclosure — "How is this computed?" (required on data cards)

Every card that shows a number or chart derived from Open Pulse data carries the **same** compact disclosure — one shared component, never bespoke per-section explanations. Four fixed fields: *Source* (Neo4j / GraphDB (SPARQL) / GrimoireLab / GitHub API / Infoscience), *Method* (Graph crawler / git-metadata-extractor (LLM) / Classifier / CHAOSS metrics API / Direct query), *Refresh* (cadence), *Caveats* (honest limitations, e.g. "discipline inferred by classifier, may be wrong").

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

Styling: `border-top: 1px solid var(--op-border-subtle)`, 12px text; summary in `--op-text-faint` uppercase `tracking-wide`, hover `--op-blue-light`, no disclosure marker; the `<dl>` a two-column `max-content 1fr` grid with `dt` in 11px `--op-text-faint` uppercase and `dd` in 12px `--op-text-muted`. Reference implementation: `src/components/provenance.ts` in the ENAC dashboard ([sdsc-ordes/open-pulse-enac](https://github.com/sdsc-ordes/open-pulse-enac)).

---

## 8. Graph Explorer

A force-directed graph view is one of the reference layouts (full-page canvas). Since the whole site is dark, the canvas shares the same `--op-bg` and `--op-surface` tokens. Specifics:

- **Canvas surface** uses the page background `--op-bg` (`#0c0c12`) with a subtle dot grid (`radial-gradient(circle, #242438 1px, transparent 1px)` at `28px 28px`). Expose it as a `.dot-grid` utility in your global stylesheet.
- **Floating canvas overlays** (legend, hint strip) use a translucent dark card: `background: rgba(20,20,32,0.85); backdrop-filter: blur(10px); border: 1px solid var(--op-border)`. They follow the same `rounded-none` rule.
- **D3 link colour**: `var(--op-blue)` (`#5461a6`). Stored as a hex literal in drawing code since canvas/D3 can't read CSS variables.
- **Selection ring** around an active node: `var(--op-blue-light)` (`#8a94c9`) at 80% opacity.
- **Node fill colours** (Person/Repo/Commit/Org/PR): from the single `NODE_COLORS` map (§2.6) — never duplicate the hex table.

Chrome around the canvas (header, query sidebar, node-detail panel, timeline strip) uses the standard component patterns from §6.

---

## 9. Backgrounds, patterns, images

- **Page background**: flat `--op-bg` (`#0c0c12`).
- **Dot grid**: reserved for the graph canvas (`.dot-grid` utility). Don't sprinkle it elsewhere.
- **Hero / banner pattern**: optional dotted SVG/PNG pattern served from your static assets. Anchor `background-position: left center` or `right center`, never `center` — asymmetric placement is intentional. Layer over `--op-blue-dark` with `background-blend-mode: overlay` so the pattern remains visible but dim.
- **Overlay card on a pattern**: use `bg-op-surface/85 backdrop-blur-sm` content card to maintain contrast.
- **Gradients**: only `linear-gradient(135deg, #5461a6, #26245c)` for hero image surrogates / article-grid card tops. No multi-color rainbows anywhere else.

---

## 10. Adopting this system in a new app

When you scaffold `src/your-web/` (or restyle an existing app), apply the system in this order. Each step is a verifiable change you can confirm with a Playwright MCP screenshot (per the UI-verification rule in `AGENTS.md`).

1. **Tokens** — add the §2 palette as `--op-*` custom properties in your global stylesheet's `:root`. If using a utility framework, mirror them into its theme config too. These are the foundation; do them first.
2. **Fonts** — install the three font packages (§3.1) and import them at your app entry point. Set Switzer as the `body` default and Space Grotesk on `h1`–`h6`.
3. **Sharp corners** — ensure no `rounded-md/-lg/-xl` on chrome; only `rounded-none`, `rounded` (4px buttons/badges), and `rounded-full` (avatars/FAB).
4. **One accent, two blues** — every interactive element uses `--op-blue` / `--op-blue-light`. Status colours (`--op-success/-error/-warning`) appear **only** on badges and toasts. No chrome greens, no neon, no glow/drop-shadow chrome.
5. **Buttons** — uppercase text, `tracking-wide`, Switzer, `rounded-none`; variants per §6.2.
6. **Shell** — header (§7.1) + black footer with partner logos (§7.2) on every route. List/detail views use the content+sidebar layout (§7.8).
7. **Each surface** — build pages from the §6 components and §7 layout archetypes. Reach for the `〇 LABEL` block (§5) on every titled section.
8. **Graph/canvas views** — adopt the dark canvas + overlay rules in §8; keep node colours in the single `NODE_COLORS` map.

If you keep a separate design-doc file, treat **this skill as the source of truth** when they disagree.

---

## 11. Do / Don't

**Do**
- Use Space Grotesk for headings, Switzer for everything else.
- Use the `〇 LABEL` pattern for every titled section.
- Group related content into dark cards with sharp corners and a `--op-border` outline.
- Use brand blues for *every* interactive element. Status colors are only for status badges/toasts.
- Maintain WCAG-AA contrast on dark: prefer `--op-text` (`#f4f4fc`) or `--op-text-2` (`#c0c0dc`) for body. Avoid putting `--op-text-faint` on `--op-surface`.
- Apply a clear hover state to every interactive element (`--op-blue` → `--op-blue-mid` for surfaces, `--op-blue-light` → `--op-blue` for links).

**Don't**
- Don't mix font families beyond the three approved.
- Don't introduce arbitrary colors. If you need a new one, add it to §2 first.
- Don't use `rounded-md`/`-lg`/`-xl` for chrome.
- Don't add glow / neon / drop-shadow chrome — they're not SDSC.
- Don't make button text Title Case or lowercase. **UPPERCASE only.**
- Don't write raw hex in template markup. Use `var(--op-*)` or utility classes (canvas/SVG drawing is the only exception).
- Don't add a light-mode toggle. The UI is dark by design.

---

## 12. Quick reference card

| Need | Use |
|---|---|
| Page background | `bg-op-bg` (`#0c0c12`) |
| Card | `bg-op-surface border border-op-border rounded-none p-8` |
| Elevated card | `bg-op-surface-2 border border-op-border rounded-none` |
| Primary action | `bg-op-blue text-white hover:bg-op-blue-mid rounded-none uppercase px-6 py-3 tracking-wide` |
| Secondary action | `bg-transparent text-op-blue-light border-2 border-op-blue rounded-none uppercase px-6 py-3` |
| Heading | `h2` Space Grotesk 32px Bold `var(--op-text)` |
| Body | `p` Switzer 16px Regular `var(--op-text-2)` |
| Link | `text-op-blue-light hover:text-op-blue` |
| Section label | `〇 LABEL` `var(--op-text-muted)` uppercase 14px Switzer Medium |
| Banner (soft) | `bg-op-blue-pale` (`#1a1834`) |
| Banner (loud) | `bg-op-blue-dark` (`#26245c`) text-white |
| Footer | `bg-op-footer-bg` (`#000000`) + partner logos with `filter:brightness(0) invert(1)` |
| Sharp corners everywhere | `rounded-none` |
| Code / IDs | `.mono` (JetBrains Mono) |

---

**Maintained by:** SDSC pulseWebKit team. Update this file when the Figma kit changes or the dark-translation rule (§1) needs to flex.
**Last sync:** 2026-05-19 from Figma Make file `xFRPysbb2ni4RXyuT7dVqq` (UI Kit v2.1). Added full blue/semantic/surface scales, semantic→dark mapping table, Figma neutral surface scale (§2.5), and corrected font loading to `@carrot-kpi/switzer-font` npm package.
