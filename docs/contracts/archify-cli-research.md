# Archify CLI + IR research

Researched 2026-08-30. Scope: the `tt-a1i/archify` repo (MIT), its `SKILL.md`,
`archify/schemas/*.schema.json`, and `archify/examples/*`. No archify package was
installed or run for this research.

## Decision summary

Archify is a **deterministic rendering engine, not an LLM**. An AI agent
(Claude / Codex / Cursor) authors a typed JSON **IR** describing the system; the
`archify` CLI compiles that IR into **one self-contained HTML file** (inline SVG
+ CSS + JS, no hashed asset directory). Because the output is a single file with
no external assets, it is safe to commit and serve directly — unlike the Liam
Vite SPA, which we chose not to commit.

For this repo: install archify as an **agent skill under `.agents/skills/archify/`**
(the repo already vendors agent skills there, and Codex auto-discovers
`.agents/skills/`). At generation time, `codex exec` reads the skill, inspects
the repo, writes/updates the IR JSON, then runs `archify validate` + `archify
deliver` to produce the page.

## 1. What archify is / install

- Repo: <https://github.com/tt-a1i/archify>, MIT. Node.js, ESM (`.mjs`).
- Entry point: `archify/bin/archify.mjs`.
- Positioned as an "agent skill" for Cursor / Claude Code / Codex CLI.
- Install options:
  - `npx skills add tt-a1i/archify -g` — global agent-skill install.
  - `npx skills use tt-a1i/archify@archify --agent codex` — one-shot trial, no install.
  - Manual: copy the `archify/` subtree into an agent skills dir.
- Skill discovery dirs by agent (from `README.md`):
  | Agent | Location |
  |---|---|
  | Claude Code | `~/.claude/skills/` or `.claude/skills/` |
  | Codex CLI | `~/.agents/skills/` or `.agents/skills/` |
  | opencode | `.opencode/skills/`, `.agents/skills/` |
- **No API keys / model config for archify itself** — it never calls an LLM.

## 2. CLI subcommands

From `archify/bin/archify.mjs` (per `README.md` + `SKILL.md`):

```bash
node archify/bin/archify.mjs doctor
node archify/bin/archify.mjs demo <out-dir>
node archify/bin/archify.mjs guide "<free-text prompt>"
node archify/bin/archify.mjs validate <type> <source.json> --quality <level> --json
node archify/bin/archify.mjs preview  <type> <source.json> <output.html> --quality <level> [--no-open]
node archify/bin/archify.mjs deliver  <type> <source.json> <output.html> --quality <level> [--open] [--json]
node archify/bin/archify.mjs visual-check <output.html> --json
node archify/bin/archify.mjs compare architecture <base.json> <head.json> <output-delta.html> --json
```

- `<type>` ∈ `architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`.
- `--quality` ∈ `showcase` (default for new diagrams; 9 artifact checks, 0
  composition errors, 0 warnings) and `standard` (dense maps, only on request).
- `deliver` "freezes" the candidate — per the skill, do not edit an IR file
  after its final validation passes.
- `--open` is an opt-in one-shot handoff; JSON is still emitted on stdout if the
  browser fails to open. For a headless/local script, omit `--open`.
- `compare` renders a semantic delta between two architecture IRs (useful later;
  not in the initial scope).

## 3. Intended agent workflow (from `SKILL.md`)

1. Identify the diagram type from the request.
2. Read the matching `schemas/<type>.schema.json` and `examples/*`.
3. Author the JSON IR **first**, before inspecting renderer internals.
4. `validate` after every edit.
5. `deliver` for final acceptance.
6. `visual-check` the delivered HTML.

Authoring constraints called out by the skill:

- Start with **≤ 12 primary nodes** and **one clear main path**.
- Omit `meta.visual_preset`, `meta.subtitle`, `meta.legend` by default.
- Set `meta.quality_profile: "showcase"` unless `standard` is requested.
- Desktop viewport check: `scrollWidth <= innerWidth` && `scrollHeight <=
  innerHeight` at 1440×900, 1600×1000, 1920×1080, 2048×1320.
- Codebase-accurate diagrams: "inspect repository evidence"; details deferred to
  `archify/references/authoring-contract.md` (read at implementation time).

## 4. Architecture IR schema (`schemas/architecture.schema.json`)

Draft 2020-12, `additionalProperties: false` **at every level** — unknown keys
are rejected.

Top-level required: `schema_version` (const `1`), `diagram_type` (const
`"architecture"`), `meta`, `components`. Optional: `layout`, `boundaries`,
`connections`, `cards`.

### `meta`

- Required: `title` (non-empty string).
- Optional: `locale` (`en` | `zh-CN`), `subtitle`, `output` (filename hint),
  `animation` (`trace` | `none`), `visual_preset`
  (`classic` | `signal-flow` | `blueprint` | `editorial`),
  `quality_profile` (`standard` | `showcase`),
  `engineering_profile` (`"deployment-ownership"`),
  `repository` (`{ url: https://github.com/<o>/<r>, revision: <40-hex sha> }` —
  both required if present; enables revision-pinned "evidence"),
  `views` (guided views, ≤ 5; each `{ id, label, focus: [componentId…], note? }`),
  `legend` (`{ mode: auto|all|hidden, entries: { frontend|backend|database|cloud|security|messagebus|external: { label?, visible? } } }`),
  `viewBox` (`[w>=320, h>=240]`).

### `layout` (optional)

`{ mode: "grid" (only value), origin?: [x,y], cols?: 1..12, gapX?, gapY?, cellW?>=40, cellH?>=24 }`.
If omitted, components need explicit `pos` + `size` (see the example).

### `components` (required, ≥ 1)

