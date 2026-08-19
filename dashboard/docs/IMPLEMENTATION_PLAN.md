# CRM Dashboard Implementation Plan

Status: approved for implementation

Target: `/home/swerky/dev/crm/dashboard`

API source: `/home/swerky/dev/crm/docs/openapi/*.openapi.json`

Visual direction: Quiet Ledger shell + Archival Index entity workspaces

## Outcome

Build an independent production-ready React dashboard for the current CRM API. Phase one includes authentication and working CRM surfaces for Leads, Deals, Properties, Accounts, Contacts, and Users. Payments are architecturally isolated for later work and are not visible in the product.

Do not modify the existing `frontend/` directory. Do not implement frontend behavior by inspecting Laravel code; the ApiDog OpenAPI exports are the contract.

## Definition of done

Phase one is complete only when:

- A permitted user can log in, refresh the application, be revalidated through `/user`, and log out.
- Every fully documented entity has a permission-aware list, detail, create, edit, and delete workflow.
- Tables use real pagination and only documented filters/sorts.
- All forms use generated contract types, Zod validation, accessible shadcn fields, and mapped server errors.
- Light, dark, responsive, keyboard, reduced-motion, and RTL smoke cases pass.
- Contract generation, linting, typechecking, tests, the production build, and browser tests pass.
- No screen contains fabricated data, placeholder analytics, or undocumented behavior.

## Phase 0 — Repair and validate the API contract

The frontend must not compensate for the following gaps with handwritten guesses.

### Cross-document fixes

- Add an HTTP bearer security scheme and apply it to protected operations instead of modeling `Authorization` as an ordinary optional parameter.
- Add reusable schemas for:
  - Laravel pagination `data`, `links`, and `meta`.
  - Validation errors and per-field messages.
  - Unauthorized, forbidden, not-found, and conflict responses.
  - Empty `204` responses.
- Document `page` and `per_page` on every paginated list. Add search, sort, or filter parameters only where the API actually supports them.
- Ensure all read-only properties are absent from request `required` arrays.
- Ensure every CRUD response has a concrete schema and correct status code.
- Keep exactly one `POST /{id}` update operation with `_method: "PUT"`; never add PUT or PATCH duplicates.
- Validate JSON syntax, all local `$ref` targets, operation IDs, method-spoofed updates, and example payloads.

### Auth.openapi.json

- Replace the Users list `200` example that currently contains an authentication exception.
- Define the paginated Users list response.
- Resolve the nested `user` request body shape and make create/update requirements unambiguous.
- Resolve `username` being both read-only and required during creation.
- Document the complete permission naming scheme used for route and action gating.
- Expose valid role choices through a documented endpoint or explicitly remove role editing from phase one.

### Contact.openapi.json

- Define list, create, show, and update responses for Accounts and Contacts.
- Remove read-only Contact `id` from create/update request requirements.
- Define pagination for both collections.

### Listing.openapi.json

- Remove read-only `created_at` from create/update requirements.
- Confirm the intended required/nullable behavior for `address`.
- Keep the documented property type and status enums canonical, including their current spelling.
- Define pagination query parameters.

### Marketing.openapi.json

- Correct Lead show so it returns a singular Lead rather than a paginated collection.
- Define store and update response wrappers and status codes.
- Define pagination query parameters.
- Do not add assigned-agent UI unless the Lead schema and mutation contract document it.

### Sales.openapi.json

- Resolve whether Deal creation requires an `agent_id`; the current schema does not document it.
- Align `closed_at` required/nullable/format behavior across create, update, and response schemas.
- Define pagination query parameters.
- Do not implement a pipeline board, server-side stage filters, or aggregate metrics until the contract supports them.

### Shared.openapi.json

- Move genuinely shared schemas here or remove the empty document. Do not leave it as a misleading source.

### Contract gate

Create:

```text
npm run api:validate
npm run api:generate
npm run api:check
```

`api:generate` produces one namespaced TypeScript paths file per OpenAPI document. `api:check` regenerates into a temporary location and fails if committed generated types drift. Generated files are never hand-edited.

