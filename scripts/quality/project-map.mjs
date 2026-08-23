export const projectNames = ['server', 'dashboard', 'payments']

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

  for (const file of normalized) {
    if (matches(file, 'server') || matches(file, 'docker/crm-server')) projects.add('server')
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
      matches(file, 'server/routes/api') ||
      matches(file, 'server/app/Http')
    ) api = true
    if (file.startsWith('.github/') || file.startsWith('scripts/quality/') || file === 'commitlint.config.cjs') all = true
  }

  if (all) projectNames.forEach((project) => projects.add(project))
  return { files: normalized, projects: [...projects], docker, api, all }
}

export function changedFilesFromGit(output) {
  return output.trim() ? output.trim().split(/\r?\n/).filter(Boolean) : []
}
