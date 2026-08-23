import process from 'node:process'

import { classifyFiles } from './project-map.mjs'
import { stagedFiles, rangeFiles } from './git-files.mjs'
import { run } from './run.mjs'

const mode = process.argv[2] ?? '--staged'
const files = mode === '--range' ? rangeFiles(process.argv[3], process.argv[4]) : stagedFiles()
const selection = classifyFiles(files)

console.log(`Changed files: ${files.length}; projects: ${selection.projects.join(', ') || 'none'}`)

if (selection.projects.includes('server')) {
  run('composer', ['validate', '--strict', '--no-check-publish'], { cwd: 'server' })
  run('./vendor/bin/pint', ['--test'], { cwd: 'server' })
  run('composer', ['quality:insights'], { cwd: 'server' })
  run('composer', ['test'], { cwd: 'server' })
}

if (selection.projects.includes('dashboard')) {
  run('npm', ['run', 'api:validate'], { cwd: 'dashboard' })
  run('npm', ['run', 'api:check'], { cwd: 'dashboard' })
  run('npm', ['run', 'lint'], { cwd: 'dashboard' })
  run('npm', ['run', 'typecheck'], { cwd: 'dashboard' })
  run('npm', ['run', 'test'], { cwd: 'dashboard' })
}

if (selection.projects.includes('payments')) {
  run('npm', ['run', 'lint:check'], { cwd: 'payment-server' })
  run('npm', ['run', 'test'], { cwd: 'payment-server' })
}

if (selection.docker) run('npm', ['run', 'quality:docker'])