## Phase 1 — Scaffold the React application

### Runtime stack

- React 19 and TypeScript with strict mode.
- Vite and `@vitejs/plugin-react`.
- React Router for lazy route modules and route-addressable inspectors/forms.
- Tailwind CSS v4 and `@tailwindcss/vite`.
- shadcn using Radix primitives and the Nova visual style.
- TanStack Query for server state and mutations.
- TanStack Table for domain-specific data grids.
- `openapi-typescript` and `openapi-fetch` for generated wire types and clients.
- React Hook Form, Zod, and `@hookform/resolvers` for forms.
- Lucide for icons and Sonner for non-blocking notifications.
- Self-hosted Inter Variable through `@fontsource-variable/inter`; do not introduce a runtime font CDN request.

### Test stack

- Vitest and Testing Library.
- MSW for typed API behavior in component/integration tests.
- Playwright for browser workflows.
- `axe-core` or `@axe-core/playwright` for accessibility checks.

### Initial directory shape

```text
dashboard/
├── AGENTS.md
├── PRODUCT.md
├── DESIGN.md
├── components.json
├── package.json
├── src/
│   ├── app/                 # providers, router, shell, route guards
│   ├── api/                 # generated paths, clients, errors, token store
│   ├── components/
│   │   ├── ui/              # shadcn-owned primitives
│   │   └── shared/          # product compositions
│   ├── config/              # navigation, routes, theme metadata, features
│   ├── features/            # auth, overview, leads, deals, properties, etc.
│   ├── hooks/
│   ├── lib/
│   ├── styles/              # global mappings and paper themes
│   ├── main.tsx
│   └── router.tsx
└── tests/
```

Feature folders contain API hooks, schemas, route pages, column definitions, forms, and tests for one domain. Generic business abstractions are prohibited until two real features need the same behavior.

## Phase 2 — Configure shadcn and the theme

Official references:

