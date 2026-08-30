import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { run, runCapture } from './run.mjs'

const requiredFiles = [
  'docker-compose.yml',
  'docker-compose.dev.yml',
  'docker/crm-server/Dockerfile',
  'docker/dashboard/Dockerfile',
  'docker/payment-server/Dockerfile',
  'docker/nginx/nginx.conf',
  'docker/postgres/postgresql.conf',
  'docker/redis/redis.conf',
]

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Missing Docker structure file: ${file}`)
    process.exit(1)
  }
}

const productionCompose = fs.readFileSync('docker-compose.yml', 'utf8')
// Podman Compose needs the file-mode string, while Docker Compose's schema requires an integer.
const dockerProductionCompose = productionCompose.replaceAll('mode: "0777"', 'mode: 511')

if (dockerProductionCompose === productionCompose) {
  run('docker', ['compose', '-f', 'docker-compose.yml', 'config', '-q'])
} else {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-compose-validation-'))
  const temporaryCompose = path.join(temporaryDirectory, 'docker-compose.yml')
  fs.writeFileSync(temporaryCompose, dockerProductionCompose)

  let status = 0

  try {
    const result = runCapture('docker', [
      'compose',
      '--project-directory',
      process.cwd(),
      '-f',
      temporaryCompose,
      'config',
      '-q',
    ])

    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')

    status = result.status ?? 1
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true })
  }

  if (status !== 0) process.exit(status)
}

const envFile = fs.existsSync('.env.docker') ? '.env.docker' : '.env.docker.example'
run('docker', ['compose', '--env-file', envFile, '-f', 'docker-compose.dev.yml', 'config', '-q'])
