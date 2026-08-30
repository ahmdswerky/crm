// Build a Liam ERD single-page app from a schema SQL file and return the parsed
// `schema.json` it produced.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { runCapture } from '../run.mjs'
import { LIAM_CLI } from './config.mjs'

/**
 * @param {string} sqlPath   schema SQL file to parse
 * @param {string} outputDir directory to write the SPA into
 * @returns {string} contents of the generated `schema.json`
 */
export function buildErd(sqlPath, outputDir) {
  const result = runCapture(
    'npx',
    ['--yes', LIAM_CLI, 'erd', 'build', '--input', sqlPath, '--format', 'postgres', '--output-dir', outputDir],
    { capture: true },
  )
  if (result.status !== 0) {
    throw new Error(`Liam \`erd build\` failed for ${sqlPath}:\n${result.stdout}\n${result.stderr}`)
  }
  return readFileSync(join(outputDir, 'schema.json'), 'utf8')
}
