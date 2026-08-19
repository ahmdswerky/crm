---
name: convert-resource-preview-to-drawer
description: Convert exactly one existing CRM dashboard resource from an inline or split-page preview into a URL-addressable right-side overlay drawer, separate creation onto a dedicated create page, replace inline deletion with an AlertDialog popup, and route edit actions to edit mode on the resource's dedicated show page. Use when asked to migrate, standardize, or redesign preview behavior for Leads, Deals, Contacts, Accounts, Properties, Agents, Roles, or another dashboard resource one page at a time, including requests mentioning preview drawers, side overlays, popup delete confirmation, dedicated create pages, or show-page editing.
---

# Convert Resource Preview to Drawer

Migrate one resource per invocation. Preserve its domain UI and contract while changing the interaction architecture around preview, edit, and delete.

## Required reading

Before editing:

1. Read `dashboard/AGENTS.md` if it exists and follow its required read order.
2. Run `.agents/skills/convert-resource-preview-to-drawer/scripts/discover-preview-surface.sh <resource>` from the repository root.
3. Read `references/drawer-migration-standard.md` completely.
4. Read the target index page, dedicated details component, route declarations, focused tests, and the local `Sheet` and `AlertDialog` primitives.
5. Read the exact OpenAPI export and generated TypeScript types for the resource. Run `npm run api:check` from `dashboard/`.

Do not rely on remembered versions of these files.

## Boundaries

- Work on exactly one requested resource unless the user explicitly requests a bulk migration.
- Work only in `dashboard/` and this skill unless the user expands scope.
- Treat `docs/openapi/*.openapi.json` as the wire contract and generated types as the frontend type surface.
- Keep preview read-only. Never move the edit form into the drawer.
- Route edit from the row and drawer to `/<resources>/<id>?mode=edit`, preserving the index return context when the show page supports or needs it.
- If the show page cannot already edit in place, implement that capability before redirecting index edit actions to it. Stop and report a contract gap if update is unsupported.
- Use a popup `AlertDialog` for every delete entry point touched on the target resource. Remove inline row, card, drawer, and show-page confirmation states.
- Always separate creation from the index and preview drawer. Provide a dedicated create page at the resource's established create route (normally `/<resources>/create`) and make every New/Create entry point navigate to it with a real `Link` or route navigation. Do not leave create forms behind `mode=create` in the index or drawer. Preserve the existing typed form, payload, permissions, and return context while moving it; do not silently redesign creation.
- Preserve exact authorization. Deals remain editable only for a super admin, a user with `deal.update`, or the assigned agent.
- Never edit generated API files by hand or infer undocumented operations.
- Preserve unrelated worktree changes.

## Workflow

### 1. Produce a target-specific plan

Before code changes, record:

- current preview, create, edit, delete, URL, and loading behavior;
- index and show routes, supported operations, and permissions;
- whether the show page already supports `?mode=edit` and return context;
- whether a dedicated create route/page already exists and which New/Create links still target index `mode=create`;
- target files and tests;
- shared components to reuse, create, or deliberately avoid;
- migration order, edge cases, and verification commands.

If the user asks to approve the plan first, stop after presenting it. Otherwise continue.

### 2. Establish shared primitives

Prefer the shared components described in the reference:

- `dashboard/src/components/shared/resource-preview-drawer.tsx` for accessible Sheet chrome, sizing, scrolling, loading, and close behavior;
- `dashboard/src/components/shared/resource-delete-dialog.tsx` for controlled destructive confirmation, pending state, error display, and consistent copy structure.

Render the preview's close control inside its visible header, not through the Sheet primitive's fixed-position close button: it must never overlap the resource's Details, Edit, or Delete controls. For controlled delete dialogs, prevent automatic focus movement on open and do not add manual focus-restoration refs unless the product explicitly asks for that behavior.

Create a missing primitive during the first resource migration, then reuse it unchanged when it remains domain-neutral. Keep inspector content, permission rules, payloads, and domain consequences in the resource page. Do not build a generic field renderer or universal CRUD controller.

### 3. Move editing to the show page

Make the dedicated details page the only edit surface for an existing record:

