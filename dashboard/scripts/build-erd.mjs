// Build the Liam ERD single-page apps that the gateway serves at `/docs/db/<name>/`.
//
// Reads each committed `../docs/db/<name>/schema.sql` and writes the SPA into
// `public/docs/db/<name>/` (git-ignored). No database is touched — the SQL
// snapshots are the input. Run from the `dashboard/` directory:
//
//   npm run erd:build
//
// The Dockerfile runs this before `vite build` so the production image ships the
// ERDs. Keep the pinned CLI version in step with
// `scripts/quality/db-schema/config.mjs`.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LIAM_CLI = '@liam-hq/cli@0.7.24'
const DOCS_DIR = join('..', 'docs', 'db')
const OUT_DIR = join('public', 'docs', 'db')

if (!existsSync(DOCS_DIR)) {
  console.error(`No schema snapshots at ${DOCS_DIR}. Run \`npm run quality:db-schema\` in the repo root first.`)
  process.exit(1)
}

const databases = readdirSync(DOCS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(DOCS_DIR, entry.name, 'schema.sql')))
  .map((entry) => entry.name)

if (databases.length === 0) {
  console.error(`No <name>/schema.sql files under ${DOCS_DIR}.`)
  process.exit(1)
}

for (const name of databases) {
  console.log(`• building ERD for ${name}`)
  execFileSync(
    'npx',
    [
      '--yes',
      LIAM_CLI,
      'erd',
      'build',
      '--input',
      join(DOCS_DIR, name, 'schema.sql'),
      '--format',
      'postgres',
      '--output-dir',
      join(OUT_DIR, name),
    ],
    { stdio: 'inherit' },
  )
}

console.log(`Done — ${databases.length} ERD(s) in ${OUT_DIR}/`)
