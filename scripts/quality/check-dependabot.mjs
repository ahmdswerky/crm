import { readFileSync } from 'node:fs'
import process from 'node:process'

import { gitFiles, stagedFiles } from './git-files.mjs'
import { dependabotCoverageGaps } from './project-map.mjs'
import { run } from './run.mjs'

const gaps = dependabotCoverageGaps(readFileSync('.github/dependabot.yml', 'utf8'), gitFiles(['ls-files']))
if (gaps.length) {
  console.error('Dependabot does not watch these manifests. Add an entry to .github/dependabot.yml:')
  gaps.forEach((gap) => console.error(`  ${gap}`))
  process.exit(1)
}

// Same advisory gates as the CI security job, only for lockfiles in this commit.
const audits = [
  ['dashboard/package-lock.json', 'npm', ['audit', '--omit=dev', '--audit-level=high'], 'dashboard'],
  ['payment-server/package-lock.json', 'npm', ['audit', '--omit=dev', '--audit-level=high'], 'payment-server'],
  ['crm-server/composer.lock', 'composer', ['audit', '--locked', '--no-interaction'], 'crm-server'],
]
const staged = stagedFiles()
for (const [lockfile, command, args, cwd] of audits) {
  if (staged.includes(lockfile)) run(command, args, { cwd })
}
