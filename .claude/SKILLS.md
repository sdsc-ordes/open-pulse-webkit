# SKILLS.md — Agent task reference

Concrete how-to guides for the most common tasks agents perform on this repo. Companion to `CLAUDE.md`.

These recipes are **framework-neutral** — the web app in `src/your-web/` can be built with any stack. Where a step depends on your framework (routing, components), adapt the idea to your tooling; the *structure* is what matters.

---

## 1. Add a data endpoint (server proxy → client)

Open Pulse credentials must stay server-side, so data flows: **store/skill → your server endpoint → typed client → UI**. The browser only talks to your own endpoint.

**Step 1 — server endpoint.** Add a server-side route/function (your framework's server route, a serverless function, or a small API) that reads credentials from `.env`, queries the relevant Open Pulse store (mirror what the `query-*` skill does), and returns JSON. Never expose credentials to the client.

**Step 2 — type the response.** Define the response shape in one shared types module and treat it as the source of truth:

```ts
export interface MyNewResponse {
  field: string;
  count: number;
}
```

**Step 3 — client method.** Add a typed method to your API client that fetches from the endpoint:

```ts
myFeature: {
  list: () => get<MyNewResponse>('/my-feature')
}
```

**Step 4 — use it** in a view, rendering with the design system (see §5). Handle loading/error states.

> For local development without the live backend, you can serve static JSON fixtures from the same endpoint shape, then swap to the real proxy later.

---

## 2. Add a new page

1. Create the route in `src/your-web/` using your framework's routing convention.
2. Wrap it in the shared app shell: the **required attribution bar** (§7.11, `Built using openpulse.science at <build timestamp>`) at the very top, then the header (§7.1) and footer (§7.2) from the `frontend-dev` skill; list/detail pages use the content+sidebar layout (§7.8).
3. Use the design system: `〇 LABEL` section blocks (§5), cards/tables/badges (§6), `--op-*` tokens only.
4. Add a nav entry to the header, following the existing active-link highlight pattern.
5. Wire up data using the pattern in §1 if the page needs it.

---

## 3. Add a graph example query

Graph example queries are framework-neutral data objects. Each has:

```ts
{
  id: 'unique-id',
  title: 'Human title',
  description: 'One-line description shown in sidebar',
  cypher: 'MATCH (n) RETURN n LIMIT 25',
  result: {
    nodes: [ { id: 'n1', label: 'Person', properties: { name: 'Alice' } } ],
    edges: [ { source: 'n1', target: 'n2', type: 'KNOWS', timestamp: '2026-03-01' } ]
  }
}
```

Rules:
- `id` must be unique across all queries
- `label` must be one of: `'Repository' | 'Person' | 'Commit' | 'Organisation' | 'PullRequest'`
- Edges without a `timestamp` are always visible; edges with one appear when `currentDate ≥ timestamp`
- Node colors are determined by `label` — see the `frontend-dev` skill §2.6 node-color table (kept in a single `NODE_COLORS` map)

---

## 4. Add a new design token

When the design requires a colour or value that isn't in the token set:

1. **Global stylesheet `:root`** — add the CSS custom property:
   ```css
   --op-<name>: <hex>;
   ```
2. **Utility framework theme config** (only if you use one, e.g. Tailwind v4 `@theme`) — mirror it so utilities like `bg-op-<name>` generate:
   ```css
   --color-op-<name>: <hex>;
   ```
3. **`frontend-dev` skill §2** — add a row to the token reference table.

Keep the two definitions (if you have both) in sync.

---

## 5. Write a card / table / badge

Always copy the exact markup from the `frontend-dev` skill §6 component patterns rather than inventing new markup. Adapt the HTML to your framework's component syntax, but keep classes, tokens, and structure. Key patterns:

**Card:** `bg-op-surface border border-op-border rounded-none p-8`

**Status badge (succeeded):** `color:var(--op-success); background:rgba(74,222,128,0.12)`, `rounded-none`, uppercase, `tracking-wide`

**Section label (`〇 LABEL`):** `var(--op-text-muted)`, 14px Switzer Medium, uppercase, `tracking-wide`

See §6.1–§6.7 and §5 of the skill for the full markup.

---

## 6. Fix a type error

- If you use TypeScript, keep all API response shapes in one shared types module — check there first.
- Regenerate any framework-generated types after adding routes (run your framework's sync/codegen step).
- For build-time env vars, declare them in your build config and provide a fallback inline.
- Give explicit generic types to reactive/state primitives when the initial value is `null`, to prevent inference failures.

---

## 7. Debug a force-directed graph

This is framework-neutral D3 guidance for the graph view:

- Re-run the simulation whenever the `nodes` or `edges` inputs change.
- Node entry animation: new nodes get a random radial offset and animate to their simulated position via a spring (`alpha` decay).
- If nodes spawn at (0, 0) — the simulation hasn't warmed up yet; ensure the graph is built inside a `requestAnimationFrame`.
- A `currentDate` value controls visibility; do the timestamp filtering **before** passing data to the graph component, not inside it.
- D3 color constants must match the `NODE_COLORS` map (single source — `frontend-dev` skill §2.6). Canvas/D3 can't read CSS variables, so these are hex literals there.

---

## 8. Run checks locally

Run whatever type-check / lint / build your chosen stack provides, from `src/your-web/`, before pushing — CI runs the same and will fail the build on errors. A passing build is a correctness gate, not a feature-correctness gate: still verify UI in the browser via Playwright MCP (see `CLAUDE.md`).

Separately, the agent-config sync is its own gate: after editing anything in `.claude/`, run `node tools/sync-agents.mjs` so `.agents/` + `AGENTS.md` stay in sync (CI `agents-sync` job enforces it).
