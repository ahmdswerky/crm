import { spawnSync } from 'node:child_process'

const yellow = '\u001b[33m'
const reset = '\u001b[0m'

function report(directory, command, args) {
  const result = spawnSync(command, args, {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30000,
    killSignal: 'SIGTERM',
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.error?.code === 'ETIMEDOUT') {
    const message = `Warning: dependency freshness check timed out in ${directory}.`
    console.warn(`${yellow}${message}${reset}`)
    console.warn(`::warning title=Dependency freshness timeout::${message}`)
    return
  }
  if (!output && result.status === 0) return
  if (result.status === 127) return

  let parsed
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    parsed = null
  }

  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.installed) ? parsed.installed : null
  const packages = items ?? (parsed && typeof parsed === 'object' ? Object.keys(parsed) : [])
  const details = items
    ? items.map((item) => `${item.name ?? 'unknown'}: ${item.version ?? item.current ?? '?'} -> ${item.latest ?? item.latestVersion ?? '?'}`)
    : Object.entries(parsed ?? {}).map(([name, item]) => {
        if (!item || typeof item !== 'object') return `${name}: ${String(item)}`
        return `${name}: ${item.current ?? item.version ?? '?'} -> ${item.latest ?? item.latestVersion ?? '?'}`
      })
  if (packages.length || result.status !== 0) {
    const message = `Warning: outdated dependencies detected in ${directory}.`
    console.warn(`${yellow}${message}${reset}`)
    console.warn(`::warning title=Outdated dependencies::${message}`)
    if (details.length) details.forEach((detail) => console.warn(`  ${detail}`))
    if (!details.length) console.warn(output || `command exited with status ${result.status}`)
  }
}

report('dashboard', 'npm', ['outdated', '--json'])
report('payment-server', 'npm', ['outdated', '--json'])
report('server', 'composer', ['outdated', '--direct', '--format=json', '--no-interaction'])