Each: required `id`, `type`, `label`.
- `type` ∈ `frontend`, `backend`, `database`, `cloud`, `security`, `messagebus`, `external`.
- Optional: `sublabel`, `tag`, `brand` (a brandmark string ≤ 80 chars / a URL /
  `{ url, sha256 }`), `sources` (1–3 × `{ path, line?, end_line?, label? }` —
  code-evidence links), grid placement `row` / `col`, or absolute `pos: [x,y]` +
  `size: [w,h]`.

### `boundaries` (optional)

Each: required `kind` (`region` | `security-group`), `label`, `wraps: [id…]` (≥ 1). Optional `pad`.

### `connections` (optional)

Each: required `from`, `to` (component ids). Optional `id`, `label`,
`variant` (`default` | `emphasis` | `security` | `dashed`),
`fromSide` / `toSide` (`left`|`right`|`top`|`bottom`), `via: [[x,y]…]` (manual
routing waypoints), `labelDy`.

### `cards` (optional)

Sidebar callouts: `[{ dot: <colour>, title, items: [string…] }]`.

### Reference example (`examples/web-app.architecture.json`, abridged)

```json
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": { "title": "Sample Web App", "output": "web-app-rendered.html", "quality_profile": "showcase",
    "views": [ { "id": "request-path", "label": "Primary request path", "focus": ["users","cdn","lb","api","db"], "note": "…" } ] },
  "components": [
    { "id": "users", "type": "external", "label": "Users", "sublabel": "Browser / Mobile", "pos": [40,300], "size": [120,60] },
    { "id": "api",   "type": "backend",  "label": "API Server", "sublabel": "FastAPI :8000", "pos": [670,300], "size": [130,60] },
    { "id": "db",    "type": "database", "label": "PostgreSQL", "sublabel": "primary :5432", "pos": [880,300], "size": [130,60] }
  ],
  "boundaries": [ { "kind": "region", "label": "AWS Region: us-west-2", "wraps": ["cdn","lb","api","cache","db"] } ],
  "connections": [ { "id": "lb-to-api", "from": "lb", "to": "api" }, { "id": "api-sql", "from": "api", "to": "db", "label": "SQL" } ],
  "cards": [ { "dot": "emerald", "title": "Application", "items": ["FastAPI behind an HTTPS load balancer"] } ]
}
```

## 5. Other diagram schemas (primary arrays)

| Type | Required arrays |
|---|---|
| `workflow` | `lanes`, `nodes`, `edges` (+ optional `phases`, `groups`, `mainPath`, `semanticChecks`) |
| `sequence` | `participants`, `segments`, `messages`, `activations` |
| `dataflow` | `stages`, `nodes`, `flows` |
| `lifecycle` | `lanes`, `states`, `transitions` |

All share the `schema_version` / `diagram_type` / `meta.title` requirement and
`additionalProperties: false`.

## 5b. Delivered-page URL params (read from the boot script of a delivered HTML)

The self-contained page's inline boot script honours query params:

| Param | Effect |
|---|---|
| `?theme=light` / `?theme=dark` | Forces the theme before first paint (else `localStorage['archify-theme']`, else `prefers-color-scheme`). |
| `?embed=1` | Sets `data-embed` — strips **all** archify chrome (toolbar, header, cards, node finder, semantic lens, guided views); leaves just the diagram. |
| `?present=1` | Sets `data-present` — "Presentation Stage" chrome/framing (no geometry change). |
| `?play` / `?view=` | Trace playback / guided-view deep links (from `meta.views`). |

`meta.visual_preset` (`classic|signal-flow|blueprint|editorial`) is an
**author-time** choice — the viewer runtime exposes no control to change it, so
authoring `"editorial"` locks it from the UI. The viewer shell in
`docs/architecture/index.html` uses `?theme=` and `?present=1` (not `?embed=1` —
it keeps archify's interactive UI).

## 6. Output format

- One **self-contained `.html`** — inline SVG diagram, CSS, JS. No `assets/`
  directory, no `schema.json` sidecar, no `serve.json` (contrast with Liam).
- Export menu inside the page offers PNG / WebM / 1200×630 share card
  (browser-side, not a CLI artifact).
- Safe to commit and to serve as a plain static file.

## 7. Determinism / committing

Not formally documented upstream, but **verified locally**: `archify deliver
architecture <ir>.json … --repo-root <root>` run twice on the same IR produced a
**byte-identical** HTML file (`diff -q` clean). No content-hashed asset dirs.
Committing the rendered `*.html` is therefore safe — a re-run only changes the
file when the IR changed. Generation here is on-demand + local only (never a CI
diff gate) so strict determinism is not even required; it's a bonus.

Note: an architecture IR that declares component `sources` **requires
`--repo-root <local checkout>`** on `validate` / `deliver` — archify verifies
each cited `path`/`line` against the working tree and errors
(`repository-evidence/root-required`) without it. `workflow` / `sequence` /
`dataflow` / `lifecycle` do not take `--repo-root`.

## 8. Practical recommendation for this repo

1. Vendor the skill at `.agents/skills/archify/` (pinned to a commit) so Codex
   discovers it and runs offline.
2. One `architecture` IR at `docs/architecture/architecture.json`, rendered to
   `docs/architecture/index.html`.
3. A generator script shells out to `codex exec` (model `gpt-5.6-terra`,
   reasoning `high` — already the local defaults) with a prompt that points at
   the skill, tells it to refresh the IR from current repo evidence, and to run
   `archify validate` then `archify deliver … --quality showcase`.
4. Serve by placing/copying the HTML under `dashboard/public/docs/architecture/`
   (Vite copies `public/` verbatim; nginx `try_files $uri $uri/` serves it at
   `/docs/architecture/`).
5. No hook, no CI job, no Docker build step invokes generation.
