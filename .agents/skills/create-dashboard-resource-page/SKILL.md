---
name: create-dashboard-resource-page
description: "Build or upgrade a complete CRM dashboard resource workspace from this repository's OpenAPI and generated TypeScript contracts, with deliberate visual hierarchy and production-quality UX. Use when asked to create, implement, finish, standardize, or bring an index/list page such as Deals, Contacts, Accounts, Properties, or another API resource up to the Leads standard: URL-driven filters, numbered pagination, on-demand row preview, create/edit forms, inline delete confirmation, permission-aware actions, and a dedicated details route. Also use when a route or generic ResourcePage already exists and must be upgraded rather than duplicated."
---

# Create Dashboard Resource Page

Build the requested resource as a complete, consumption-ready frontend workspace. Treat `dashboard/src/pages/leads-page.tsx` as the current interaction reference, but adapt fields, labels, filters, formatting, relationships, and domain visuals to the requested resource contract.

## Required reading

Before editing, read:

1. `dashboard/AGENTS.md` and every document in its required read order.
2. `references/resource-workspace-standard.md` in this skill.
3. The exact generated API and OpenAPI files discovered for the requested resource.
4. `dashboard/src/pages/leads-page.tsx`, `dashboard/src/App.tsx`, and any existing page or route for the resource.

Do not rely on remembered versions of these files.

## Boundaries

- Work only in `dashboard/` unless the user explicitly expands scope.
- Treat `docs/openapi/*.openapi.json` as the wire-contract source of truth and `dashboard/src/api/generated/*` as its generated type surface.
- Never inspect Laravel code to invent frontend fields, filters, enums, permissions, response wrappers, or operations.
- Never edit generated API files by hand. If OpenAPI changed and generated files are stale, use the repository generation command.
- Do not modify backend behavior while implementing this skill.
- Preserve unrelated worktree changes.
- Use existing dashboard primitives and the Quiet Ledger/Archival Index direction.
- Use a shadcn component as the first and primary implementation choice for every new UI pattern. Check the local shadcn primitives and official shadcn documentation before reaching for a native control or inventing a custom component.
- Mandatory form composition for requested changes: every standard create or edit input added or modified by this skill must use the shared block-start `InputGroup` pattern (`InputGroupAddon align="block-start"` with `bg-muted dark:bg-muted`) for its label. Do not use a standalone `FieldLabel` above an input, textarea, select, or relation picker. Media upload is the exception: render the shared media uploader directly as a full-width form item; never wrap it in `InputGroup`, `Field`, or a label shell solely to match standard inputs. Give the uploader an accessible name and self-contained drop guidance instead.
- Full-width form layout is mandatory for requested create/edit changes: the form root and its `FieldGroup` must use `w-full` and must not introduce a narrower `max-w-*` constraint. Preserve the standard responsive grid inside the full-width field group when appropriate.
- All date fields and date filters must use the shared shadcn date-picker composition built from the local Calendar, Popover, Button, and Input primitives. Never use native `input type="date"` or `input type="datetime-local"` in resource forms or filters. Represent paired date filters as one shadcn range picker with a single clearable range control.
- Do not copy Leads-only concepts such as social-source icons or lead statuses into an unrelated resource.

## Workflow

### 1. Discover the resource contract

From the repository root, run:

```bash
.agents/skills/create-dashboard-resource-page/scripts/discover-resource.sh <resource-or-model>
```

Then inspect the reported candidates directly. Establish:

- the domain-generated file and schema name;
- list, create, show, update, and delete operations that actually exist;
- endpoint paths and request methods;
- list pagination envelope and metadata;
- singular response wrapper names;
- query parameters supported by the list endpoint;
- required, optional, nullable, enum, relation, identifier, date, money, and display fields;
- documented authorization or permission requirements.

Run `npm run api:check` from `dashboard/`. If generated types are stale relative to valid OpenAPI, run `npm run api:generate`; do not patch generated files.

If a required operation or contract detail is missing, identify the exact gap. Do not conceal it with `any`, guessed fields, invented requests, or fake controls.

### 2. Audit the existing frontend surface

Search the route map, app shell navigation, page files, tests, and generic `ResourcePage` usage for the requested resource.

- If no page exists, create a dedicated resource page module.
- If a generic or incomplete route exists, replace that target with the complete dedicated workspace.
- If a dedicated page exists, preserve working domain-specific behavior and upgrade missing capabilities.
- Add one index route and one dedicated details route without duplicating routes.
- Remove only target-specific generic configuration that is no longer used.

Prefer a resource-specific page over enlarging `ResourcePage` into a brittle universal component. Extract shared helpers only when they are already repeated and remain domain-neutral.

### 3. Design from the contract

Select table columns, preview fields, detail sections, form controls, filters, badges, icons, and formatting from the resource schema and its business meaning.

- A complete filter experience is mandatory for every resource workspace. Always provide a useful global search plus every safe field-specific, enum, relation, date, and numeric filter supported by the resource fields, even when the OpenAPI list operation does not document query parameters. If a filter cannot be created safely from the available contract, ask the user explicitly before omitting it; do not silently ship an unfiltered index.

- Use generated schema types; do not use `any`.
- Build Zod validation from documented required fields, enums, formats, nullability, and constraints.
- Mark required form labels with `(required)`.
- Convert empty optional inputs to the contract's expected `null`, omitted value, or empty string.
- Use semantic, restrained colors for statuses and official brand colors only for actual brands.
- Format currency, dates, relations, and identifiers appropriately instead of stringifying objects.
- Keep all form controls visually flat on focus. Inputs, textareas, selects, comboboxes, and input groups must not add focus-visible borders, outlines, Tailwind ring utilities, or box-shadows; remove inherited global rules at the shared primitive instead of reintroducing local overrides.

