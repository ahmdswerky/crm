import { execFileSync } from 'node:child_process'

import { stagedFiles } from './git-files.mjs'
import { classifyFiles } from './project-map.mjs'

console.log('Generating API documentation...')
execFileSync('npm', ['run', 'api:docs'], {
  cwd: 'dashboard',
  stdio: 'inherit',
})

execFileSync('git', ['add', '--', 'dashboard/public/openapi.json'], {
  stdio: 'inherit',
})

const files = stagedFiles()
const yellow = '\u001b[33m'
const reset = '\u001b[0m'

if (files.length > 20) {
  const message = `Warning: this commit contains ${files.length} staged files. Consider splitting it into a smaller feature or fix.`
  console.warn(`${yellow}${message}${reset}`)
  console.warn(`::warning title=Large commit::${message}`)
}

if (classifyFiles(files).dbSchema) {
  console.log('Regenerating database schema and ERDs...')
  execFileSync('node', ['scripts/quality/generate-db-schema.mjs'], { stdio: 'inherit' })
  execFileSync('git', ['add', '--', 'docs/db'], { stdio: 'inherit' })
}

execFileSync('npm', ['exec', '--', 'lint-staged', '--config', 'lint-staged.config.mjs'], { stdio: 'inherit' })
execFileSync('node', ['scripts/quality/check-projects.mjs', '--staged'], { stdio: 'inherit' })
