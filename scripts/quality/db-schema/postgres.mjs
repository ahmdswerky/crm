// Resolve a PostgreSQL server to build the schema against:
//   - `reuse` : the running dev stack's postgres (fast; reflects local state)
//   - `clean` : a disposable container started just for this run (deterministic)

import { setTimeout as sleep } from 'node:timers/promises'

import { runCapture } from '../run.mjs'
import { DEV_POSTGRES, POSTGRES_IMAGE } from './config.mjs'

const PG_READY_ATTEMPTS = 30

function pgIsReady({ host, port, user }) {
  const result = runCapture('pg_isready', ['-h', host, '-p', String(port), '-U', user], {
    capture: true,
  })
  return result.status === 0
}

function psql(server, sql, { database = 'postgres' } = {}) {
  return runCapture(
    'psql',
    ['-h', server.host, '-p', String(server.port), '-U', server.user, '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atc', sql],
    { env: { PGPASSWORD: server.password }, capture: true },
  )
}

/** Recreate `database` on `server` so a run always starts from nothing. */
export function resetDatabase(server, database) {
  const drop = psql(server, `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
  if (drop.status !== 0) throw new Error(`Could not drop database ${database}:\n${drop.stderr}`)
  const create = psql(server, `CREATE DATABASE "${database}"`)
  if (create.status !== 0) throw new Error(`Could not create database ${database}:\n${create.stderr}`)
}

/**
 * @param {'reuse'|'clean'} mode
 * @returns {Promise<{server: import('./config.mjs').PgServer, dispose: () => void} | null>}
 *   `null` when `reuse` is asked for but the dev postgres is not reachable.
 */
export async function acquirePostgres(mode) {
  if (mode === 'reuse') {
    if (!pgIsReady(DEV_POSTGRES)) return null
    return { server: DEV_POSTGRES, dispose() {} }
  }

  const container = `crm-db-schema-${process.pid}`
  runCapture('docker', ['rm', '-f', container], { capture: true })
  const start = runCapture(
    'docker',
    ['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=liam', '-p', '127.0.0.1:0:5432', POSTGRES_IMAGE],
    { capture: true },
  )
  if (start.status !== 0) throw new Error(`Could not start a disposable postgres container:\n${start.stderr}`)

  const dispose = () => {
    runCapture('docker', ['rm', '-f', container], { capture: true })
  }

  try {
    const portLookup = runCapture('docker', ['port', container, '5432/tcp'], { capture: true })
    if (portLookup.status !== 0) throw new Error(`Could not read the container port:\n${portLookup.stderr}`)
    const port = Number(portLookup.stdout.trim().split(':').pop())
    const server = { host: '127.0.0.1', port, user: 'postgres', password: 'liam' }

    for (let attempt = 1; ; attempt += 1) {
      if (pgIsReady(server)) break
      if (attempt >= PG_READY_ATTEMPTS) throw new Error('Disposable postgres did not become ready in time.')
      await sleep(1000)
    }
    return { server, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
