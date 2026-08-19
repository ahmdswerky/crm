---
name: redesign-dashboard-show-page
description: Redesign or rebuild an existing CRM dashboard show/details page as a complete, action-oriented workspace grounded in OpenAPI and generated TypeScript contracts. Use when asked to study, organize, recreate, improve, polish, finish, or make actionable an existing model detail route such as `/deals/:id`, `/contacts/:id`, `/accounts/:id`, `/properties/:id`, `/agents/:id`, or `/leads/:id`; when a show page is a flat field dump, hides important data, redirects elsewhere to edit, lacks connected records or media, or needs better sales and operational UX.
---

# Redesign Dashboard Show Page

Turn an existing detail route into the best operational workspace its documented data supports. Adapt the hierarchy to the model; never copy Deal-specific fields into another domain.

## Required reading

Before planning or editing:

1. Read `dashboard/AGENTS.md` and every document in its required order.
2. Read `references/show-page-standard.md` in this skill completely.
3. Run `scripts/discover-show-page.sh <resource-or-model>` from the repository root.
4. Read the exact matching OpenAPI export and generated API file. Scan every current `docs/openapi/*.openapi.json` operation and schema for cross-domain relationships; do not rely on a remembered file count.
5. Read the current show page, its index/editor, `dashboard/src/App.tsx`, shared components, tests, and every existing page that receives a proposed relationship link.
6. Inspect the approved design references with an image-viewing tool and the current page in a browser when possible.

Run `npm run api:check` in `dashboard/` before treating generated types as current. Regenerate through the repository command when valid OpenAPI and generated files differ; never edit generated API files.

## Boundaries

- Work only in `dashboard/` unless the user explicitly expands scope. This skill may read only the documented frontend contracts to define frontend behavior.
- Treat `docs/openapi` as the wire-contract source of truth. Do not infer fields, enums, operations, response wrappers, filters, transitions, or permissions from Laravel.
- Preserve unrelated changes and existing authorization exactly. Record-specific rules must govern every visible quick action and editor entry point.
- Use the existing show route as the workspace. Do not send users to the index preview to edit.
- Use `POST /{id}` with `{ "_method": "PUT", ...changes }` for CRM updates. Do not add PUT/PATCH alternatives.
- Never fabricate activity, analytics, tasks, notes, communications, documents, stages, derived meanings, or related records.
- Do not change backend contracts while applying this skill. Report exact contract gaps and propose them separately.
- Include the shared Activity Logs component on every redesigned show page when the documented Activity Log contract supports that model. It must use the documented subject filter, permission gate, pagination, loading, empty, failure, and revert behavior; do not replace audit history with invented sales activity. If the Activity Log contract cannot support the model, report the exact blocker rather than silently omitting history.
- Apply a strict inclusion test to every section, field, and rail: it must enable a distinct operator decision, action, or error-recovery need that no nearby element already serves. Omit anything that does not pass.
- Give each fact one canonical display location. Do not repeat identity, contact details, relationship summaries, status, or field values in the header, main content, rail, and metadata. A second appearance is allowed only when it adds a distinct action or persistent context, and it must stay compact rather than reproducing the same field set.
- Do not add a generic Record metadata section. Show IDs and timestamps only when they are operationally meaningful for this model or required to explain an audit, calculation, or state; otherwise omit them.

## Choose the working mode

- If the user asks to study, plan, show the solution, show affected files, or approve the UI first: produce the relationship map, UX blueprint, contract gaps, affected files, and verification plan; stop for approval before edits.
- If the user asks to implement or redesign directly: state the compact scope in commentary, then complete the implementation and verification.
- If a missing user choice would materially change the result, recommend a default and ask once. Do not block on discoverable details.

## Workflow

### 1. Establish the page's job

Identify the primary operator, their state of mind, the decision they must make, and the action they repeat most. Write a one-sentence task statement before choosing layout.

For example, a Deal page helps an agent progress a sale and contact the buyer; a Property page helps staff evaluate and present inventory; a Contact page prioritizes reachability and relationship context. The model determines the workspace.

### 2. Build the connection map

Classify every candidate datum as:

1. Direct model field.
2. Embedded relationship.
3. Nested relationship.
4. Related endpoint that can be fetched from a documented identifier.
5. Media.
6. Activity or change history.
7. Safe derived value with an explicit formula.
8. Missing capability or ambiguous business meaning.

For each relationship, record its display label, target details route, required view permission, critical contact actions, empty state, and whether the show response already contains enough data. Prefer embedded data; do not add redundant requests.

Also inspect inverse relationships: when the current record's ID is a documented filter on a related collection, the related collection is a candidate for a concise, server-backed preview and a scoped “View all” handoff. For an Account, Contacts are a required candidate: when the Contacts collection supports an account filter and the user can view contacts, show a small action-oriented contact preview and link to `/contacts?account={accountId}`. Do not substitute a client-side filter or fetch an unbounded collection; if the filter or list response is undocumented, record the contract gap.

### 3. Research the interaction pattern

When layout or behavior is non-obvious, research two or three current authoritative references before deciding. Prefer official shadcn/Radix documentation, WAI-ARIA, Nielsen Norman Group, and official documentation for mature operational products such as Salesforce, HubSpot, or Pipedrive.

