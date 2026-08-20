# CRM Show Page Standard

Use this reference to design and review dedicated details routes. Apply only patterns earned by the model and its contract.

## Contents

1. Contract and relationship audit
2. Information hierarchy
3. Action patterns
4. Same-route editing
5. Connected data and links
6. Media and history
7. Copy and visual treatment
8. Responsive and accessible behavior
9. States and verification
10. Anti-patterns

## 1. Contract and relationship audit

Create a working table before implementation:

| Source | Questions |
| --- | --- |
| Member response | Which fields and relationships arrive with the record? |
| Update operation | Which fields are independently optional, required, nullable, or enum? |
| Related resources | Which identifiers map to documented details routes? |
| Collection endpoints | Can edit controls load complete, permission-safe options? |
| Media | Which owner types and collections are documented? |
| Activity | Is there a documented base URL, subject filter, permission, and pagination shape? |
| Derived values | Is the formula unambiguous and based only on returned fields? |
| Missing data | Which useful concepts would be fabricated today? |

Do not treat a nested summary as permission to invent the rest of the related record. Fetch another member endpoint only when the page needs documented fields that are absent from the parent response.

If two contracts define the same relationship differently, expose the contradiction before implementation. Do not normalize it with casts or `any`.

## 2. Information hierarchy

### Tier 1: operational identity

The first viewport should answer:

- What record is this?
- What is its current workflow state?
- What is the primary value or decision fact?
- Who owns it?
- What can the operator do now?

Do not require the operator to scan a grid of labels to reconstruct the record identity. When the model has no title field, construct a display identity from documented related labels and show the server ID as secondary metadata; do not persist the constructed title.

### Tier 2: decision support

Choose sections based on the model:

- Transaction/workflow record: customer, item or property, stage, amount, dates, owner, next supported action.
- Listing/property: media, location, price, availability, description, owner.
- Person/contact: phone/email, role/title, account, relationship and activity context.
- Organization/account: identity, reachability, location, industry, documented related people or work.
- Staff/agent: identity, contact, role/access, assigned work only when documented.

### Tier 3: evidence and history

Place descriptions, galleries, change history, supporting relationships, and secondary facts after the primary decision block.

### Tier 4: optional operational metadata

Do not add a default metadata section. Show an ID or created/updated timestamp only when it helps an operator identify, reconcile, audit, calculate, or act on this particular record. Keep it visually quiet and place it last; otherwise omit it.

### The one-fact rule

Every fact has one canonical home on the page. Do not repeat the same phone, address, owner, status, relationship summary, or identity fields across the header, metrics, main sections, and rail.

An intentional second appearance must earn itself by enabling a distinct action or persistent context—for example, a compact `tel:` action in a sticky rail while the full phone value remains in the reachability section. It must not reproduce the surrounding field set. Remove sections that only restate facts already visible nearby.

## 3. Action patterns

### Workflow state control

Use a stage/status path when:

- the enum represents a meaningful process;
- order is documented or product-confirmed;
- the update request permits a field-only update; and
- the current user passes the exact record-level update rule.

Requirements:

- Use real buttons or an accessible toggle group, not clickable badges.
- Mark the current value with text/icon/state in addition to color.
- Set an accessible current/pressed state.
- Keep a visible pending target while the request runs.
- Disable conflicting submissions.
- Announce success or failure.
- Restore the confirmed server value after failure.
- Separate terminal alternatives from the sequential path when appropriate.
- Do not infer dates, probabilities, or transition side effects.

If the enum is merely categorical, use an inline Select in edit mode rather than a decorative path.

### Critical action rail

Use a sticky rail only when two or more actions must remain available during long-page work, such as Call, Email, Open related record, or Save/Cancel.

- Keep the rail below the sticky app header.
- Use the primary person's documented phone/email as `tel:`/`mailto:` links.
- Remove unavailable actions rather than disabling unexplained empty buttons.
- Do not make the rail a second full copy of the page. It may repeat only the minimum context needed to make its persistent action unambiguous.
- On mobile, use a compact bottom action bar or a top action row; ensure it does not cover content, errors, or form controls.

### Destructive and rare actions

Keep Delete and similar actions out of the primary path. Use an overflow or secondary action area plus contextual confirmation. Preserve page context when deletion fails.

## 4. Same-route editing

The dedicated details route owns its editor. Never link back to the index inspector to edit.

Two valid patterns:

1. Full-page in-place mode: the page preserves its sections while values become inputs and a sticky Save/Cancel bar appears.
2. Section editing: one purposeful section changes at a time when updates are truly independent and partial.

Avoid dozens of always-visible pencil icons. Use one top-level Edit action unless separate ownership or save semantics justify section actions.

Requirements:

- Initialize from the latest loaded member response.
- Use React Hook Form, Zod, shadcn Field, and generated types.
- Mark required labels and match documented constraints/nullability.
- Use shared date/date-time pickers, never native date controls.
- Keep relation selection human-readable with avatars/media where useful.
- Send only intended changes when the update contract supports partial input.
- CRM update method is POST plus `_method: "PUT"`.
- Prevent duplicate submission.
- Map `422` errors to fields.
- Retain unsaved values after failure.
- Cancel resets from server state.
- Success updates visible data and exits edit mode without route hopping.

If a related collection cannot be loaded completely or with the required permission, keep the existing relation readable but locked. Never substitute a raw ID input or options harvested from a single unrelated paginated page.

## 5. Connected data and links