- [Vite installation](https://ui.shadcn.com/docs/installation/vite)
- [components.json](https://ui.shadcn.com/docs/components-json)
- [Theming](https://ui.shadcn.com/docs/theming)
- [Dashboard blocks](https://ui.shadcn.com/blocks?category=dashboard)
- [Sidebar](https://ui.shadcn.com/docs/components/base/sidebar)
- [Data tables](https://ui.shadcn.com/docs/components/base/data-table)
- [React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form)
- [Vite dark mode](https://ui.shadcn.com/docs/dark-mode/vite)
- [RTL](https://ui.shadcn.com/docs/rtl)

### Required components.json

Create this exact configuration after the Vite scaffold exists:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": false,
  "tsx": true,
  "rtl": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Validate the configuration against the live shadcn schema during implementation. If the current CLI changes a field, accept only the smallest schema-required adjustment and update this document in the same change.

### Primitive inventory

Install:

```text
alert
alert-dialog
avatar
badge
breadcrumb
button
checkbox
command
dropdown-menu
field
input
input-group
pagination
popover
select
separator
sheet
sidebar
skeleton
sonner
table
tabs
textarea
tooltip
```

Do not install Chart until a dashboard aggregate or time-series endpoint is documented. Do not install Dialog for routine CRUD; route-based details and forms are the default.

### Theme architecture

- `src/styles/globals.css` imports Tailwind, shadcn Tailwind utilities, animations, semantic mappings, and the theme files.
- `src/styles/themes/paper.css` owns the complete light and dark CSS variable values.
- `src/config/theme.ts` owns only theme IDs, default mode, storage key, density, and future preset registration. It must not duplicate raw colors.
- `ThemeProvider` applies the selected mode and preset class before the application renders, persists light/dark/system, and follows system changes.
- Map every shadcn semantic token, including sidebar, charts, ring, input, and destructive roles even when a component is not yet visible.
- Add explicit semantic status tokens for leads, deals, and properties rather than embedding Tailwind palette utilities in feature code.
- Default to light mode. Paper texture is CSS-only, extremely faint, limited to broad background surfaces, and disabled for print/high-contrast contexts.

`DESIGN.md` is normative. If implementation requires changing a token or component rule, update `DESIGN.md` with the code change.

## Phase 3 — API, authentication, and permissions

### API clients

- Read the host from `VITE_API_BASE_URL`, defaulting locally to `http://localhost:8000/api`.
- Create one typed OpenAPI client per exported domain because the documents currently define different server base paths.
- Use one request middleware to attach `Authorization: Bearer <token>`.
- Normalize only transport concerns: base URL, bearer header, JSON parsing, abort signals, and shared error objects.
- Never reshape a documented resource into a different frontend model unless a named view model has a clear UI-only purpose.
- Map Laravel `422` field messages into React Hook Form. Preserve undocumented error payloads as safe generic messages plus diagnostic context for development.

### TokenStore

- Define a small interface: `get`, `set`, `clear`, and `subscribe`.
- Implement it with `sessionStorage` for phase one.
- Keep auth consumers independent of storage so an HttpOnly-cookie contract can replace it later.

### Auth bootstrap

1. Read the stored token.
2. If absent, render public auth routes.
3. If present, call `GET /user`.
4. On success, cache the User and permissions.
5. On `401`, clear the token and redirect to Login while preserving the intended route.
6. On network/server failure, show a retryable session-check state; do not incorrectly log the user out.

### Permissions

- Navigation and route metadata declare required permissions.
- Create, edit, and delete actions declare their own required permissions.
- `403` renders an in-shell forbidden state with a safe navigation action.
- Hidden actions must also be protected at the route/action layer.
- Do not hardcode role-to-permission mappings.

## Phase 4 — Shell and shared product compositions

### Main shell

Adapt shadcn `dashboard-01` and `sidebar-07`:

- `SidebarProvider` wrapping a collapsible icon sidebar.
- `SidebarInset` for the primary document surface.
- Sticky header containing sidebar trigger, breadcrumbs, route-specific actions, theme toggle, and user menu.
- Sidebar footer containing the authenticated user and logout/security actions.
- Off-canvas sidebar on mobile through the shadcn Sidebar/Sheet behavior.

Navigation groups:

```text
Overview

Work
  Leads
  Deals
  Properties

Relationships
  Accounts
  Contacts

Administration
  Users

Settings
  Security
  Appearance
```

Render groups and items only when at least one permitted destination exists. Keep Payments registered behind a `false` feature flag and omit it from navigation and routing.

### Command palette

Phase one supports route navigation and permission-aware quick-create actions only. It must not claim global record search because no search endpoint is documented.

### Shared entity workspace

Every entity workspace follows the same shell without forcing every domain into the same table:

1. Breadcrumb, route title, concise description, and create action.
2. Toolbar with only documented search/filter behavior plus local column visibility.
3. Domain-specific TanStack Table with manual pagination.
4. Route-addressable selected record.
5. Desktop detail inspector occupying roughly one-third of the content width.
6. Mobile compact list and full-page detail route.
7. Row action menu with permission-aware view/edit/delete.
8. Route-based create/edit form.
9. Alert Dialog for final deletion confirmation.

Share table pagination, toolbar layout, responsive collection behavior, and inspector framing. Keep columns, filters, row actions, and empty-state copy inside each feature.

### Required states

Every list/detail/form implements:

- Initial loading skeleton.
- Empty state with the next permitted action.
- Retryable query failure.
- `401` session handling.
- `403` forbidden state.
- `404` record-not-found state.
- Field-level `422` validation.
- Pending mutation with duplicate-submit prevention.
- Mutation success with cache invalidation and toast.
- Delete conflict/failure without losing page context.
- Offline/reconnect feedback.

## Phase 5 — Route-by-route implementation

### Public auth routes

```text
/login
/forgot-password
/reset-password
```

- Use the restrained shadcn `login-03` composition without promotional artwork.
- Login collects the documented username and password.
- Forgot and reset forms use only documented inputs.
- Authenticated users visiting public auth routes return to Overview.

### Overview

```text
/
```

- Use Quiet Ledger hierarchy, not a card grid.
- Show a thin summary strip only for totals exposed through pagination metadata.
- Show compact entity previews labeled neutrally unless server ordering is documented.
- Provide permission-aware quick-create actions.
- Omit trends, charts, activity feeds, conversion rates, and “recent” claims until dedicated contracts exist.

### Leads

```text
/leads
/leads/new
/leads/:leadId
/leads/:leadId/edit
```

- Table fields: name, email/phone, status, source, city, and company when returned.
- Form fields: name, email, phone, status, city, address, company name, and source.
- Use documented status/source enum strings exactly.
- Do not display assignment or scoring without a contract.

### Deals

```text
/deals
/deals/new
/deals/:dealId
/deals/:dealId/edit
```

- Table fields: contact, property, status, value, deal value, commission rate, and closed date.
- Form fields follow the corrected Sales contract.
- Related contact/property selectors must use documented collection responses.
- Do not build Kanban, drag-and-drop, aggregate pipeline values, or assignment until supported.

### Properties

```text
/properties
/properties/new
/properties/:propertyId
/properties/:propertyId/edit
```

- Table fields: title, city, type, status, price, and owner only when returned.
- Form fields follow the corrected Listing contract.
- Preserve enum spellings from OpenAPI even when they appear unconventional.

### Accounts

```text
/accounts
/accounts/new
/accounts/:accountId
/accounts/:accountId/edit
```

- Table/detail fields: name, industry, phone, address, and created date when returned.
- Form fields: name, industry, phone, and address.

### Contacts

```text
/contacts
/contacts/new
/contacts/:contactId
/contacts/:contactId/edit
```

- Table/detail fields: name, title, account, email, phone, and created date when returned.
- Form fields: name, title, email, phone, and account ID.
- Account selection depends on a corrected typed Accounts list response.

### Users

```text
/users
/users/new
/users/:userId
/users/:userId/edit
```

- Table/detail fields: name, username, email, phone, roles, permissions, and created date.
- Creation/editing follows the corrected Auth contract.
- Role editing is excluded until valid role choices and permission rules are documented.
- Permissions are shown as readable capability groups, but their string values remain unchanged.

### Settings

```text
/settings/security
/settings/appearance
```

- Security uses the documented current/new password operation.
- Appearance offers light, dark, and system modes.
- Do not expose a runtime token editor; themes remain code-configured.

## Phase 6 — Testing and release gates

### Unit and component tests

- Theme mode initialization, persistence, and system changes.
- TokenStore behavior and auth bootstrap.
- `401`, `403`, `404`, and `422` error mapping.
- Navigation and action permission gates.
- Pagination synchronization with the URL.
- Each Zod schema and each form’s server-error mapping.
- Each table’s columns, empty state, loading state, and row actions.

### MSW integration tests

- Auth success, invalid credentials, session revalidation, transient session failure, and logout.
- List/detail/create/update/delete success per domain.
- Empty pagination, final page, failed mutation, stale detail, forbidden action, and validation errors.
- Method-spoofed updates send one POST request with `_method: "PUT"`.

### Playwright workflows

- Login, protected redirect, refresh, logout, and intended-route restoration.
- Responsive sidebar and keyboard navigation.
- One complete CRUD workflow per fully documented domain.
- Deep-link directly to a record inspector.
- Change password.
- Switch light/dark/system.
- Mobile record list and full-page detail.
- RTL smoke render for sidebar, inspector, popover, sheet, and pagination.

### Accessibility and visual checks

- WCAG 2.2 AA automated checks plus keyboard review.
- Visible focus and correct focus restoration for menus, sheets, and Alert Dialog.
- Screen-reader names for icon buttons and asynchronous result announcements.
- Reduced-motion behavior.
- Visual snapshots at 1440px, 1024px, 768px, and 390px.
- No page-level horizontal overflow, clipped portals, nested cards, fake data, or inaccessible muted text.

### Final commands

```text
npm run api:validate
npm run api:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

After the first complete implementation, re-run the Impeccable design-document scan. It should update `DESIGN.md` and add `.impeccable/design.json` only if the implemented tokens and components justify those changes; do not silently change the approved direction.
