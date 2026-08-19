# Resource Preview Drawer Migration Standard

Use this as the implementation and review checklist for one resource migration.

## Contents

1. Outcome and scope
2. Current CRM baseline
3. Target interaction model
4. Shared component architecture
5. State and routing contract
6. Migration sequence
7. Accessibility and responsive behavior
8. Resource-specific rules
9. Test matrix
10. Definition of done

## 1. Outcome and scope

The index remains a stable, full-width browsing surface. Selecting a record overlays a read-only inspector from the right. Editing moves to the record's dedicated show route. Every destructive action opens a confirmation popup.

This migration changes interaction placement, not domain capability. Preserve API calls, forms, filters, pagination, formatting, relationships, loading behavior, and permissions unless a small change is required to support the target routing.

Creation is part of the routing cleanup. If create and edit share an old panel, move creation to a dedicated create page at the resource's established create route (normally `/<resources>/create`) and separate its state and JSX from the index and drawer. Every New/Create link must navigate to that page. Preserve the existing typed form, create contract, permissions, validation, and return context; do not keep creation behind index `mode=create`.

## 2. Current CRM baseline

Revalidate this inventory before each migration because it can drift.

| Resource | Current index behavior | Current show-page edit | Current deletion |
| --- | --- | --- | --- |
| Leads | Split preview/create/edit panel | Historically redirects edit back to the index | Historically inline on index |
| Contacts | Split preview/create/edit panel | Same-route `?mode=edit` with return context | Popup on show, historically inline on index |
| Accounts | Split preview/create/edit panel | Same-route `?mode=edit` | Popup on show, historically inline on index |
| Deals | Split preview/create/edit panel | Same-route `?mode=edit` with per-record authorization | Popup on show, historically inline on index |
| Properties | Card grid plus split preview/create/edit panel | Same-route `?mode=edit` with return context | Historically inline on index and show |
| Agents | Split preview/create/edit panel | Historically redirects edit back to the index | Historically inline on index and show |
| Roles | Permanent editor split, not a read-only preview | Generic details route | Popup in editor |

Roles is not an automatic preview conversion. If requested, first decide whether the intended product behavior is a read-only role drawer plus show-page editor or only removal of the permanent split editor.

### Recommended rollout order

Each item is a separate skill invocation and a separately verified diff:

1. **Contacts** — establish the shared drawer and delete dialog against an existing same-route editor and return-context pattern.
2. **Accounts** — reuse the primitives and add complete return-context handling if it is still absent.
3. **Deals** — prove the shared architecture under the resource-specific owner/permission/super-admin edit rule.
4. **Properties** — adapt the same interaction to a keyboard-operable card grid, gallery content, and property update constraints.
5. **Leads** — first move editing into the show page, then remove index editing and add the drawer.
6. **Agents** — first move editing into the show page, then preserve super-admin role controls and self/super-admin delete restrictions through the migration.
7. **Roles** — handle only after an explicit role-specific decision because its split pane is an editor, not a preview.

This order minimizes risk, but the user may request any resource first. Never partially migrate a second resource merely to keep the visual behavior consistent.

## 3. Target interaction model

### Index browsing

- The list/card grid occupies the same width before and after selection.
- A row/card click sets `record=<id>` and opens the right drawer.
- The drawer overlays content with a restrained backdrop; it does not reserve layout width.
- The selected row/card may remain visually marked behind the overlay.
- Row/card Details remains a direct link to the show page.
- Row/card Edit navigates directly to show-page edit mode.
- New/Create links navigate directly to the dedicated create page.
- Row/card Delete opens the alert popup and must not open or change the drawer.

### Drawer

- Treat the drawer as a modal dialog using the local Sheet primitive.
- Make it read-only and optimized for scanning.
- Load the selected member endpoint when list data is incomplete.
- Keep the resource inspector domain-specific.
- Put Details, Edit, and Delete in a predictable action area.
- Allow close by the close button, Escape, backdrop, and browser Back.
- On close, clear `record` while retaining page and filters.

### Edit

- Use `/<resources>/<id>?mode=edit` on the dedicated show page.
- Add `return=<encoded index query>` when needed so Back/Cancel can restore pagination and filters.
- Do not retain an existing-record edit form on the index or in the drawer.
- If the show page lacks editing, move or adapt the existing typed form there before rewiring buttons.
- Keep existing update payload rules, server validation mapping, and method spoofing.

### Create

- Use the dedicated `/<resources>/create` route or the repository's established equivalent, rendered by the existing resource details/edit surface when one exists.
- The create page is the only create surface; the index and preview drawer must not render create forms.
- Convert header buttons, empty-state CTAs, related create links, and stale `mode=create` URLs to that page.
- Preserve the existing create form, POST payload, permission gate, validation, success behavior, and return-to-index context.

