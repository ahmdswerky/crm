import fs from 'node:fs'

import { run } from './run.mjs'

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

run('docker', ['compose', '-f', 'docker-compose.yml', 'config', '-q'])
const envFile = fs.existsSync('.env.docker') ? '.env.docker' : '.env.docker.example'
run('docker', ['compose', '--env-file', envFile, '-f', 'docker-compose.dev.yml', 'config', '-q'])
