# Task: author the `<ENV>` software-architecture diagrams with archify

You have the **archify** skill vendored at `.agents/skills/archify/` (CLI:
`node .agents/skills/archify/bin/archify.mjs`). Archify is a deterministic
renderer — you author typed JSON IR, it compiles the HTML.

Produce three diagrams describing **this repository's `<ENV>` deployment**, from
current code evidence:

| IR file (you write) | type | rendered page (you deliver) | subject |
|---|---|---|---|
| `docs/architecture/<ENV>/architecture.json` | `architecture` | `docs/architecture/<ENV>/architecture.html` | services, datastores, message bus, edge, trust boundaries |
| `docs/architecture/<ENV>/workflow.json` | `workflow` | `docs/architecture/<ENV>/workflow.html` | lead → deal → commission lifecycle through the Laravel API |
| `docs/architecture/<ENV>/sequence.json` | `sequence` | `docs/architecture/<ENV>/sequence.html` | a payment round-trip: CRM API → RabbitMQ → payment service → result event |

## This run: `<ENV>`

- Deployment compose file: **`<COMPOSE>`**
- Public base URL: **`<BASE_URL>`**
- Read the matching nginx config: **`<NGINX>`**
- `<ENV_NOTES>`

The **workflow** and **sequence** diagrams are mostly env-independent (same
application code) — but use `<BASE_URL>` in any endpoint labels and reflect
`<ENV>`-specific replica/worker counts where relevant.

## Rules

- **Only touch files under `docs/architecture/<ENV>/`.** Nothing else.
- Read the schema + an example for each type before authoring:
  `.agents/skills/archify/schemas/<type>.schema.json` and
  `.agents/skills/archify/examples/*.<type>.json`. Schemas are
  `additionalProperties: false` — unknown keys fail.
- Ground every component/participant in real code. On architecture components set
  `sources` (1–3 × `{ path, line?, label? }`) pointing at the defining file
  (compose service, route file, service class, config, nginx conf, …).
- Every IR: `meta.quality_profile: "showcase"`, `meta.visual_preset: "editorial"`,
  `schema_version: 1` (workflow may use 2 if its example does), and
  `meta.repository` = `{ "url": "<REPO_URL>", "revision": "<REPO_SHA>" }`.
- Keep ≤ 12 primary nodes and one clear main path per diagram. Omit
  `meta.subtitle` and `meta.legend` unless a diagram is unreadable without them.

## Evidence to read first

- `README.md` "## Architecture" section — canonical topology.
- `<COMPOSE>` — service list, replica counts, ports, wiring for `<ENV>`.
- `<NGINX>` — gateway routing (`/api/`, `/api/v1/payments`, `/api/v1/invoices`, `/`).
- `crm-server/routes/api/**`, `crm-server/app/**` — Laravel endpoints, lead/deal/
  commission flow, RabbitMQ producer/consumer.
- `payment-server/src/**` — NestJS payment API, TypeORM data-source, RabbitMQ
  service, invoice module.

## Per-diagram procedure

1. Author the IR JSON under `docs/architecture/<ENV>/`.
2. `node .agents/skills/archify/bin/archify.mjs validate <type> docs/architecture/<ENV>/<file>.json --quality showcase --json`
   — for `architecture` add `--repo-root .`. Fix until `errors: 0`,
   `warnings: 0`, all checks pass. **Do not edit the IR after its final
   validation passes.**
3. `node .agents/skills/archify/bin/archify.mjs deliver <type> docs/architecture/<ENV>/<file>.json docs/architecture/<ENV>/<out>.html --quality showcase --json`
   — for `architecture` add `--repo-root .`.

Do all three, then stop — the calling script re-validates and publishes.
