import process from 'node:process'

import { classifyFiles } from './project-map.mjs'
import { rangeFiles } from './git-files.mjs'
import { run } from './run.mjs'

const from = process.argv[2]
const to = process.argv[3]
const files = rangeFiles(from, to)
const selection = classifyFiles(files)

console.log(`Pushed files: ${files.length}; projects: ${selection.projects.join(', ') || 'none'}`)

if (selection.projects.includes('dashboard')) run('npm', ['run', 'build'], { cwd: 'dashboard' })
if (selection.projects.includes('payments')) run('npm', ['run', 'build'], { cwd: 'payment-server' })

run('npm', ['run', 'quality:docker'])

run('npm', ['run', 'api:docs:check'], { cwd: 'dashboard' })
run('npm', ['run', 'api:validate'], { cwd: 'dashboard' })
run('npm', ['run', 'api:check'], { cwd: 'dashboard' })