### Delete

- Every target delete button opens an AlertDialog popup.
- One dialog can serve row/card and drawer targets on the index.
- The show page can reuse the shared dialog with its loaded record.
- Deleting never begins on the first click.
- Failure stays in context and does not close the dialog.

## 4. Shared component architecture

### `ResourcePreviewDrawer`

The shared component should own only interaction chrome:

- controlled `open` and `onOpenChange`;
- right-side Sheet placement;
- accessible Sheet title and description;
- responsive width and full-height layout;
- scroll containment;
- close control;
- optional standard loading/unavailable shell.

Recommended shape:

```ts
type ResourcePreviewDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: ReactNode
}
```

Use a width that is useful for CRM data: nearly full width on small screens and roughly 36-42rem on larger screens. Override the local Sheet's default `sm:max-w-sm`; do not change the base primitive globally unless every Sheet should change.

Keep Sheet title/description present even when the visible inspector has its own rich header. Do not produce duplicate visible headings solely to satisfy the primitive; visually hidden dialog metadata is acceptable when the inspector provides the visible hierarchy.

Do not put these in the shared drawer:

- resource fields or field mapping;
- API fetching;
- permission decisions;
- delete requests;
- edit route construction;
- generic `Object.entries()` rendering.

### `ResourceDeleteDialog`

The shared component may own:

- controlled open state;
- title, description, confirm label, and pending label slots;
- destructive action styling;
- disabled/pending behavior;
- an in-dialog API error region;
- Cancel and Confirm layout.

Recommended shape:

```ts
type ResourceDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  pendingLabel?: string
  pending: boolean
  error?: string
  restoreFocusRef?: RefObject<HTMLElement | null>
  onConfirm: () => void | Promise<void>
}
```

The shared confirm handler must prevent the primitive's automatic close, call `onConfirm`, and let the parent close the controlled dialog only after success. Use the optional trigger ref with close autofocus when a controlled dialog would otherwise lose its return target.

Keep target state and the DELETE request in the resource page. Resource-specific copy must explain meaningful consequences, such as role loss or connected-record impact, only when verified.

### Do not extract prematurely

Keep the following local until at least two resources prove an identical need:

- URL hooks;
- selected-member fetching;
- route builders;
- inspector headers;
- action authorization;
- form adapters;
- post-delete pagination repair.

## 5. State and routing contract

### Canonical index query

- `record=<id>` means a read-only preview drawer is open.
- no `record` means the drawer is closed.
- `mode=create` is a stale index state and must redirect to the dedicated create page.
- `record=<id>&mode=edit` is stale and must be redirected or replaced with the show-page edit URL.
- Filters and `page` remain untouched when opening or closing preview.

Derive drawer open state from the URL rather than maintaining a competing boolean. Local state may hold the loaded record, request status, and delete target.

### Navigation examples

Given `/contacts?page=3&q=ali&record=42`:

- close drawer -> `/contacts?page=3&q=ali`;
- open another record after closing -> `/contacts?page=3&q=ali&record=77`;
- edit -> `/contacts/42?mode=edit&return=page%3D3%26q%3Dali`;
- details -> `/contacts/42?return=page%3D3%26q%3Dali` when return context is supported.

Do not place `record` or the stale index `mode` inside the encoded return value.

### History semantics

- Opening a drawer should push a history entry so Back closes it.
- Closing through the UI should normally navigate to the same index without `record`.
- Filter and pagination changes should close preview to avoid a record detached from the visible result context.
- Successful deletion should replace or navigate to a valid state so Back cannot reopen a deleted preview.

### Selection fetch

- Reuse the listed record immediately when useful.
- Fetch the member endpoint for complete or authoritative details.
- Abort stale requests when the ID changes or the drawer closes.
- Ignore AbortError.
- Prevent a late response for record A from replacing record B.
- Keep list-level errors separate from drawer-level errors.

## 6. Migration sequence

1. Inventory the target's URL state, panel modes, actions, forms, show page, permissions, and tests.
2. Confirm show, update, and delete operations in OpenAPI and generated types.
3. Make the show page support same-route editing if it does not already.
4. Move or create the dedicated create page using the existing typed form and create contract.
5. Add return-context behavior where the index must restore filters/page.
6. Introduce or reuse `ResourcePreviewDrawer` and `ResourceDeleteDialog`.
7. Remove index create/edit state and handlers; rewire every New/Create link to the create page.
8. Replace the layout grid with a full-width list/grid plus the overlay drawer.
9. Rewire row/card and drawer Edit to the show-page edit URL.
10. Replace inline deletion and show-page confirmation with the popup.
11. Remove dead `showPanel`, `isEditing`, `mode=create`, inline confirmation, and edit-form branches.
12. Update tests and run the verification ladder.
13. Review the diff for unrelated field, filter, payload, or authorization changes.