Before implementing JSX, make an explicit information hierarchy for the index, preview, editor, and details page: identify the record identity, primary metric, decision-supporting metadata, and tertiary metadata. Give those tiers distinct typography, spacing, grouping, and color treatment. Do not render every field as an equal-weight vertical dump. Use the existing design system first; when a needed pattern is not established locally or the UX tradeoff is non-obvious, research reputable UX references online (for example, Nielsen Norman Group, Material Design, WAI-ARIA, Radix, or shadcn documentation) and apply the findings deliberately rather than copying a generic card pattern.

### 4. Implement the full workspace

Implement every applicable item in `references/resource-workspace-standard.md`.

Keep URL search parameters canonical for pagination, filters, selected record, and editor mode. Preserve unrelated query parameters when updating one state. Text inputs use a 500 ms debounce; selects update immediately.

Create-page copy and actions must stay deliberately minimal. Do not add a redundant secondary section heading, form subsection title/legend, or explanatory copy when the page title and field labels already establish the resource context. Do not add an eyebrow or subtitle to a create title unless the user explicitly requests it or the contract requires clarification. The primary create action label is exactly `Create` and has no leading icon; use a resource-specific label or icon only when the user explicitly requests one. Pending state may use `Creating…`.

Every standard create/edit input must keep its field identity in the block-start label surface. Reuse the local `InputGroup`, `InputGroupAddon`, `InputGroupText`, `InputGroupInput`, and `InputGroupTextarea` primitives, or the equivalent resource picker composition, with `align="block-start"` and `bg-muted dark:bg-muted`. This is required whenever a form is changed, including fields that already existed before the requested change. Dedicated media uploaders remain standalone, full-width components with their own accessible name and instructions; do not add an `InputGroup` or label wrapper around them.

Pagination is a mandatory shared UX metric for every paginated table. Reuse `dashboard/src/components/shared/resource-pagination.tsx` (or improve that shared component before adding a replacement). It must render a first-page control, previous/next controls, a last-page control, the current page and nearby page numbers, and ellipses for omitted ranges. Disable boundary controls at the first and last page, use server pagination metadata rather than row counts, preserve unrelated URL parameters, and close preview/editor state when changing pages. Migrate existing paginated tables when touching them; do not introduce a new Previous/Next-only pagination pattern.

Whenever a table, row preview, or dedicated details page displays a related resource, render its name as a link to that resource's dedicated `/resources/:id` details route. Stop row-preview propagation for inline relationship links, and add the destination details route when the resource currently only has a list page.

For Contact, User, or Agent references, use the shared `dashboard/src/components/shared/person-avatar.tsx` initials avatar wherever the person is displayed (table, preview, details, filters, or account chrome). Derive two initials from the first and last name; use a stable two-character fallback for a single-word name. Add compact semantic icons when they clarify a field, such as a location pin before city metadata or a currency icon prefix in money inputs, while keeping icons subtle, accessible, and non-decorative.

Send only documented query parameters to the API. If server-side filtering is absent from OpenAPI, keep the filter controls and URL state, implement them as clearly-labeled frontend filtering over the loaded records, and explain that scope in the UI until the backend contract is expanded. Never send undocumented filter parameters or silently omit the controls. A filter may be omitted only after explicitly asking the user and receiving approval to skip it.

### Reusable async relationship pickers

For searchable relation fields such as Lead or Account, reuse `dashboard/src/components/shared/searchable-resource-picker.tsx` instead of creating resource-specific picker markup. Its loader contract is `(query, page, signal) => { options, currentPage, lastPage }`.

- Debounce query requests by 500 ms, abort stale requests, reset to page 1 when the query changes, and append later pages rather than replacing the current options.
- Show a `Load more` button only while `currentPage < lastPage`; request the next page and keep the control at the end of the dropdown.
- Do not add a redundant resource/group heading inside the dropdown. The block-start input-group label is the field identity.
- Use a darker block-start label surface in both themes: `bg-muted dark:bg-muted`; keep the control itself transparent so the label/header remains visually distinct.
- Put optional field guidance inside the input group as an `InputGroupAddon` with `align="block-end"`, below the control and outside the option list.
- Keep selected options accessible by their primary label while allowing secondary metadata to remain visible in each option.

For updates, use exactly:

```ts
POST /{id}
{ "_method": "PUT", ...payload }
```

Do not add PUT or PATCH alternatives.

### 5. Verify behavior

Exercise the target workflow, not only compilation:

- opening and closing row preview;
- switching previewed records;
- active view/edit actions;
- editing, cancelling, and rolling back unsaved values;
- inline delete/cancel without selecting the row;
- create and update validation;
- filters, debounce, URL restoration, loading, empty results, and clearing;
- first, middle, ellipsis, and final pagination states;
- dedicated details route, invalid identifier, unavailable record, and back navigation;
- permission-hidden and forbidden states;
- light/dark contrast and responsive layout.
- visual hierarchy at narrow and wide widths: primary values are scannable, labels are clearly secondary, supporting text is muted, and preview sections are grouped by importance rather than stacked uniformly;
- a visual self-review of spacing, type scale, color contrast, icon alignment, truncation, and empty/loading/error states. If the result looks like a raw field dump, revise it before completion.

Run the dashboard verification commands required by `dashboard/AGENTS.md`. Fix failures caused by the target implementation. Report exact pre-existing or environment blockers instead of claiming success.

## Completion

Finish only when the requested resource has a dedicated index workspace and details page, supported CRUD actions are wired, filters and numbered pagination reflect the contract, state survives URL navigation, destructive actions are safe, permissions are respected, and verification results are reported.
