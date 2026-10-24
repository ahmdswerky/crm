import assert from 'node:assert/strict'

import { classifyFiles, dependabotCoverageGaps } from './project-map.mjs'

const tests = [
  ['classifies only projects represented in the changed paths', () => {
  assert.deepEqual(classifyFiles(['dashboard/src/App.tsx']), {
    files: ['dashboard/src/App.tsx'],
    projects: ['dashboard'],
    docker: false,
    api: false,
    all: false,
    dbSchema: false,
  })
  }],

  ['flags database schema work from migration and generator paths', () => {
  assert.equal(classifyFiles(['crm-server/database/migrations/2026_01_01_000000_create_x.php']).dbSchema, true)
  assert.equal(classifyFiles(['payment-server/src/database/migrations/1700000000000-Add.ts']).dbSchema, true)
  assert.equal(classifyFiles(['scripts/quality/db-schema/dump.mjs']).dbSchema, true)
  assert.equal(classifyFiles(['dashboard/src/App.tsx']).dbSchema, false)
  }],

  ['classifies API and Docker changes without inventing unrelated projects', () => {
  const result = classifyFiles(['crm-server/routes/api/v1/leads.php', 'docker/nginx/nginx.conf'])
  assert.deepEqual(result.projects, ['crm'])
  assert.equal(result.api, true)
  assert.equal(result.docker, true)
  }],

  ['quality tooling changes run all project checks', () => {
  const result = classifyFiles(['scripts/quality/check-projects.mjs'])
  assert.deepEqual(result.projects, ['crm', 'dashboard', 'payments'])
  assert.equal(result.all, true)
  }],

  ['reports manifests that dependabot.yml does not watch', () => {
  const config = [
    'updates:',
    '  - package-ecosystem: npm',
    '    directory: /',
    '  - package-ecosystem: docker',
    '    directory: "/docker/dashboard"',
  ].join('\n')
  assert.deepEqual(dependabotCoverageGaps(config, [
    'package.json',
    'docker/dashboard/Dockerfile.dev',
    'payment-server/package.json',
    'crm-server/composer.json',
    '.github/workflows/ci.yml',
    '.agents/skills/archify/package.json',
  ]), ['npm:/payment-server', 'composer:/crm-server', 'github-actions:/'])
  }],
]

for (const [name, check] of tests) {
  check()
  console.log(`PASS ${name}`)
}

console.log(`${tests.length} quality dispatcher tests passed.`)
