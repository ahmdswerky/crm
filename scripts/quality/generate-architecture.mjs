#!/usr/bin/env node
// On-demand: have Codex author the archify IR (dev + prod infra) from repo
// evidence, render the pages, then publish the whole docs/architecture/ tree
// under dashboard/public/ so nginx serves the viewer shell at /docs/architecture/.
// Local only — never wired to a hook or CI.
//
//   npm run docs:architecture                  full run — one Codex pass per env
//   npm run docs:architecture -- --env dev       regenerate just the dev set
//   npm run docs:architecture -- --dry-run       print the assembled prompt(s), no Codex
//   npm run docs:architecture -- --publish-only   re-validate + re-copy existing IR/pages
//   SKIP_ARCHIFY=1 npm run docs:architecture     no-op (parity with other quality scripts)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { run, runCapture } from './run.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const archify = ['.agents/skills/archify/bin/archify.mjs']
const docsDir = 'docs/architecture'
const publicDir = 'dashboard/public/docs/architecture'
const REPO_URL = 'https://github.com/ahmdswerky/crm'
const TYPES = ['architecture', 'workflow', 'sequence']

const ENV_CONFIG = {
  dev: {
    COMPOSE: 'docker-compose.dev.yml',
    BASE_URL: 'http://localhost:8080',
    NGINX: 'docker/nginx/nginx.dev.conf',
    ENV_NOTES:
      'Dev exposes Laravel Telescope and Horizon through the gateway ' +
      '(see the /(telescope|horizon) location in the nginx config). Services ' +
      'generally run a single replica. Postgres is published on 127.0.0.1:15432.',
  },
  prod: {
    COMPOSE: 'docker-compose.yml',
    BASE_URL: 'https://crm.swerky.dev',
    NGINX: 'docker/nginx/nginx.conf',
    ENV_NOTES:
      'Production sits behind Cloudflare -> a host/Podman NGINX gateway ' +
      '(docker/nginx/vps-site.example.conf) -> the compose gateway on ' +
      '127.0.0.1:8080. The dashboard and both API planes run 2 replicas. ' +
      'Telescope/Horizon are NOT exposed. No published Postgres port.',
  },
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const publishOnly = args.includes('--publish-only')
const envArg = args[args.indexOf('--env') + 1]
const envs = args.includes('--env') ? [envArg] : ['dev', 'prod']

if (!envs.every((e) => ENV_CONFIG[e])) {
  console.error(`--env must be one of: ${Object.keys(ENV_CONFIG).join(', ')}`)
  process.exit(1)
}

if (process.env.SKIP_ARCHIFY === '1') {
  console.log('SKIP_ARCHIFY=1 — skipping architecture generation.')
  process.exit(0)
}

const rev = runCapture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).stdout.trim()
const template = fs.readFileSync(path.join(here, 'architecture/prompt.md'), 'utf8')

const buildPrompt = (env) => {
  const c = ENV_CONFIG[env]
  return template
    .replaceAll('<ENV>', env)
    .replaceAll('<COMPOSE>', c.COMPOSE)
    .replaceAll('<BASE_URL>', c.BASE_URL)
    .replaceAll('<NGINX>', c.NGINX)
    .replaceAll('<ENV_NOTES>', c.ENV_NOTES)
    .replaceAll('<REPO_SHA>', rev)
    .replaceAll('<REPO_URL>', REPO_URL)
}

if (dryRun) {
  for (const env of envs) console.log(`\n=================== ${env} ===================\n${buildPrompt(env)}`)
  process.exit(0)
}

fs.mkdirSync(path.join(repoRoot, docsDir), { recursive: true })

if (!publishOnly) {
  for (const env of envs) {
    console.log(`\n>>> Codex: authoring ${env} diagrams\n`)
    const fence = `${docsDir}/${env}/`
    const dirtyBefore = gitDirty()

    // model + reasoning pinned so the run is reproducible regardless of local
    // ~/.codex/config.toml drift. --approve-for-me runs autonomously in a
    // workspace-write sandbox; the prompt fences edits to docs/architecture/<env>/
    // and the check below aborts on strays.
    run('codex', [
      'exec',
      '--model', 'gpt-5.6-terra',
      '-c', 'model_reasoning_effort=high',
      '--approve-for-me',
      '--cd', repoRoot,
      '-',
    ], { cwd: repoRoot, input: buildPrompt(env) })

    const strayed = gitDirty().filter((f) => !dirtyBefore.includes(f) && !f.startsWith(fence))
    if (strayed.length) {
      console.error(`\nCodex (${env}) modified files outside ${fence}:\n  ${strayed.join('\n  ')}`)
      console.error('Review and revert those before trusting this run.')
      process.exit(1)
    }
  }
}

// Independent re-validation of every IR (the script gate, not Codex's word).
// architecture is the only type that takes --repo-root.
for (const env of envs) {
  for (const type of TYPES) {
    const p = `${docsDir}/${env}/${type}.json`
    if (!fs.existsSync(path.join(repoRoot, p))) {
      console.error(`Missing ${p} — not produced.`)
      process.exit(1)
    }
    const rootArgs = type === 'architecture' ? ['--repo-root', repoRoot] : []
    run('node', [...archify, 'validate', type, p, '--quality', 'showcase', ...rootArgs], { cwd: repoRoot })
  }
}

// Publish: mirror the whole docs/architecture/ tree (shell + dev/ + prod/) into
// dashboard/public so Vite -> nginx serves it at /docs/architecture/.
fs.rmSync(path.join(repoRoot, publicDir), { recursive: true, force: true })
fs.cpSync(path.join(repoRoot, docsDir), path.join(repoRoot, publicDir), {
  recursive: true,
  filter: (src) => !src.endsWith('README.md'),
})

console.log(`
Architecture viewer refreshed. Review the diff, then commit.
  dev :  http://localhost:8080/docs/architecture/
  prod:  https://crm.swerky.dev/docs/architecture/
Standalone pages: /docs/architecture/{dev,prod}/{architecture,workflow,sequence}.html
`)

function gitDirty() {
  return runCapture('git', ['status', '--porcelain'], { cwd: repoRoot })
    .stdout.split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3))
}
