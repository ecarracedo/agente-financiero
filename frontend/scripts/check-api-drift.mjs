/**
 * Verify that the generated API types still match the committed OpenAPI snapshot.
 *
 * Regenerates `src/api/types.ts` from `openapi.json` into a temporary file and
 * compares the two byte for byte. Exits non-zero on any difference, so CI and
 * local runs fail loudly instead of letting the types drift from the snapshot.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const projectRoot = process.cwd()
const committedTypes = join(projectRoot, 'src', 'api', 'types.ts')
const snapshot = join(projectRoot, 'openapi.json')
const binary = join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'openapi-typescript.cmd' : 'openapi-typescript',
)

const scratch = mkdtempSync(join(tmpdir(), 'api-drift-'))

try {
  const regenerated = join(scratch, 'types.ts')
  execFileSync(binary, [snapshot, '-o', regenerated], { stdio: 'inherit' })

  const expected = readFileSync(committedTypes, 'utf8')
  const actual = readFileSync(regenerated, 'utf8')

  if (expected !== actual) {
    console.error(
      'API drift detected: src/api/types.ts does not match openapi.json.\n' +
        'Run `npm run generate:api` and commit the regenerated file.',
    )
    process.exit(1)
  }

  console.log('API drift check passed: generated types match openapi.json.')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