- load the member endpoint independently;
- derive edit mode from `mode=edit`;
- render the resource-specific form in the details route;
- update with documented method spoofing when required;
- cancel by resetting server values and clearing only `mode`;
- save, refresh local details state, and return to read mode;
- preserve filters and pagination through an encoded `return` query when navigating from the index.

Redirect or canonicalize stale index URLs containing `record=<id>&mode=edit` to the show page. Redirect stale index URLs containing `mode=create` to the dedicated create page, preserving the index query as return context where supported. The index and drawer must not own create form state.

### 3.1 Move creation to the dedicated create page

Make the dedicated create route the only creation surface for the resource:

- use the existing create form and documented POST contract on `/<resources>/create` or the repository's established equivalent;
- reuse the existing dedicated details/edit component and typed form before creating any new page component; add a create route/mode to that surface when it can support the documented create flow;
- convert every New/Create button, empty-state CTA, and related create link into a route link/navigation to that page;
- preserve create permissions, validation, payload shape, success behavior, and a safe return-to-index context;
- remove index `mode=create` state, handlers, and inline/panel create JSX once the page works.

### 4. Replace the inline preview

Keep the list or card grid full width at every breakpoint. Drive the drawer from the existing `record=<id>` URL state:

- row/card click sets `record` and opens the right Sheet;
- direct URLs load the selected member and open the drawer;
- close, overlay click, Escape, and browser Back clear only preview state and retain filters/page;
- show loading, loaded, unavailable, forbidden, and error states inside the drawer;
- keep domain-specific hierarchy and relationship links in the inspector;
- expose Details, permission-gated Edit, and permission-gated Delete actions;
- never expose a create form or route create actions through the drawer; create belongs to the dedicated create-page link;
- ensure action and relationship clicks do not trigger row/card selection.

Do not leave preview JSX in the old grid column or let the table resize when the drawer opens.

#### Deal drawer information hierarchy

For Deals, the drawer must be backed by the authoritative member response rather than only the row object. Render the compact inspector in this order:

- contact, property, status, and action controls at the top;
- the property's returned media as a compact hero image with a thumbnail strip or explicit no-image state;
- a compact value block showing both `deal_value` and `value`, with commission moved into a footer row using a percentage icon and accessible commission text/amount;
- a separate assigned-agent card, not an inline sentence in the identity header.

Do not add explanatory copy such as “Deal economics” when the value labels and layout already communicate the relationship. The drawer has limited width: prioritize the record's people, property image, status, values, commission, and assigned agent over prose or duplicate metadata. Add a focused test that proves member media and the compact value/commission hierarchy render from the member response.

### 5. Replace delete confirmation

Use one controlled delete target for row/card, drawer, and show-page triggers where practical. Open the shared alert popup without changing preview selection.

- Identify the record in the title or description.
- State concrete consequences; avoid generic warnings when the resource has known relationship effects.
- Keep Cancel available and focus-safe.
- Disable controls and show a pending label while deleting.
- Keep the popup open and display the API error on failure.
- On success, close the popup, close the drawer only if it showed the deleted record, reload the valid list page, and navigate safely away from a deleted show page.

### 6. Verify the complete target flow

Add or update focused tests for:

- drawer open from row/card and direct URL;
- table/grid width remaining unchanged;
- close by explicit close, Escape, overlay, and history navigation;
- member loading/error states;
- row and drawer edit navigation to show-page `?mode=edit` with return context;
- New/Create navigation to the dedicated create page, including empty-state and stale `mode=create` URL handling;
- show-page edit load, cancel, validation, save, and permissions;
- delete popup from each target entry point, cancel, pending, failure, and success;
- event propagation, focus restoration, responsive width, and accessible dialog names;
- resource-specific authorization branches.

Run `npm run api:check`, focused tests, `npm run typecheck`, `npm run lint`, and `npm run build` from `dashboard/`. Report exact blockers separately.

## Completion

Finish only when the target index no longer shrinks for preview, creation exists only on the dedicated create page and every create link reaches it, existing-record editing exists only on the dedicated show page, deletion always asks in a popup, shared primitives are reused without swallowing domain logic, permissions are unchanged, URL/history behavior is stable, and focused verification is reported.
