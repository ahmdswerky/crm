# CRM Resource Workspace Standard

Use this checklist as the acceptance standard. Apply items supported by the requested resource contract and explain genuine contract blockers.

## Contract and routing

- Import the model from the matching `dashboard/src/api/generated/{Domain}.ts` components.
- Define typed list metadata and singular response envelopes from OpenAPI.
- Use `API_BASE_URL`, `apiJson`, `apiFetch`, `ApiError`, and `readApiError` consistently with current dashboard code.
- Expose `/resources` for the index workspace and `/resources/:resourceId` for the dedicated details page.
- Keep the existing app-shell navigation destination stable.
- Replace an existing generic route instead of adding a parallel competing route.
- Gate page access and create/edit/delete actions with documented permissions.
- Provide a useful forbidden state; do not silently render an empty page.

## Index header and loading

- Show the route eyebrow, resource title, concise domain description, Refresh, and permission-gated New action.
- Do not add a redundant table title/count header above the column header.
- Show skeleton rows during list loading without removing table structure.
- Show an accessible page-level error and allow retry/refresh.
- Show a clear empty state and a filtered-empty state with Clear filters.

## URL-driven filters

- Read canonical filter values from `useSearchParams`.
- Preserve filters across reload, browser back/forward, pagination, and dedicated-page return.
- Put searchable fields in a useful text search control on every resource page.
- Add every safe enum, relation/select, date, and numeric filter that maps to the resource schema, even when the list endpoint does not document server-side query parameters.
- If a safe filter cannot be derived from the contract, ask the user explicitly before omitting it; omission is never silent.
- Debounce text inputs for 500 ms after the last keystroke.
- Apply enum/select filters immediately.
- Use the shared shadcn date-range picker for paired date filters (`from`/`to`) and the shared shadcn date picker for single-date filters; do not use native date inputs.
- Reset `page` to `1` and close preview/editor state when filters change.
- Abort stale list requests and keep loading state accurate.
- Forward only OpenAPI-documented query parameters to the list endpoint.
- When the OpenAPI list operation lacks filter parameters, retain the full filter UI and URL state, apply it to the records loaded for the current page, and label that limitation clearly; never send guessed query parameters or claim server-wide results.

## Numbered pagination

- Use the shared `dashboard/src/components/shared/resource-pagination.tsx` component for every paginated table, including existing tables being upgraded.
- Drive the current page from the `page` URL parameter.
- Render first, previous, numbered, next, and last controls; never ship a Previous/Next-only pagination control.
- For long ranges, show the first page, nearby current pages, ellipses, and final page.
- Preserve filter query parameters when changing pages.
- Close preview/editor state when changing to another result page.
- Use server pagination metadata; do not derive total pages from current rows.
- Disable or avoid navigation outside `1..last_page`.
- Keep controls keyboard accessible with explicit labels, `aria-current="page"`, and disabled first/previous or next/last controls at the boundaries.

## Table and actions

- Choose concise, high-value domain columns and format values intentionally.
- Make the row clickable to open an inline preview.
- Clicking the same previewed row a second time closes the preview.
- Do not let action-button clicks trigger row preview.
- Keep an Actions column at a fixed width large enough for normal actions and inline delete confirmation; action-state changes must not resize or push the row.
- Use icon-only actions for dedicated details, edit, and delete.
- Put a top-positioned tooltip and accessible label on every icon action.
- Keep action swaps instant; do not animate the buttons or action container.
- Visually mark the active preview and active edit action for the selected record.
- Use a dedicated-details eye action that navigates to `/resources/:id`.
- Render related-resource names as links to the related resource's dedicated `/resources/:id` details route everywhere they appear in the table, preview, or details view. Relationship links must not trigger the parent row preview click.

## Inline deletion

- Do not use a dialog, alert popup, toast-only undo, or browser confirmation.
- Clicking trash enters delete mode only in that row.
- Do not select the row or open/change preview when trash is clicked.
- Hide the row's normal actions while confirming.
- Show only Cancel and Delete in the same fixed-width action cell.
- Keep the preview unchanged unless the successfully deleted record is the one currently previewed.
- Disable confirmation controls while deleting and show a clear deleting label.
- On success, close a deleted active preview/editor and reload the current list page.
- On failure, retain a useful error without pretending deletion succeeded.

## On-demand preview and editor

- Do not render an empty “Select a record” side panel.
- Let the table use the full width when no record is previewed or edited.
- Add the side panel only on demand.
- Use a two-column layout at the appropriate breakpoint.
- Give the panel its natural content height with top alignment; never stretch it to table height.
- Keep preview and editor state in `record` and `mode` URL parameters.
- Show a compact preview header, domain status/metadata, and key fields.
- Put icon-only dedicated-details, edit, and delete controls together in the preview header, each with a tooltip.
- Use domain-appropriate subtle badges, text colors, and icons with accessible contrast.

