---
name: create-api-endpoint
description: Create a complete REST API endpoint for a model in this CRM Laravel project by reading its table schema from a database diagram image in the root of `server/`, running `php artisan make:api` with the requested model name and non-interactive column options, then finishing the generated module according to the repository's existing API conventions. Use whenever the user says "create an api endpoint for [model name]", asks to add a REST endpoint or API module for a model, or explicitly invokes `$create-api-endpoint`.
---

# Create API Endpoint

Create the requested endpoint from `server/`. Treat the existing modules, especially the closest domain analogue among `Contact`, `Account`, `Lead`, and `Property`, as the source of truth.

## Constraints

- Make the first implementation action `php artisan make:api` with the requested model name, repeatable `--column` options, and `--no-interaction`.
- Pass the model name to the command as supplied by the user. Do not convert it to camelCase, StudlyCase, singular, plural, snake_case, or kebab-case before invocation. The command owns model-name validation, singularization, and StudlyCase conversion.
- Derive the table columns and types from the database diagram image in the root of `server/`. Treat that image as the database-schema source of truth.
- Build every `--column` option from the diagram. If the image is missing, unreadable, or does not contain the requested table, ask only for the blocking schema information before running the command; do not suggest additional fields or features.
- Edit the generated module and only the project wiring required to expose it.
- Do not edit `MakeApiModuleCommand.php`, existing modules, frontend code, documentation, or unrelated files.
- Do not introduce services, abstractions, response envelopes, filters, sorting, search, events, jobs, observers, or other behavior unless the request explicitly requires them and an existing module establishes the pattern.
- Do not propose follow-up improvements. Complete the endpoint, validate it, and report the result briefly.

## Workflow

### 1. Read the database diagram

Before constructing the command, list image files directly inside `server/`. Prefer case-insensitive filenames containing `db`, `database`, `diagram`, `schema`, or `erd` and extensions such as `.png`, `.jpg`, `.jpeg`, or `.webp`.

Open the matching image with the available image-viewing tool. Use original detail when the diagram text is small. If multiple candidate images exist, inspect each candidate needed to locate the requested table.

Locate the requested table and transcribe:

- the exact table name;
- every business column and database type;
- nullable and default values;
- unique constraints and indexes;
- primary and foreign keys;
- referenced tables and relationship direction;
- soft-delete and timestamp columns.

Do not infer columns that are absent from the diagram. If candidates conflict or the requested table cannot be read confidently, stop and ask only for clarification of the conflicting or unreadable schema.

When building generator arguments:

- Omit `id` because `make:api` adds it automatically.
- Omit `created_at` and `updated_at` because `make:api` adds timestamps automatically.
- Omit `deleted_at` from `--column` arguments and add `softDeletes()` while finishing the generated migration and model.
- Map foreign-key columns to `foreignId` and preserve their referenced model for the migration and Eloquent relationship edits.
- Preserve lengths, precision, unsigned rules, composite indexes, and relationship constraints for the post-generation migration edit when the command option format cannot express them.

Map diagram types to command types as follows:

- `varchar` and `char` to `string`
- `text` variants to `text`
- `int` and `integer` to `integer`
- `bigint` to `bigInteger`, except foreign keys use `foreignId`
- `decimal` and `numeric` to `decimal`
- `bool` and `boolean` to `boolean`
- `date` to `date`
- `datetime` to `dateTime`
- `timestamp` to `timestamp`
- `json` and `jsonb` to `json`
- `uuid` to `uuid`

Apply `nullable`, `unique`, `index`, and `default=value` modifiers only when shown by the diagram.

### 2. Inspect the matching project pattern

Before editing generated files, inspect the closest existing module end to end:

- `database/migrations/*_create_*_table.php`
- `app/Models/{Model}.php`
- `database/factories/{Model}Factory.php`
- `database/seeders/{Model}Seeder.php`
- `app/Http/Requests/{Model}/{Model}StoreRequest.php`
- `app/Http/Requests/{Model}/{Model}UpdateRequest.php`
- `app/Http/Resources/{Model}Resource.php`
- `app/Policies/{Model}Policy.php`
- `app/Contracts/Repositories/{Model}RepositoryInterface.php`
- `app/Repositories/{Model}Repository.php`
- `app/Http/Controllers/{Model}Controller.php`
- `routes/api/v1/{plural}.php`
- `app/Providers/RepositoryServiceProvider.php`
- `database/seeders/DatabaseSeeder.php`
- `database/seeders/PermissionSeeder.php`
- `database/seeders/RoleSeeder.php`

