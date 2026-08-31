# Plan — On-demand architecture-design page via archify + Codex

**Status:** ready for review. Archify CLI + IR contract confirmed from upstream
(`docs/contracts/archify-cli-research.md`). 5 open questions below.

## Goal

A single command a developer runs **locally, on demand** that:

1. Has **Codex** (`gpt-5.6-terra`, reasoning `high`) inspect the current repo and
   author/refresh an archify **architecture IR** (typed JSON).
2. Renders it with **archify** into one **self-contained interactive HTML page**.
3. Publishes that page so it is reachable at **`/docs/architecture/`** (dev + prod)
   and lives in the repo under **`docs/architecture/`**.

Explicitly **not**: no Husky hook, no `lint-staged` entry, no CI job, no Docker
build step. Generation never runs in automation — only when a human asks.

## How this differs from the Liam DB generator

| | Liam (DB schema) | Archify (architecture) |
|---|---|---|
| Trigger | pre-commit hook, gated on migration files + CI drift check | **manual `npm run` only** |
| Input | live Postgres → `pg_dump` | **Codex reading the repo** |
| Renderer output | Vite SPA (hashed assets, non-deterministic) | **one self-contained `.html`** |
| Committed | `schema.sql` + `schema.json`, **not** the SPA | **the IR JSON + the rendered `.html`** |
| Serving | SPA built into image at Docker-build time | plain static file already in `dashboard/public/` |

The single-file output is the reason we can commit the rendered page directly and
skip every build-time/CI moving part.

## Repo facts the design fits

- Tooling monorepo (`crm-repository-tooling`), Node ≥ 24, ESM `.mjs` quality
  scripts under `scripts/quality/` with shared helpers (`run.mjs`, `git-files.mjs`,
  `project-map.mjs`).
- Existing "generate an artifact into `dashboard/public/` and serve it" precedent:
  `dashboard/public/openapi.json` (built by `dashboard/scripts/generate-openapi.mjs`,
  `git add`ed in `scripts/quality/commit-check.mjs`). Archify's page follows the
  same shape, minus the hook wiring.
- Repo already **vendors agent skills** under `.agents/skills/<name>/` with an
  `agents/openai.yaml` per skill — Codex's native skill-discovery dir.
- Dashboard is a Vite SPA served by nginx; `dashboard/public/**` is copied
  verbatim into `dist/` and served from `/`. nginx `location / { try_files $uri
  $uri/ /index.html; }` serves a real `docs/architecture/index.html` directly.
- Dev gateway: `http://localhost:8080`. Prod: `https://crm.swerky.dev` (Cloudflare
  → Podman gateway).
- Host tooling present: `codex` 0.151.0 at `~/.local/bin/codex`, logged in;
  `~/.codex/config.toml` already sets `model = "gpt-5.6-terra"`,
  `model_reasoning_effort = "high"`.
- The system under diagram: React dashboard (Vite) · Laravel API (`crm-server/`,
  Postgres `crm`) · NestJS payment service (`payment-server/`, Postgres
  `payments`, TypeORM) · RabbitMQ between API and payments · Redis · nginx
  gateway · Cloudflare edge. ~10–12 primary nodes — within archify's "≤ 12" rule.

## Design

### 1. Vendor the archify skill

```
.agents/skills/archify/            # copied from tt-a1i/archify @ <pinned sha>
├── SKILL.md
├── bin/archify.mjs
├── schemas/ examples/ references/ …
└── agents/openai.yaml             # added to match repo convention
```

- Pinned to a specific upstream commit (recorded in `agents/openai.yaml` +
  `docs/contracts/archify-cli-research.md`), refreshed manually.
- Codex auto-discovers `.agents/skills/`; the generator prompt names the skill
  explicitly as a backstop.
- `node .agents/skills/archify/bin/archify.mjs doctor` run once at implementation
  time to confirm the vendored copy is self-sufficient (no `npm install` needed);
  if it needs deps, add a scoped `package.json` + `npm ci` in that dir and
  document it.

### 2. Committed artifacts

```
docs/architecture/
├── architecture.json     # archify IR, authored/refreshed by Codex
├── index.html            # rendered self-contained page  (also the served file)
└── README.md             # what it is, the dev+prod URLs, how to regenerate
```

Serving (see Q2): the rendered `index.html` is also placed at
`dashboard/public/docs/architecture/index.html` so Vite→nginx serves it.

| env | URL |
|---|---|
| dev | `http://localhost:8080/docs/architecture/` |
| prod | `https://crm.swerky.dev/docs/architecture/` |

### 3. Generator script: `scripts/quality/generate-architecture.mjs`

Run via `npm run docs:architecture` (root `package.json`). Steps:

1. Resolve repo root, current `git rev-parse HEAD` (for `meta.repository.revision`).
2. Build the Codex prompt (from a template file
   `scripts/quality/architecture/prompt.md`): "You have the `archify` skill. Read
   the repo. Refresh `docs/architecture/architecture.json` (architecture IR,
   `schema_version: 1`, `quality_profile: showcase`, `meta.repository` pinned to
   `<sha>`, ≤ 12 components, code-evidence `sources` on each component). Then run
   `node .agents/skills/archify/bin/archify.mjs validate architecture
   docs/architecture/architecture.json --quality showcase --json` and fix until it
   passes. Then `… deliver architecture docs/architecture/architecture.json
   docs/architecture/index.html --quality showcase --json`. Do not touch anything
   outside `docs/architecture/`."
3. Invoke:
   `codex exec --model gpt-5.6-terra -c model_reasoning_effort=high \
     --sandbox workspace-write --cd <repoRoot> -` (prompt on stdin).
   (Exact flags for non-interactive + write-in-workspace + approvals confirmed
   against `codex exec --help` at implementation time; `approvals_reviewer =
   "user"` in config means the script should pass an explicit
   non-interactive/full-auto flag — see Q3.)
