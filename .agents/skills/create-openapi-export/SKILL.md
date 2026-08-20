---
name: create-openapi-export
description: Generate or update an ApiDog-style OpenAPI JSON export for a CRM API resource. Use when asked to create OpenAPI documentation, an ApiDog export, endpoint schemas, or a resource `.openapi.json` file.
---

# Create OpenAPI Export

Create the export in `docs/openapi/`. Use an existing `docs/openapi/*.openapi.json` export as the structural and naming reference.

## Source of truth

Read the implemented resource before documenting it:

- `routes/api.php` and the resource route file;
- controller response wrappers and status codes;
- store and update requests;
- resource classes and every conditionally loaded relation;
- model casts and related models;
- backed enums;
- feature tests when present.

Document what the code returns and accepts. Do not copy a stale example when it conflicts with the implementation.

## Output

- Name the export `docs/openapi/{PascalCase-resource-or-business-area}.openapi.json`, following the existing convention. For example, `activity-logs` is `docs/openapi/ActivityLog.openapi.json`.
- Preserve the example export’s `openapi` version, top-level ordering, empty tags/security conventions, Authorization header convention, relative `/` and `/{id}` paths, pagination response shape, and `components.schemas` naming style.
- Set `info.title` to the requested business area, such as `Sales`.
- Create a primary schema named after the model in StudlyCase. Add schemas for relations returned by the resource.
- Use request field names from form requests and response field names from resources; they may differ.
- Include backed-enum values exactly.
- Match actual response wrappers and success codes, including `201` for create and `204` for delete when implemented.

## Operations

Document exactly these resource operations when the route exposes them:

- `GET /`: list, using the project pagination envelope.
- `POST /`: store.
- `GET /{id}`: show.
- `POST /{id}`: update.
- `DELETE /{id}`: delete.

### Update rule

Create exactly one update operation. It must be `POST /{id}`.

Its `application/json` request body must contain:

```json
"_method": {
  "type": "string",
  "default": "PUT"
}
```

Include `"_method": "PUT"` in the update example. Do not add `put` or `patch` operations. Do not create a second update request body, update schema, or update example.

For an update request, make fields optional unless the request class requires them independently of presence. Keep `_method` only in the documentation request body; it is not a resource response field.

## Validation

Before finishing:

1. Parse the export with `jq empty`.
2. Verify every local `#/components/schemas/...` reference resolves.
3. Verify `/{id}` contains at most one update operation and that it is `post`.
4. Verify the update body has `_method.default = PUT`.
5. Run `git diff --check`.

Report only the created or updated `docs/openapi/*.openapi.json` export and validation result.
