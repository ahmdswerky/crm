# Architecture viewer

Interactive system diagrams rendered by [archify](https://github.com/tt-a1i/archify)
(vendored at `.agents/skills/archify/`), wrapped in a small viewer shell.

- **Viewer:** `index.html` — a hand-written shell (no build step). Toolbar:
  **Dev / Prod** environment toggle, **Architecture / Workflow / Sequence**
  switcher, light/dark theme, and **Present** (fullscreen presentation mode).
  State is kept in the URL hash (`#prod/workflow`) so links are shareable.
- **Diagrams:** `dev/` and `prod/` each hold three archify IR files (`*.json`,
  the source of truth) and their rendered pages (`*.html`). The `dev` set is
  drawn from `docker-compose.dev.yml`; the `prod` set from `docker-compose.yml`
  + the Cloudflare/Podman edge. The `editorial` visual preset is authored into
  every IR.

| URL | Page |
|---|---|
| `/docs/architecture/` | Viewer shell (defaults to `#prod/architecture`) |
| `/docs/architecture/dev/architecture.html` | Dev system architecture |
| `/docs/architecture/dev/workflow.html` | Dev lead → deal → commission workflow |
| `/docs/architecture/dev/sequence.html` | Dev payment round-trip sequence |
| `/docs/architecture/prod/architecture.html` | Prod system architecture |
| `/docs/architecture/prod/workflow.html` | Prod lead → deal → commission workflow |
| `/docs/architecture/prod/sequence.html` | Prod payment round-trip sequence |

Dev host: `http://localhost:8080`. Prod host: `https://crm.swerky.dev`.

A copy of everything except this README also lives in
`dashboard/public/docs/architecture/` — that copy is what nginx serves; the
generator keeps it in sync.

## Regenerate (on demand, local only)

```sh
npm run docs:architecture              # both environments (one Codex pass each)
npm run docs:architecture -- --env dev # just the dev set
```

This has Codex (`gpt-5.6-terra`, reasoning `high`) re-derive the IR from current
repo evidence, re-render the pages, and refresh the served copies. It is **not**
run by any git hook or CI job — run it yourself after a structural change (a new
service, datastore, queue, or a reworked lead/deal/payment flow), review the
diff, and commit.

`npm run docs:architecture -- --dry-run` prints the Codex prompts without calling
them. `-- --publish-only` re-validates and re-copies the existing tree.
