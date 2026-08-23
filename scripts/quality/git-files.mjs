import { execFileSync } from 'node:child_process'

import { changedFilesFromGit } from './project-map.mjs'

export function gitFiles(args) {
  const output = execFileSync('git', args, { encoding: 'utf8' })
  return changedFilesFromGit(output)
}

export function stagedFiles() {
  return gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
}

export function rangeFiles(from, to) {
  if (!from || !to) return []
  const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
  const base = /^0+$/.test(from) ? emptyTree : from
  return gitFiles(['diff', '--name-only', '--diff-filter=ACMR', `${base}..${to}`])
}
