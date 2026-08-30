// Apply a project's committed migrations to a freshly created database.

import { runCapture } from '../run.mjs'

/** @param {import('./config.mjs').PgServer} server */
function laravel(server, database) {
  const result = runCapture('php', ['artisan', 'migrate', '--force', '--no-interaction'], {
    cwd: 'server',
    capture: true,
    env: {
      DB_CONNECTION: 'pgsql',
      DB_HOST: server.host,
      DB_PORT: String(server.port),
      DB_DATABASE: database,
      DB_USERNAME: server.user,
      DB_PASSWORD: server.password,
      // Never touch the developer's real cache/session store during a dump.
      CACHE_STORE: 'array',
      SESSION_DRIVER: 'array',
      QUEUE_CONNECTION: 'sync',
    },
  })
  if (result.status !== 0) {
    throw new Error(`\`php artisan migrate\` failed for ${database}:\n${result.stdout}\n${result.stderr}`)
  }
}

/** @param {import('./config.mjs').PgServer} server */
function typeorm(server, database) {
  const result = runCapture(
    'node',
    ['-r', 'ts-node/register', './node_modules/typeorm/cli.js', 'migration:run', '-d', 'src/database/data-source.ts'],
    {
      cwd: 'payment-server',
      capture: true,
      env: {
        PAYMENTS_DB_HOST: server.host,
        PAYMENTS_DB_PORT: String(server.port),
        PAYMENTS_DB_USER: server.user,
        PAYMENTS_DB_PASSWORD: server.password,
        PAYMENTS_DB_NAME: database,
        TS_NODE_TRANSPILE_ONLY: '1',
        TS_NODE_COMPILER_OPTIONS: '{"module":"node16","moduleResolution":"node16"}',
      },
    },
  )
  if (result.status !== 0) {
    throw new Error(`TypeORM \`migration:run\` failed for ${database}:\n${result.stdout}\n${result.stderr}`)
  }
}

/** @param {import('./config.mjs').PgServer} server */
export function applyMigrations(db, server) {
  if (db.kind === 'laravel') return laravel(server, db.database)
  if (db.kind === 'typeorm') return typeorm(server, db.database)
  throw new Error(`Unknown migration kind: ${db.kind}`)
}
