# Plan — Architecture viewer shell (dev/prod × 3 diagrams)

## Context

The on-demand archify generator (`.claude/plans/archify-architecture-generator.md`,
already implemented) produces three standalone self-contained HTML diagrams
(`architecture` / `workflow` / `sequence`) served at `/docs/architecture/`. Two
gaps remain:

1. The three pages are separate URLs with no way to move between them.
2. Dev and production infrastructure genuinely differ (`docker-compose.dev.yml`
   exposes Telescope/Horizon, single replicas, `localhost:8080`;
   `docker-compose.yml` + Cloudflare runs ×2 replicas, Podman, `crm.swerky.dev`),
   but only one set of diagrams exists.

This change adds a hand-written **viewer shell** at `/docs/architecture/` with a
top toolbar (dev/prod · Architecture/Workflow/Sequence · theme · Present) that
frames the appropriate archify page, and doubles the generated set to **dev** and
**prod** variants. All pages stay fully public (open-source project).

## Outcome

`/docs/architecture/` → shell page. Toolbar:

- **[Dev | Prod]** segmented toggle — picks which diagram set to frame.
- **[Architecture | Workflow | Sequence]** segmented switcher.
- **Theme** button — dark ⇄ light, passed to the framed page via `?theme=`.
- **Present** button — reloads the frame with `?present=1` (archify Presentation
  Stage) and requests fullscreen on the iframe.
- Editorial visual preset is **authored into every IR** (`meta.visual_preset:
  "editorial"`); archify exposes no viewer control for preset, so it cannot be
  changed from the UI.

State (env + view + theme) persists in `localStorage` and is reflected in the URL
hash (`#prod/workflow`) so links are shareable. The six diagram pages remain
reachable standalone at `dev/<t>.html` / `prod/<t>.html`.

## Archify facts this relies on (verified in the delivered HTML)

- Boot script reads URL params: `?theme=light|dark` (forces theme before first
  paint), `?present=1` (sets `data-present` → Presentation Stage), `?embed=1`
  (sets `data-embed` → strips all archify chrome). Theme also persists in
  `localStorage['archify-theme']` (same origin as the shell).
- **Not using `?embed=1`** — it hides the cards, node finder, semantic lens and
  guided views, which are worth keeping. The shell toolbar sits above the iframe;
  archify's own toolbar stays inside it.
- `meta.visual_preset` enum: `classic | signal-flow | blueprint | editorial`.
- Architecture IR with component `sources` requires `--repo-root <checkout>` on
  `validate` / `deliver`; the other four types do not.
- `deliver` output is byte-identical on re-run of an unchanged IR.

## File layout

```
docs/architecture/
├── index.html            # NEW — hand-written viewer shell (committed, not generated)
├── README.md             # updated: shell URL + the 6 standalone URLs
├── dev/
│   ├── architecture.json workflow.json sequence.json      # archify IR (Codex, --env dev)
│   └── architecture.html workflow.html sequence.html      # rendered
└── prod/
    └── (same six files, --env prod)

dashboard/public/docs/architecture/   # generator mirrors the whole tree here (served)
```

The current flat `architecture.json` / `index.html` / `workflow.*` / `sequence.*`
are removed (superseded by `dev/` + `prod/` + the shell).

## Changes

### 1. `docs/architecture/index.html` — the shell (new, ~150 lines, no deps)

- Fixed toolbar + `<iframe>` filling the rest (`height: 100dvh` flex column).
- Vanilla JS. `frameSrc = ${env}/${view}.html?theme=${theme}${present ? '&present=1' : ''}`.
- Theme: default from `prefers-color-scheme`, toggle overrides, persisted under a
  shell-owned key (`crm-arch-view`); every read/write wrapped in try/catch
  (`ponytail:` per-viewer convenience only).
- Also writes `localStorage['archify-theme']` so a viewer who opens a standalone
  page next keeps the theme.
- Hash routing: `#<env>/<view>` parsed on load and `hashchange`; toolbar updates
  it. Unknown/missing hash → `#prod/architecture`.
