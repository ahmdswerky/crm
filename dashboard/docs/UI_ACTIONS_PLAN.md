# CRM Dashboard Action and Authorization Plan

## Summary

Move staff management from `/settings` to `/agents`. Add super-admin-only role management at `/settings/roles`.

Final route map:

```text
/login
/
/leads
/deals
/properties
/accounts
/contacts
/agents
/settings          -> redirect to /settings/roles
/settings/roles
```

Entity state remains URL-addressable through query parameters:

```text
/agents?page=2
/agents?page=2&record=15
/agents?mode=create
/agents?record=15&mode=edit
/settings/roles?record=3
/settings/roles?record=3&mode=edit
/settings/roles?mode=create
```

## Authorization Model

Add this required, read-only field to the shared Auth `User` schema:

```ts
is_super: boolean
```

It must be returned by both `POST /login` and `GET /user`.

Centralize authorization:

```ts
can(permission) =
  authenticatedUser.is_super ||
  authenticatedUser.permissions.includes(permission)
```

Rules:

- `is_super` globally bypasses ordinary route and action permissions.
- `/settings/roles` requires `is_super === true` specifically.
- The Settings navigation group is hidden from non-super users.
- Backend middleware must independently enforce the same restriction.
- Agent role assignment is available only to super admins.
- Non-super users with Agent edit access may edit basic agent fields but cannot submit a `roles` property.
- `is_super` is derived by the backend and can never be edited directly.
- After any role or agent-role mutation, invalidate and reload `/user`; if the current user loses super-admin status, close the editor and render the forbidden state.

## OpenAPI Contract Gate

### Existing contract repairs

- Fix Users pagination and remove the exported authentication-exception example.
- Make Agent creation username writable and required.
- Require password during Agent creation; do not accept it through normal Agent updates.
- Document `page` and `per_page` for Users and Roles.
- Add typed `401`, `403`, `404`, `409`, and `422` responses.
- Add bearer security instead of ordinary `Authorization` parameters.
- Keep updates as one `POST /{id}` operation containing `_method: "PUT"`.
- Document exact permission strings for Agent list/create/edit/delete actions.
- Preserve the previously identified Contact, Property, Lead, and Deal contract corrections.

### Roles and permissions contract

Use the existing Auth endpoints:

```text
GET    /v1/roles
POST   /v1/roles
GET    /v1/roles/{id}
POST   /v1/roles/{id}
DELETE /v1/roles/{id}
GET    /v1/permissions
```

Normalize role requests:

```ts
type RoleStoreRequest = {
  name: string
  permissions: string[]
}

type RoleUpdateRequest = {
  _method: "PUT"
  name: string
  permissions: string[]
}
```

Contract decisions:

- `guard_name` is server-managed, absent from request schemas, and never visible in the dashboard.
- `GET /v1/permissions` is the read-only permission catalog.
- Permission records cannot be created, renamed, or deleted from the dashboard.
- Attach/detach is implemented atomically by sending the complete permission-name array during role create/update.
- Unknown permission names and duplicate role names return field-level `422` errors.
- All Role and Permission operations require `is_super`.
- Deleting a role transactionally detaches its agent and permission associations, then returns `204`.
- No role is reserved or protected from a super admin.
- Regenerate `Auth.ts`; the current contract check reports generated drift after Role and Permission endpoints were added.

## Navigation and Shared Actions

Sidebar structure:

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
  Agents

Settings
  Roles & permissions
