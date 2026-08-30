# Database schemas

Committed snapshots of every application database, plus an interactive ERD per database built
with [Liam](https://github.com/liam-hq/liam).

| Database | Snapshot | Interactive ERD |
| --- | --- | --- |
| `crm` | [schema.sql](crm/schema.sql) | [dev](http://localhost:8080/docs/db/crm/) · [prod](https://crm.swerky.dev/docs/db/crm/) |
| `payments` | [schema.sql](payments/schema.sql) | [dev](http://localhost:8080/docs/db/payments/) · [prod](https://crm.swerky.dev/docs/db/payments/) |

## How it is kept current

`scripts/quality/generate-db-schema.mjs` applies every committed migration to an empty
PostgreSQL database, exports the schema with `pg_dump`, and runs the Liam CLI. The `pre-commit`
hook runs it whenever a migration changes and stages the result; CI re-runs it against a
disposable database and fails on drift.

```sh
npm run quality:db-schema              # uses the running dev postgres
npm run quality:db-schema -- --clean   # uses a disposable container
```
