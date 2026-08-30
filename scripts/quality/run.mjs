import { spawnSync } from 'node:child_process'

export function run(command, args = [], options = {}) {
  const stdio = options.capture
    ? ['ignore', 'pipe', 'pipe']
    : options.input != null
      ? ['pipe', 'inherit', 'inherit']
      : 'inherit'
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    input: options.input,
    stdio,
  })

  if (result.error) throw result.error
  if (options.capture) return result
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result
}

export function runCapture(command, args = [], options = {}) {
  return run(command, args, { ...options, capture: true })
}