```

- Hide empty navigation groups.
- Show Agents when `is_super` or the documented Agent-view permission is present.
- Show Settings and Roles & permissions only when `is_super` is true.
- Command palette supports permitted navigation and quick-create actions only.
- Tables support documented server pagination and local column visibility.
- Do not add undocumented search, server filtering, sorting, bulk mutation, analytics, or “recent” ordering.
- All entity pages provide refresh, retry, inspect, create, edit, delete, pagination, loading, empty, forbidden, missing-record, validation, conflict, and offline states.

## Page Plans

### Login — `/login`

Actions:

- Enter username and password.
- Submit documented multipart data to `POST /login`.
- Store the token and authenticated User, including `is_super`.
- Restore the originally requested protected route.
- Retry invalid credentials or transient server failures.
- Revalidate stored sessions through `GET /user`.
- Sign out through `DELETE /logout`.

Implementation:

- Use React Hook Form, Zod, and shadcn `Field`.
- Do not clear a valid stored token because `/user` has a transient network failure.
- Provide accessible validation and asynchronous error announcements.

### Overview — `/`

Actions:

- Navigate to permitted domains.
- Open the command palette.
- Launch permitted quick-create actions.
- Refresh or retry collection summaries.

Data:

- Show only totals exposed by documented pagination metadata.
- Remove fabricated pipeline value, due dates, trends, and activity claims.
- Allow `is_super` users all ordinary quick actions through the global bypass.

### Leads — `/leads`

Actions:

- List, refresh, paginate, inspect, create, edit, and delete.
- Preserve exact status and source enum values.
- Update through method-spoofed POST.

Fields:

- Table: name, email/phone, status, source, city, company.
- Detail: all documented Lead fields.
- Form: name, email, phone, status, city, address, company name, source.

Exclude assignment, scoring, server filters, and undocumented pipeline actions.

### Deals — `/deals`

Actions:

- List, refresh, paginate, inspect, create, edit, and delete.
- Choose contacts and properties through paginated API-backed pickers.
- Update through method-spoofed POST.

Fields:

- Contact, property, status, value, deal value, commission rate, closed date.
- Preserve documented status values exactly.

Exclude Kanban, drag-and-drop, pipeline aggregation, assignment, and stage filtering.

### Properties — `/properties`

Actions:

- List, refresh, paginate, inspect, create, edit, and delete.
- Display returned owner information as read-only.
- Update through method-spoofed POST.

Fields:

- Title, description, city, address, price, type, mutable status.
- Preserve the documented `appartment` spelling.
- Enforce documented price bounds.
- Display returned `sold` status without offering it when mutation schemas do not accept it.

### Accounts — `/accounts`

Actions:

- List, refresh, paginate, inspect, create, edit, and delete.
- Update through method-spoofed POST.

Fields:

- Name, industry, phone, address, created date.
- Industry remains free text until the API documents choices.

### Contacts — `/contacts`

Actions:

- List, refresh, paginate, inspect, create, edit, and delete.
- Select an account through an API-backed paginated picker.
- Update through method-spoofed POST.

Fields:

- Name, title, email, phone, account, created date.
- Never submit the read-only Contact ID.

### Agents — `/agents`

This page replaces the current Users-at-`/settings` page while continuing to use `/v1/users`.

Actions:

- List, refresh, paginate, and inspect Agents.
- Create, edit, or delete Agents through documented permissions.
- Super admins may assign or detach multiple roles.
- Non-super editors may change only basic fields accepted by the update contract.

Table and detail:

- Name, username, email, phone, roles, effective permissions, `is_super`, created date.
- Render `is_super` as a read-only “Super admin” status.
- Show roles and effective permissions read-only to non-super viewers.

Create form:

- Required name, username, email, phone, and password.
- Optional roles selector visible only to super admins.
- Roles load from `GET /v1/roles`.

Edit form:

- Name and phone according to the current update contract.
- Multi-role selector only for super admins.
- Do not send `roles` for non-super editors.
- Username, email, password, and `is_super` remain read-only unless a later contract explicitly adds mutations.

Mutation behavior:

- Create with `POST /v1/users`.
- Update with one `POST /v1/users/{id}` containing `_method: "PUT"` inside the documented user wrapper.
- Delete with `DELETE /v1/users/{id}`.
- Invalidate Agents, Roles, and the current `/user` query after role assignment changes.

### Roles & Permissions — `/settings/roles`

Access:

- Render only for `is_super === true`.
- Hide the route from navigation and the command palette for everyone else.
- Direct non-super access renders an in-shell forbidden state.
- Server endpoints independently return `403` to non-super users.

Layout:

- Desktop uses a stable master-detail workspace: paginated role list on the left and selected-role inspector/editor on the right.
- Mobile uses a compact role list and route-addressable full-page inspector.
- Do not place the main editor inside a routine modal.

Role list actions:

- Refresh and paginate roles.
- Select a role.
- Create a role.
- Rename or delete the selected role.
- Display role name and permission count computed from returned permissions.

Permission editor:

- Load the complete catalog through `GET /v1/permissions`.
- Group permissions by the prefix before the first dot while preserving exact values.
- Provide client-side permission filtering, group-level select-all, and group-level clear.
- Stage checkbox changes locally without issuing attach/detach requests.
- Show added and removed permissions in a review section.
- Disable Save until changes exist and the form is valid.
- Warn before discarding unsaved changes.

Create:

- Enter role name.
- Select zero or more permissions.
- Submit one `POST /v1/roles` request containing name and the complete permission array.

Edit:

- Change role name and permission selection.
- Submit one `POST /v1/roles/{id}` containing `_method: "PUT"`, name, and the complete permission array.
- Replace local data with the returned Role and invalidate Roles, Agents, and `/user`.

Delete:

- Confirm that the role will be removed from assigned Agents.
- Call `DELETE /v1/roles/{id}`.
- Remove the selected role from the workspace, refresh Agents, and revalidate the current user.
- No protected-role or last-super-admin restriction is added.

## Implementation Architecture

- Replace the generic `ResourcePage` and handwritten fetching with generated clients and domain feature modules.
- Use TanStack Query for server state, mutations, invalidation, and session revalidation.
- Use TanStack Table for Agents, Roles, and other entity collections.
- Centralize route metadata and `can()` authorization, while keeping the explicit `is_super` Roles guard separate.
- Keep role and permission payloads typed directly from the corrected Auth OpenAPI export.
- Use one shared entity-workspace composition, but retain domain-specific columns, fields, permission keys, and empty-state copy.
- Preserve the Quiet Ledger design: thin rules, flat surfaces, restrained blue, compact controls, and a stable master-detail hierarchy.

## Test Plan

### Authorization

- Login and `/user` require a boolean `is_super`.
- Super admins pass every ordinary permission check.
- Non-super users still require explicit permissions.
- Only super admins see or access `/settings/roles`.
- Backend Role and Permission endpoints reject non-super requests.
- Non-super Agent editors never see role controls and never send `roles`.
- Super admins can assign and detach multiple Agent roles.
- Losing super-admin status immediately removes Settings access after revalidation.

### Roles and permissions

- List, pagination, detail, create, rename, permission update, and delete.
- Permission toggles send no requests until Save.
- Save sends exactly one complete permission array.
- Role update sends exactly one POST with `_method: "PUT"`.
- Duplicate names and unknown permissions map to accessible field errors.
- Role deletion detaches Agent and permission relationships and refreshes dependent data.
- Dirty editors warn before navigation or role selection changes.

### Application regression

- Full CRUD coverage for Leads, Deals, Properties, Accounts, Contacts, and Agents.
- Permission-aware sidebar, command palette, routes, and row actions.
- Query-driven detail and form states survive refresh and browser navigation.
- Keyboard, screen-reader, reduced-motion, responsive, dark-mode, and RTL checks.
- Final gates: `api:validate`, `api:check`, `lint`, `typecheck`, `test`, `build`, and `test:e2e`.

## Assumptions

- “Full control” means Role CRUD plus attaching and detaching existing permission records.
- Permission records remain system-defined and read-only because OpenAPI exposes only `GET /v1/permissions`.
- `guard_name` is completely hidden and supplied by the API.
- `is_super` is the exact response field name.
- Super admins globally bypass ordinary permissions.
- No role or last-super-admin lockout protection is required.
- Payments, Activity Logs, password-recovery routes, Security, and Appearance remain outside this plan.