For every embedded or fetched relationship:

- Show the human label, not just its identifier.
- Link to the existing details route only when the user can view it.
- Pair person links with the shared avatar.
- Add phone/email actions when operationally useful.
- Use a concise preview; do not repeat the related page in full.
- Stop event propagation when used inside another clickable surface.
- Preserve return context when it helps the workflow.

Prefer this priority:

1. Embedded relationship data already in the member response.
2. A documented related member request.
3. A documented, bounded collection request.
4. A clearly labeled contract gap.

Never fetch every page of a large collection just to enrich read-only display. For form options, use a documented search/options/filter endpoint where available; otherwise report the scale limitation.

### Inverse relationship previews

Inspect the collections that can be filtered by the current record's ID, not just relationships embedded in the member response. When the filter, permission, and response are documented, a short server-backed preview can turn a detail page into a useful workspace.

For an Account, treat Contacts as a required candidate. Show only a small, purposeful set of avatar-led identity cards with name, role, and one clear button to open each Contact show page, then provide a “View all contacts” link to `/contacts?account={accountId}`. Keep phone and email out of these dense preview cards unless direct outreach is explicitly the page's primary task. The handoff must keep the account filter in the URL and must be hidden with the preview when the user lacks `contact.view`. Never filter a general contacts payload in the browser to create this preview.

## 6. Media and history

### Media

- Use only media attached through documented owner types and collections.
- Show the primary image first, then a restrained gallery/count.
- Use thumbnail URLs for grids and full URLs for enlarged content.
- Give content images useful alt text; decorative thumbnails may use empty alt only when adjacent text provides the same identity.
- Provide structural skeletons and a composed no-media state.
- Do not upload or manage media from a parent record unless its contract authorizes that owner/collection.

### Activity and change history

History should answer what changed, who changed it, and when.

- Filter by the documented subject syntax.
- Humanize known field changes with before/after values and domain formatting.
- Show actor, event, and timestamp.
- Paginate/load more from server metadata.
- Do not mix audit events with sales activities, notes, calls, or emails unless those resources actually exist.
- Treat revert as a separate destructive workflow with its own permission and required reason.
- Do not wire history when the OpenAPI server/base path or permission contract is missing.

## 7. Copy and visual treatment

### Keep

- Concise section names.
- Calculation explanations when a value is derived.
- Permission or contract limitations.
- Empty-state guidance.
- Pending, success, validation, and error messages.
- Consequences for destructive actions.

Before implementation, apply the inclusion test to every section and field: it must serve a distinct operator decision, action, or recovery need. Remove anything that fails.

### Remove

- “The complete documented record.”
- “These are the values recorded for this record.”
- Repeated route descriptions.
- Prose that restates the section heading.
- “Title: Value” repeated as the primary layout.
- Default “Record metadata” sections with IDs and timestamps that do not change an operator decision.
- The same detail set repeated in the header, a metric strip, a main section, and an action rail.

Use hierarchy rather than decoration:

- One clear page heading.
- One primary metric where the domain has one.
- Small muted labels and readable values.
- Flat sections separated by rules.
- Restrained semantic color for state, outcome, or variance only.
- No nested card wall, excessive badges, heavy shadows, gradients, or decorative motion.

When a field name is technically clear but its business meaning is not, keep a neutral label and report the ambiguity. Do not invent a polished but incorrect label.

## 8. Responsive and accessible behavior

- Wide layout may use a fluid main column plus a 280–380px sticky rail.
- Collapse structurally rather than shrinking typography.
- Keep identity, primary value, workflow state, and contact actions above secondary content on mobile.
- Allow long names and addresses to wrap without moving actions off-screen.
- Preserve logical properties and RTL-safe order.
- Support keyboard operation for status controls, edit, links, galleries, and confirmation.
- Maintain visible focus and WCAG 2.2 AA contrast.
- Form-control focus is an explicit exception: inputs, textareas, selects, comboboxes, and input groups stay free of focus-visible borders, outlines, rings, and box-shadows in both themes.
- Use `aria-live` or status roles for asynchronous mutations.
- Respect reduced motion; product state changes should usually be instant or 150–200ms.

## 9. States and verification

Every show page needs:

- Initial skeleton matching the final structure.
- Independent route fetch with abort cleanup.
- Refresh/retry.
- Invalid identifier.
- `401` session behavior.
- `403` forbidden.
- `404` not found.
- Network/server failure without false not-found language.
- Missing optional values and empty relationships/media.
- Read-only permissions.
- Mutation pending, success, `422`, `403`, conflict/failure, and duplicate-submit prevention.
- Responsive wide, narrow, dark, light, and RTL smoke checks.

Add focused tests for the page's primary action, permission branches, and error rollback. A production build alone does not verify the workflow.

## 10. Anti-patterns

Reject the design when it:

- is a uniform field dump;
- hides status or the primary metric below generic sections;
- links Edit to the index page;
- renders phone/email as inert text when actions are critical;
- omits documented media or connected records;
- displays every related record with equal visual weight;
- uses inaccessible clickable badges;
- shows forbidden links or controls;
- sends undocumented filters or endpoints;
- invents common CRM features because competitors have them;
- confuses audit history with operational activities;
- uses filler explanations to compensate for weak layout;
- creates a section solely because a common CRM template has one;
- repeats a field without adding a distinct action or persistent context;
- gives IDs or timestamps a default section without an operational reason;
- leaves metadata louder than the operator's next action.
