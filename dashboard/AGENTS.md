# CRM Dashboard Agent Guide

This directory is the future React dashboard for the CRM. It is intentionally documentation-first: do not scaffold or implement from memory or from assumptions that are not recorded here.

## Read order

Before changing dashboard code, read these files in order:

1. [`PRODUCT.md`](./PRODUCT.md) — users, purpose, scope, and product principles.
2. [`DESIGN.md`](./DESIGN.md) — normative visual tokens and component behavior.
3. [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — architecture, route map, API blockers, phases, and acceptance criteria.
4. The six OpenAPI documents under [`../docs/openapi`](../docs/openapi) — the only frontend API contract.

The approved visual references are:

- [`docs/design-references/quiet-ledger.png`](./docs/design-references/quiet-ledger.png) for the application shell and overview hierarchy.
- [`docs/design-references/archival-index.png`](./docs/design-references/archival-index.png) for entity tables and route-driven detail inspectors.

The reference images communicate direction, not literal content. Do not copy their invented modules, labels, statistics, or data.

## Non-negotiable boundaries

- Build only inside `dashboard/`. Do not replace or modify the existing `frontend/` Vue experiment.
- Preserve unrelated worktree changes.
- Use `../docs/openapi/*.openapi.json` as the source of truth. Never infer a frontend field, enum, filter, permission, response wrapper, or endpoint from Laravel implementation files.
- If an OpenAPI operation is incomplete or contradictory, update the ApiDog export first or leave the dependent UI blocked. Do not hide contract uncertainty behind `any`.
- CRM updates use exactly one `POST /{id}` request containing `_method: "PUT"`. Do not add direct PUT/PATCH alternatives.
- Do not build Activity Logs until an Activity Log OpenAPI document exists in `../docs/openapi`.
- Payments are out of phase-one scope. Keep a disabled feature boundary for them, but do not show a fake Payments page or add payment models.
- Consult official shadcn documentation and blocks first. Use external dashboard references only when shadcn does not document the composition needed.
- Do not install every shadcn component. Add only the primitives listed in the implementation plan or required by an approved page.
- Never fabricate analytics, “recent” ordering, global search, pipeline aggregation, server filtering, or role choices.

## Locked implementation decisions

- React 19, TypeScript, Vite, React Router, Tailwind CSS v4, and shadcn with the `radix-nova` style.
- npm is the package manager.
- TanStack Query owns server state; TanStack Table owns data-grid behavior.
- OpenAPI TypeScript generation and `openapi-fetch` own wire types and requests.
- React Hook Form, Zod, and shadcn `Field` own forms and client validation.
- Auth uses the documented bearer token behind a `TokenStore`, initially backed by `sessionStorage`.
- English LTR ships first, but shadcn is initialized with RTL-safe generation and logical layout utilities.
- The default visual direction is Quiet Ledger plus Archival Index: flat paper-like surfaces, graphite text, thin rules, restrained blue, low radii, and almost no shadow.

## Expected verification

Once the app is scaffolded, every implementation handoff must report the results of:

```text
npm run api:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

If a command cannot run, state the exact blocker and what was verified instead.

