import path from 'node:path'

export const projectNames = ['crm', 'dashboard', 'payments']

const rootFiles = new Set([
  '.dockerignore',
  '.env.docker.example',
  'docker-compose.yml',
  'docker-compose.dev.yml',
  'package.json',
  'package-lock.json',
])

const matches = (file, prefix) => file === prefix || file.startsWith(`${prefix}/`)

export function classifyFiles(files) {
  const normalized = files.filter(Boolean).map((file) => file.replace(/^\.\//, ''))
  const projects = new Set()
  let docker = false
  let api = false
  let all = false
  let dbSchema = false

  for (const file of normalized) {
    if (matches(file, 'crm-server') || matches(file, 'docker/crm-server')) projects.add('crm')
    if (matches(file, 'dashboard') || matches(file, 'docs/openapi') || matches(file, 'docker/dashboard')) projects.add('dashboard')
    if (matches(file, 'payment-server') || matches(file, 'docker/payment-server')) projects.add('payments')
    if (
      rootFiles.has(file) ||
      matches(file, 'docker/nginx') ||
      matches(file, 'docker/postgres') ||
      matches(file, 'docker/redis') ||
      matches(file, 'docker')
    ) docker = true
    if (
      matches(file, 'docs/openapi') ||
      matches(file, 'dashboard/scripts') ||
      file === 'dashboard/public/openapi.json' ||
      matches(file, 'dashboard/src/api/generated') ||
      matches(file, 'crm-server/routes/api') ||
      matches(file, 'crm-server/app/Http')
    ) api = true
    if (file.startsWith('.github/') || file.startsWith('scripts/quality/') || file === 'commitlint.config.cjs') all = true
    if (
      matches(file, 'crm-server/database/migrations') ||
      matches(file, 'payment-server/src/database/migrations') ||
      file === 'payment-server/src/database/data-source.ts' ||
      matches(file, 'scripts/quality/db-schema') ||
      file === 'scripts/quality/generate-db-schema.mjs' ||
      matches(file, 'docs/db')
    ) dbSchema = true
  }

  if (all) {
    projectNames.forEach((project) => projects.add(project))
    dbSchema = true
  }
  return { files: normalized, projects: [...projects], docker, api, all, dbSchema }
}

export function changedFilesFromGit(output) {
  return output.trim() ? output.trim().split(/\r?\n/).filter(Boolean) : []
}

const manifestEcosystems = [
  [/(^|\/)package\.json$/, 'npm'],
  [/(^|\/)composer\.json$/, 'composer'],
  [/(^|\/)Dockerfile(\.[\w-]+)?$/, 'docker'],
  [/^\.github\/workflows\/[^/]+\.ya?ml$/, 'github-actions'],
]

// ponytail: line-based read of dependabot.yml; switch to the yaml package if the config grows anchors or flow lists
export function dependabotEntries(config) {
  const entries = new Set()
  let ecosystem
  for (const line of config.split(/\r?\n/)) {
    const ecosystemMatch = line.match(/^\s*-\s*package-ecosystem:\s*['"]?([\w-]+)/)
    if (ecosystemMatch) ecosystem = ecosystemMatch[1]
    const directoryMatch = line.match(/^\s*directory:\s*['"]?([^'"\s#]+)/)
    if (directoryMatch && ecosystem) entries.add(`${ecosystem}:${directoryMatch[1].replace(/\/$/, '') || '/'}`)
  }
  return entries
}

export function dependabotCoverageGaps(config, files) {
  const covered = dependabotEntries(config)
  const gaps = new Set()
  for (const file of files) {
    // ponytail: dot-directories other than .github hold vendored agent tooling, not shipped code
    if (/^\.(?!github\/)/.test(file)) continue
    for (const [pattern, ecosystem] of manifestEcosystems) {
      if (!pattern.test(file)) continue
      const directory = ecosystem === 'github-actions' ? '/' : `/${path.posix.dirname(file)}`.replace(/^\/\.$/, '/')
      if (!covered.has(`${ecosystem}:${directory}`)) gaps.add(`${ecosystem}:${directory}`)
    }
  }
  return [...gaps]
}
