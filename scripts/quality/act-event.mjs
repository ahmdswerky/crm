import { execFileSync } from 'node:child_process'

const run = (args, fallback = '') => {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch (error) {
    const stdout = error?.stdout?.toString().trim()
    if (stdout) return stdout
    return fallback
  }
}

const after = run(['rev-parse', 'HEAD'])
const before = run(['rev-parse', `${after}^`], '0000000000000000000000000000000000000000')
const branch = run(['branch', '--show-current'], 'act-local')
const remote = run(['config', '--get', 'remote.origin.url'], 'https://github.com/swerky/crm.git')
const repositoryPath = remote
  .replace(/^git@github\.com:/, '')
  .replace(/^https?:\/\/github\.com\//, '')
  .replace(/\.git$/, '')
const [owner = 'swerky', name = 'crm'] = repositoryPath.split('/')
const subject = run(['show', '-s', '--format=%s', after], 'Act local push')
const timestamp = run(['show', '-s', '--format=%cI', after], new Date().toISOString())
const authorName = run(['show', '-s', '--format=%an', after], 'act-local')
const authorEmail = run(['show', '-s', '--format=%ae', after], 'act-local@example.invalid')

const changedFiles = (filter) => {
  if (before.startsWith('0000')) return []
  return run(['diff-tree', '--no-commit-id', '--name-only', '-r', `--diff-filter=${filter}`, before, after])
    .split('\n')
    .filter(Boolean)
}

console.log(JSON.stringify({
  before,
  after,
  ref: `refs/heads/${branch}`,
  repository: {
    name,
    full_name: `${owner}/${name}`,
    default_branch: 'main',
    owner: { login: owner, name: owner },
  },
  pusher: { name: authorName, email: authorEmail },
  sender: { login: owner },
  commits: [{
    id: after,
    message: subject,
    timestamp,
    author: { name: authorName, email: authorEmail },
    committer: { name: authorName, email: authorEmail },
    added: changedFiles('A'),
    removed: changedFiles('D'),
    modified: changedFiles('M'),
  }],
}, null, 2))