## Visual hierarchy and UX quality

- Establish an explicit hierarchy before coding: record identity and the primary decision metric come first, supporting metadata follows, and tertiary values remain visually quiet.
- Do not present preview data as an undifferentiated stack of same-sized labels and values. Group related fields into purposeful sections, use meaningful spacing, and make the primary value visibly more prominent than supporting metadata.
- Keep labels small and muted, values readable and appropriately weighted, and secondary descriptions faded without losing contrast. Use a consistent type scale rather than arbitrary per-field styling.
- Use restrained semantic color only when it communicates state or comparison (for example, status, variance, or a monetary delta); preserve a neutral treatment for equal or ordinary values.
- Align numeric and monetary values consistently, use locale-aware currency/date formatting, and add compact semantic icons only when they improve recognition. Icons must be optically aligned, keyboard/screen-reader safe, and never substitute for essential text.
- Use person initials avatars for Contact/User/Agent identities and keep the avatar, linked name, and supporting metadata visually grouped.
- Review responsive behavior at narrow and wide widths. Prevent long names, identifiers, and amounts from breaking the hierarchy or pushing actions out of view.
- If the local system does not establish a pattern or the interaction has meaningful UX tradeoffs, research reputable UX guidance before implementation and record the chosen rationale in the working notes or handoff.

## Create and edit

- Use React Hook Form, Zod, and the existing shadcn Field components.
- Use shadcn date-picker and date-time-picker controls for every date field. Date-time controls may compose the shadcn Calendar with the existing shadcn Input for time, but must not fall back to native `date` or `datetime-local` inputs.
- Use the documented schema for defaults, validation, enums, nullability, and payload mapping.
- Add `(required)` beside every required field label.
- Map `ApiError.fields` messages back to the matching controls.
- Show saving state and prevent double submission.
- Create with the documented POST collection request.
- Update with POST to the member endpoint and `_method: "PUT"`.
- After save, reload list data and show the saved record preview.
- Cancel or close create by clearing the draft and panel state.
- Cancel or close edit by resetting values from the selected server record and returning to preview.
- Re-clicking an already-active edit action also rolls back unsaved changes and returns to preview.
- Never claim rollback of changes already saved to the server.

## Dedicated details page

- Load the member endpoint independently from list state.
- Validate the route identifier before requesting.
- Provide loading, forbidden, unavailable/error, and not-found states.
- Use a fluid page container rather than an unnecessarily narrow centered card.
- Show a back-to-index action that returns to the resource workspace.
- Display the full documented record in domain-appropriate sections.
- Show restrained status/enum/source treatments consistent with the index and preview.
- Provide permission-gated edit/delete actions when the contract supports them.
- Link edit back to the index editor state unless a separate edit route is explicitly required.

## Domain adaptation

- Leads is the interaction reference, not a field template.
- Use relationship labels and compact related-record summaries for deals, contacts, accounts, properties, and future resources.
- Render Contact, User, and Agent references with `dashboard/src/components/shared/person-avatar.tsx`; use first/last-name initials (or a stable two-character single-name fallback) in tables, previews, details, filters, and account chrome.
- Add small semantic context icons where they improve scanability, such as a muted location-pin icon before city metadata and a currency icon prefix for money inputs. Keep these icons accessible, subtle, and consistent with the existing icon set; do not invent icons for arbitrary enum values.
- Use currency formatting for monetary values and locale-aware formatting for dates.
- Use semantic status colors consistently in table, preview, details, and dropdowns.
- Keep status colors subtle: tinted background and border with high-contrast text.
- Use official brand marks/colors only when values represent actual platforms or brands.
- Do not invent icons for arbitrary enums.
- Prefer em dashes for genuinely missing display values.
- Avoid nested cards, heavy shadows, excessive rounded containers, and decorative transitions.
- Keep inputs, textareas, selects, comboboxes, and input groups free of focus-visible borders, outlines, rings, and box-shadows; do not reintroduce them through global selectors or local utility overrides.

## Verification matrix

- API contract freshness: `npm run api:check`
- Static quality: `npm run lint`
- Type safety: `npm run typecheck`
- Unit/component behavior: `npm run test`
- Production compilation: `npm run build`
- Browser workflows: `npm run test:e2e`
- Patch integrity: `git diff --check`

Add or update focused tests when the repository has an established test location for the behavior. Report warnings and pre-existing failures separately from errors introduced by the resource page.