- Present: set `present` flag → reload frame → `iframe.requestFullscreen()`.
  Exiting fullscreen clears the flag.
- Shell is theme-aware itself: light palette on `:root`, dark under
  `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`.

### 2. `scripts/quality/architecture/prompt.md` — per-env prompt

Parameterise the existing template with `<ENV>` (`dev` | `prod`), `<COMPOSE>`
(`docker-compose.dev.yml` | `docker-compose.yml`), `<BASE_URL>`
(`http://localhost:8080` | `https://crm.swerky.dev`). Instruct Codex to:

- Write the three IR under `docs/architecture/<ENV>/`.
- Read `<COMPOSE>` (plus `docker/nginx/nginx.dev.conf` vs `nginx.conf`, and for
  prod `docker/nginx/vps-site.example.conf` + Cloudflare notes in `README.md`).
- Reflect env-specific reality: replica counts, exposed Telescope/Horizon (dev
  only), edge (Cloudflare → Podman gateway for prod), hostnames/ports from
  `<BASE_URL>`.
- Set `meta.visual_preset: "editorial"` and `meta.quality_profile: "showcase"` on
  all three; `meta.repository` pinned to the current SHA.
- Fence: only touch `docs/architecture/<ENV>/`.

### 3. `scripts/quality/generate-architecture.mjs`

- `const envs = ['dev', 'prod']`; loop: assemble the per-env prompt, run
  `codex exec … -` once per env (two runs — keeps each Codex context small and
  independently restartable).
- Fence check per run: nothing modified outside `docs/architecture/<env>/`.
- Re-validate all six IR (`--repo-root` for the two `architecture.json`).
- Copy the whole `docs/architecture/` tree (shell + `dev/` + `prod/`) into
  `dashboard/public/docs/architecture/`.
- Flags unchanged: `--dry-run`, `--publish-only`, `SKIP_ARCHIFY=1`. Add
  `--env dev|prod` to regenerate just one set.
- Final message lists the shell URL (dev + prod) and notes the standalone paths.

### 4. `docs/architecture/README.md` + root `README.md`

- README table: shell at `/docs/architecture/`, plus the six standalone URLs.
- Root README architecture paragraph already points at `/docs/architecture/`;
  reword to "an interactive dev/prod viewer".

### 5. `.agents/skills/archify/**`

No change — already vendored, `doctor` green, zero-install.

## Out of scope / deliberately skipped

- No build-time or CI generation — still local-only `npm run docs:architecture`.
- No `project-map.mjs` change (editing `scripts/quality/**` already triggers all
  project checks).
- No archify source patching — the shell only uses documented URL params.
- Shell is not generated by Codex (fixed UI, not repo-derived); it's committed
  and only *copied* by the generator.

## Verification

1. `npm run docs:architecture -- --dry-run` — inspect both assembled prompts
   (dev + prod) for correct compose file / base URL.
2. `npm run docs:architecture` — two Codex runs; confirm six IR + six HTML under
   `docs/architecture/{dev,prod}/`, each `validate` showcase-clean, only
   `docs/architecture/**` dirty in `git status`.
3. `npm run docs:architecture -- --publish-only` — re-copies tree; confirm
   `dashboard/public/docs/architecture/` mirrors (shell + both env dirs).
4. Serve locally: `npx serve dashboard/public` (or the dev stack) →
   open `/docs/architecture/`:
   - Dev/Prod toggle swaps the framed diagram (verify prod shows ×2 replicas +
     Cloudflare, dev shows Telescope/Horizon).
   - A/W/S switcher changes the diagram.
   - Theme button flips the framed page light/dark.
   - Present enters fullscreen + presentation chrome; Esc restores.
   - Reload on `#prod/sequence` restores that state.
5. `cd dashboard && npm run build` — confirm `dist/docs/architecture/**` present
   (Vite copies `public/` verbatim; nginx `try_files $uri $uri/` serves it).
6. Re-run `npm run docs:architecture` on an unchanged tree → `git diff` shows no
   churn (byte-identical re-render).
