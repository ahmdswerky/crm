import assert from 'node:assert/strict'

import { classifyFiles } from './project-map.mjs'

const tests = [
  ['classifies only projects represented in the changed paths', () => {
  assert.deepEqual(classifyFiles(['dashboard/src/App.tsx']), {
    files: ['dashboard/src/App.tsx'],
    projects: ['dashboard'],
    docker: false,
    api: false,
    all: false,
  })
  }],

  ['classifies API and Docker changes without inventing unrelated projects', () => {
  const result = classifyFiles(['server/routes/api/v1/leads.php', 'docker/nginx/nginx.conf'])
  assert.deepEqual(result.projects, ['server'])
  assert.equal(result.api, true)
  assert.equal(result.docker, true)
  }],

  ['quality tooling changes run all project checks', () => {
  const result = classifyFiles(['scripts/quality/check-projects.mjs'])
  assert.deepEqual(result.projects, ['server', 'dashboard', 'payments'])
  assert.equal(result.all, true)
  }],
]

for (const [name, check] of tests) {
  check()
  console.log(`PASS ${name}`)
}

console.log(`${tests.length} quality dispatcher tests passed.`)