## 7. Accessibility and responsive behavior

- Use the local Sheet and AlertDialog primitives; do not hand-roll focus trapping.
- Give both dialogs an accessible title and description.
- Verify Escape closes only the topmost active layer.
- When delete opens from the drawer, the alert sits above it; cancelling returns focus to the drawer trigger.
- Restore focus to a sensible delete or preview trigger when dialogs close.
- Keep destructive buttons named with the action and resource.
- Ensure icon-only buttons have `aria-label` and tooltips.
- Avoid nested interactive elements in clickable rows/cards.
- On small screens, make the drawer nearly full width without hiding its close control.
- Keep the drawer body independently scrollable and important actions reachable.
- Test long names, identifiers, currency, badges, images, and relationship links.
- Preserve dark-mode contrast and reduced-motion behavior from the primitives.

## 8. Resource-specific rules

### Deals

Edit visibility and route access must use exactly:

```ts
isSuper || can("deal.update") || user?.id === deal.agent_id
```

Apply it independently to every row, drawer record, and show page. Do not replace `deal.update` with `deal.edit`.

Deal drawer content is a compact, member-backed inspector. Fetch and render the authoritative deal member response so embedded property media is not lost when the list row is incomplete. Show the property image(s), then a compact block for `deal_value` and `value`; put commission in a footer row with a percentage icon plus accessible rate and amount. Keep the assigned agent in its own bordered card/section. Remove filler headings such as “Deal economics” and avoid explanatory prose that duplicates these labels.

### Contacts, Accounts, and Properties

Preserve existing same-route details editing, relationship links, and documented return context. Add return restoration where absent without dropping index filters.

### Leads and Agents

Historically their show-page edit actions return to the index editor. Migrate the form into the show route first; do not redirect index Edit until direct `?mode=edit` works, validates, saves, cancels, and respects permissions.

### Properties

The index is a card grid rather than a table. Preserve card keyboard behavior and gallery hierarchy. Keep the required loaded `created_at` value in update payloads if the contract still requires it.

### Roles

The current right column is an editor, not a preview. Do not mechanically wrap it in a Sheet. Require a resource-specific plan for a read-only preview and a dedicated role editing route before conversion.

## 9. Test matrix

### Index and drawer

- row/card click opens the Sheet and sets `record`;
- direct `record` URL opens after member loading;
- selected member content and relationships render;
- list/card container classes do not switch to a split grid;
- close button, Escape, backdrop, and Back remove only `record`;
- filters/page survive open and close;
- stale member requests are aborted or ignored;
- unavailable/403/404 states remain inside the drawer;
- action and relationship clicks do not open the drawer.

### Editing

- row and drawer Edit use `/<resource>/<id>?mode=edit`;
- New/Create buttons and empty-state CTAs navigate to `/<resource>/create` or the established create route;
- stale index `mode=create` URLs redirect to the dedicated create page;
- return query excludes `record` and index `mode`;
- show-page direct edit loads the form;
- Cancel restores server values and read mode;
- validation errors map to fields;
- update request matches the documented payload and method;
- success shows the saved detail record;
- unauthorized users cannot see or force edit mode.

### Deletion

- first click opens a dialog and sends no DELETE;
- Cancel sends no DELETE and restores focus;
- Confirm sends one DELETE;
- pending state prevents duplicate requests;
- API failure stays visible in the open dialog;
- success removes the record, repairs pagination if needed, and closes an active deleted drawer;
- deletion from a show page navigates to the preserved index context;
- opening Delete never changes `record` accidentally.

### Verification ladder

Run from `dashboard/`:

```bash
npm run api:check
npm run test -- <focused-test-file>
npm run typecheck
npm run lint
npm run build
```

Also run `git diff --check` from the repository root. Report focused failures, existing failures, and environment blockers separately.

## 10. Definition of done

- One requested resource is migrated; unrelated resources are unchanged.
- Preview is a right overlay Sheet and never changes index width.
- Drawer state is URL-addressable and history-safe.
- Preview remains read-only.
- Existing-record Edit routes to same-page edit on the details route.
- Create routes to a dedicated create page, and every target create link reaches it.
- All target delete entry points use a popup AlertDialog.
- Create is no longer rendered in the index or drawer; its preserved form works on the dedicated create route through the existing details/edit surface when available.
- Shared primitives contain only domain-neutral chrome.
- Exact permissions and payload contracts are preserved.
- Dead inline panel/edit/delete code is removed.
- Focused behavior tests and the verification ladder are reported honestly.