Follow the current files rather than generic Laravel preferences.

### 3. Run the generator

From `server/`, run:

```bash
php artisan make:api "{model name as supplied}" \
  --column="name:string,index" \
  --column="email:string,nullable,unique" \
  --column="status:string,default=active" \
  --no-interaction
```

Use one `--column` option per requested field with this syntax:

```text
name:type[,nullable][,unique][,index][,default=value]
```

Use only the command's supported types: `string`, `text`, `integer`, `bigInteger`, `decimal`, `boolean`, `date`, `dateTime`, `timestamp`, `json`, `foreignId`, and `uuid`.

Always use `--no-interaction`; do not answer interactive prompts or normalize the model name outside the command. After generation, use the StudlyCase model name produced by the command for all generated-class edits and project wiring. Do not manually create the module before running this command.

### 4. Finish the generated persistence layer

- Adjust the migration to reproduce the diagram exactly while matching existing migration syntax: model-backed foreign keys, nullability, lengths, precision, indexes, unique constraints, deletion behavior, timestamps, and soft deletes.
- Keep the model's `#[Fillable([...])]`, `HasFactory`, optional `SoftDeletes`, casts, and typed Eloquent relationships consistent with existing models.
- Make the factory generate domain-appropriate values and valid related records using the project's established factory style.
- Keep the model seeder at the project's conventional count unless the request specifies otherwise.
- Add the seeder to `DatabaseSeeder` after any seeders it depends on.

### 5. Finish validation and serialization

- Keep requests under `App\Http\Requests\{Model}`.
- Express database constraints in both migration and validation rules where existing modules do so.
- Use `sometimes` for optional update fields.
- For update uniqueness, ignore the current route-bound model record.
- Use the existing `phone` validator for phone fields.
- Serialize explicit fields in `{Model}Resource`; include related resources with `whenLoaded`.
- Match project timestamp and relationship formatting exactly.

### 6. Finish authorization

- Use singular lowercase permissions: `{model}.view`, `{model}.create`, `{model}.edit`, `{model}.delete`, and `{model}.restore`.
- Keep policy methods and `is_super` force-delete behavior consistent with existing policies.
- Rely on the project's permission seeder model discovery.
- Add the new permissions to the same roles as the closest analogous module, unless the user provides a different role matrix.

### 7. Finish repository and controller layers

- Keep the generated repository interface methods: `paginate`, `find`, `store`, `update`, and `delete`.
- Inject the Eloquent model into the repository constructor.
- Eager-load resource relationships in repository queries and select the same minimal related fields used by analogous modules.
- Use explicit create/update field mapping. Follow the existing `Arr::get` partial-update pattern.
- Import requests from `App\Http\Requests\{Model}\...` in the controller.
- Use controller `#[Authorize]` attributes exactly like existing resource controllers.
- Preserve the established response contract:
  - index: `{Model}Resource::collection($paginator)`
  - store: `{ "{model}": resource }` with status `201`
  - show: `{ "{model}": resource }`
  - update: `{ "{model}": resource }`
  - destroy: empty response with status `204`

### 8. Wire the endpoint

- Bind `{Model}RepositoryInterface` to `{Model}Repository` in `RepositoryServiceProvider`.
- Create `routes/api/v1/{plural-kebab}.php` with `Route::apiResource(...)->middleware('auth:sanctum')`.
- Require that route file from the existing `v1` group in `routes/api.php`.
- Do not add a separate route prefix or response convention.

### 9. Validate completion

Run the narrow checks first, then the existing suite:

```bash
php artisan migrate
php artisan route:list --path=api/v1/{plural-kebab} -v
php artisan test
```

Also run syntax or formatting checks already used by the project on the changed PHP files. Fix only failures caused by this endpoint. Confirm that all five REST routes exist with `auth:sanctum` and authorization middleware.

The endpoint is complete only when its migration applies, container binding resolves, routes register, validation and authorization execute, resources produce the established response shape, and project tests pass.

## Final response

State only:

- the model and endpoint created;
- the five REST operations now available;
- the validation commands and their results.

Do not add suggestions, optional enhancements, or unrelated observations.
