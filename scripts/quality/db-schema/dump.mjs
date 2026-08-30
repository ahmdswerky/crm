// Export one database schema as normalised PostgreSQL DDL.

import { runCapture } from '../run.mjs'

// Lines that change between otherwise identical dumps (tool versions, the
// per-dump `\restrict` nonce). Removing them keeps the committed file stable so
// a diff means the schema really changed.
const VOLATILE_LINE = /^(--\s*Dumped (from|by)\b|\\(un)?restrict\b)/

function normalise(sql) {
  const lines = sql.split('\n').filter((line) => !VOLATILE_LINE.test(line))
  // Collapse the blank-line run the stripped header leaves behind.
  return lines.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n')
}

/** @param {import('./config.mjs').PgServer} server */
export function dumpSchema(server, database) {
  const result = runCapture(
    'pg_dump',
    [
      '-h', server.host,
      '-p', String(server.port),
      '-U', server.user,
      '-d', database,
      '--schema-only',
      '--no-owner',
      '--no-privileges',
    ],
    { env: { PGPASSWORD: server.password }, capture: true },
  )
  if (result.status !== 0) throw new Error(`pg_dump failed for ${database}:\n${result.stderr}`)
  return `${normalise(result.stdout).trimEnd()}\n`
}
