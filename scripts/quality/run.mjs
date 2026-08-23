import { spawnSync } from 'node:child_process'

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.error) throw result.error
  if (options.capture) return result
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result
}

export function runCapture(command, args = [], options = {}) {
  return run(command, args, { ...options, capture: true })
}