4. After Codex exits: verify `docs/architecture/index.html` and
   `…/architecture.json` changed/exist; re-run `archify validate` from the script
   itself as an independent gate; fail loudly if invalid.
5. Copy `docs/architecture/index.html` →
   `dashboard/public/docs/architecture/index.html`.
6. Print the dev + prod URLs. **No `git add`** — the developer reviews and commits.

Flags: `--dry-run` (build prompt, don't call Codex), `SKIP_ARCHIFY` no-op guard
for parity with other scripts.

### 4. Integration points

| File | Change |
|---|---|
| `package.json` | `"docs:architecture": "node scripts/quality/generate-architecture.mjs"` |
| `scripts/quality/generate-architecture.mjs` | new — orchestrator |
| `scripts/quality/architecture/prompt.md` | new — Codex prompt template |
| `.agents/skills/archify/**` | new — vendored skill + `agents/openai.yaml` |
| `docs/architecture/{architecture.json,index.html,README.md}` | new — first real run, committed baseline |
| `dashboard/public/docs/architecture/index.html` | new — served copy (committed) |
| `scripts/quality/project-map.mjs` (+ `.test.mjs`) | classify `docs/architecture/**` and `.agents/skills/archify/**` under a `docs`/`dashboard` bucket so the existing project-scoping stays correct — **no new gate**, classification only |
| `README.md` | one line next to the openapi flow: "run `npm run docs:architecture` to refresh the architecture page" |
| `.gitignore` | nothing (all artifacts are committed) |

### 5. What stays out

- No `.husky/*`, no `lint-staged.config.mjs`, no `commit-check.mjs` /
  `push-check.mjs` / `check-projects.mjs` changes.
- No `.github/workflows/*` changes.
- No `docker/**` changes — the page is a normal committed file under
  `dashboard/public/`, already copied into the image by the existing
  `COPY --from=build /app/dist` step.

## Open questions

| # | Topic | Options |
|---|---|---|
| 1 | **Archify delivery** | **(a)** vendor the skill subtree at `.agents/skills/archify/` pinned to a sha (offline, reviewable, manual bumps). **(b)** `npx skills use tt-a1i/archify@archify` at run time (always latest, needs network, unpinned). Recommend **(a)**. |
| 2 | **Serve path** | **(a)** canonical file at `docs/architecture/index.html`, generator copies it to `dashboard/public/docs/architecture/index.html`, **both committed** (two copies of one file). **(b)** canonical file lives only at `dashboard/public/docs/architecture/index.html`; `docs/architecture/` holds just `architecture.json` + `README.md`. **(c)** add `docs/architecture` as an extra Vite `publicDir` / nginx alias so there is exactly one file and no copy. Recommend **(b)** — least duplication, still both "in `docs/architecture`-shaped" and served. |
| 3 | **Codex autonomy** | Your `~/.codex/config.toml` has `approvals_reviewer = "user"`. Should the generator run Codex **fully autonomous** (`--sandbox workspace-write` + full-auto/no approval prompts, since scope is fenced to `docs/architecture/`), or **interactive** (developer approves Codex's edits in the terminal as it goes)? Recommend **fully autonomous** with the write scope fenced. |
| 4 | **Diagram set** | Just the one `architecture` page now, or also seed a `workflow` (e.g. lead → deal → commission lifecycle) and/or `sequence` (payment round-trip via RabbitMQ) page under `docs/architecture/`? Recommend **architecture only**; add others later on request. |
| 5 | **Refresh discipline** | Purely "run it when you remember", or also a short `docs/architecture/README.md` note + a `README.md` mention telling contributors to re-run it after structural changes (services, queues, datastores)? Recommend **the README note** (cheap, no automation). |

## Implementation steps (after answers)

1. Vendor `.agents/skills/archify/` at a pinned sha; `archify doctor`; write
   `agents/openai.yaml`. Record the sha in the research doc.
2. Write `scripts/quality/architecture/prompt.md`.
3. Write `scripts/quality/generate-architecture.mjs` (`--dry-run` first).
4. `--dry-run` review of the assembled prompt.
5. Real run → Codex authors `architecture.json`, archify renders `index.html`.
   Eyeball the page at `http://localhost:8080/docs/architecture/` (or open the
   file directly).
6. Iterate the prompt until the IR is accurate (right services, boundaries,
   RabbitMQ/Redis/Cloudflare edges, code `sources`).
7. `project-map.mjs` + test classification.
8. `package.json` script + `README.md` line + `docs/architecture/README.md`.
9. Commit the baseline.

## Risks / mitigations

- **Codex drifts outside `docs/architecture/`** → run with a fenced write sandbox
  + the script diffs `git status` afterward and aborts/warns on out-of-scope
  changes.
- **archify vendored copy needs a build/deps step** → caught by `archify doctor`
  in step 1; fall back to a scoped `npm ci` in the skill dir, documented.
- **IR inaccuracy** (Codex guesses topology) → `sources` requirement forces
  code-evidence per node; human reviews the rendered page before commit.
- **Page goes stale** → accepted tradeoff of "on-demand only"; README note nudges
  contributors. A CI *staleness* check is explicitly out of scope per the request.
- **`gpt-5.6-terra` / effort not available to `codex exec`** → the script passes
  them explicitly and fails fast with a clear message; they are already the
  interactive defaults so this is expected to work.

## Follow-ups (not in this change)

- `archify compare` in CI to post an architecture-delta HTML on PRs that touch
  service topology (opt-in, later).
- Additional `workflow` / `sequence` / `dataflow` pages if Q4 is revisited.
