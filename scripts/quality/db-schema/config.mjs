// Shared configuration for the database schema / ERD generator.
//
// The generator applies every committed migration to a throwaway (or the
// running dev) PostgreSQL server, exports each schema with `pg_dump`, and feeds
// the dumps to the Liam ERD CLI. See `docs/db/README.md`.

// Pinned so the generated `schema.json` stays reproducible. Bump deliberately.
export const LIAM_CLI = '@liam-hq/cli@0.7.24'

// Same digest-pinned image the compose files use, so a `--clean` run matches
// the real dev/prod engine.
export const POSTGRES_IMAGE =
  'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'

// Committed, human-diffable artifacts.
export const DOCS_DIR = 'docs/db'
// Built Liam single-page app; git-ignored, served at `/docs/db/<name>/`.
export const SPA_DIR = 'dashboard/public/docs/db'

// The running dev stack publishes PostgreSQL here (docker-compose.dev.yml).
export const DEV_POSTGRES = {
  host: process.env.DB_SCHEMA_PG_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_SCHEMA_PG_PORT ?? 15432),
  user: process.env.DB_SCHEMA_PG_USER ?? 'postgres',
  password: process.env.DB_SCHEMA_PG_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? 'postgres-dev-password',
}

// Paths whose change means the committed schema might be stale.
export const TRIGGER_PATHS = [
  'crm-server/database/migrations',
  'payment-server/src/database/migrations',
  'payment-server/src/database/data-source.ts',
  'scripts/quality/db-schema',
  'scripts/quality/generate-db-schema.mjs',
  'docs/db',
]

/** @typedef {{host:string,port:number,user:string,password:string}} PgServer */

// A throwaway database name, never a real application database — the generator
// drops and recreates it on every run, so it must not be the dev `crm` /
// `payments` database when the dev postgres container is reused.
const scratch = (name) => `${name}_schema_gen`

export const DATABASES = [
  {
    name: 'crm',
    database: scratch('crm'),
    // Laravel migrations, applied with `php artisan migrate`.
    kind: 'laravel',
    cwd: 'crm-server',
    urls: {
      dev: 'http://localhost:8080/docs/db/crm/',
      prod: 'https://crm.swerky.dev/docs/db/crm/',
    },
  },
  {
    name: 'payments',
    database: scratch('payments'),
    // TypeORM migrations, applied with the typeorm CLI via ts-node.
    kind: 'typeorm',
    cwd: 'payment-server',
    urls: {
      dev: 'http://localhost:8080/docs/db/payments/',
      prod: 'https://crm.swerky.dev/docs/db/payments/',
    },
  },
]