Extract the interaction principle, not the visual skin. Record why it fits this operator and contract. Do not copy invented fields or build generic CRM theater.

### 4. Define the information hierarchy

Write the hierarchy before JSX:

- Identity: what record is this?
- Workflow state: where is it now and what can the operator change quickly?
- Primary decision metric: the value or fact most relevant to the task.
- Critical action rail: what must remain reachable while scrolling?
- Main evidence: media, description, commercial facts, relationship context, or other decision support.
- History: what changed, by whom, and when?
- Optional metadata: only an identifier or timestamp that has an explicit operational use.

Activity history is a required part of this hierarchy whenever the documented Activity Log contract supports the model. Place the shared Activity Logs component after the page's primary evidence and before quiet metadata.

Remove filler copy. Section descriptions must explain a real limitation, calculation, empty state, or consequence; otherwise omit them.

Before JSX, make a content map with one canonical location for every fact. Remove any section whose contents are entirely repeated elsewhere. Keep a rail action-focused: it may preserve a phone/email action or a compact related-record link, but it must not mirror the main facts merely to fill space.

### 5. Design actions from the contract

- Turn a workflow enum into a one-click stage/status control only when it represents progression and the update operation accepts that field independently.
- Keep terminal outcomes visually distinct from sequential open stages when the domain supports that distinction.
- Show pending, saved, and failed states without pretending an update succeeded.
- Keep primary contact methods as `tel:` and `mailto:` links. Use a sticky desktop rail or mobile action bar only when those actions are truly critical.
- Render every permitted related name as a link to its existing details route. Show readable text instead of a link when the destination is unavailable or forbidden.
- For an Account's documented contacts relationship, surface concise avatar-led identity cards (name and role) with one clear button to open each Contact show page, then link to the Contacts workspace already scoped to that account. Keep phone/email out of these dense preview cards unless direct outreach is explicitly the page's primary task. Hide both preview and handoff when `contact.view` is unavailable.
- Keep destructive actions secondary and require contextual confirmation.

### 6. Make the show page editable

Use same-route editing:

- A top-level or section action switches displayed values into typed controls in place.
- Save and Cancel remain visible during long forms; Cancel restores the loaded server record.
- Successful save returns to read mode on the same route and refreshes the record.
- Map `422` errors to fields and preserve unsaved input on failure.
- Load relation options only from documented collection endpoints and only when permissions allow them. Never use raw foreign-key inputs as a fallback.
- If an editor can update the record but cannot load an association collection, keep that association read-only and explain the contract/permission limitation.

Quick workflow updates and the full editor may coexist, but they must share one mutation model and cache-refresh behavior.

### 7. Implement with the local system

- Use generated schema and operation types; never `any`.
- Use existing shadcn primitives and shared components before creating new ones.
- Prefer flat sections, rules, alignment, and whitespace over card grids. Avoid nested cards and same-weight label/value dumps.
- Reuse existing person avatars, media galleries, date pickers, currency formatters, errors, and tooltips where appropriate.
- Reuse the shared Activity Logs component for supported models; do not create a page-specific audit timeline.
- Load the member endpoint independently on route visit with abort handling, skeletons, refresh/retry, `403`, `404`, offline/network failure, and unavailable-relation states.
- Keep the URL stable and preserve return context. An optional `mode=edit` belongs on the details route, not the index route.
- Treat history as a separate documented resource. Do not wire it if its base URL, subject filter, response shape, or authorization is missing.

### 8. Verify the complete workflow

Exercise:

- Direct navigation, refresh, browser back, and preserved return path.
- Loading, `403`, `404`, request failure, empty media/relations, and long content.
- Read-only, record-owner, permission-granted, and super-admin action visibility where applicable.
- One-click workflow updates: pending, success, error rollback, rapid repeat prevention, keyboard use, and screen-reader announcement.
- Enter edit, change every supported field, cancel rollback, server validation, successful save, and failed save.
- Related links and contact protocols.
- Content-deduplication pass: every visible section has a distinct job; repeated facts are removed unless their second placement enables a distinct action or persistent context; IDs/timestamps have an explicit operational reason.
- Sticky behavior at wide widths and mobile action behavior without covered content.
- Light/dark contrast, visible focus, reduced motion, RTL-safe logical layout, and narrow/wide hierarchy.
- Form-control focus is an explicit exception: inputs, textareas, selects, comboboxes, and input groups stay free of focus-visible borders, outlines, rings, and box-shadows in both themes.

Run the verification matrix required by `dashboard/AGENTS.md`, including `npm run api:check`, lint, typecheck, focused tests, build, E2E, and `git diff --check`. Report existing environment blockers exactly.

## Completion

Finish only when the show route works as a self-contained operational page: its most important state and action appear early, critical contacts remain reachable, supported data and media are organized by purpose without duplicated sections or field dumps, the shared Activity Logs component appears for every supported model, editing stays on the route, related links respect permissions, metadata is present only when operationally useful, all required states exist, and unsupported product needs are clearly separated as contract gaps.
