import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Proves the Tailwind 4 toolchain actually compiles the classes the Tremor
 * components rely on, rather than merely being installed.
 *
 * A test asserting a `className` string would pass even if Tailwind emitted no
 * CSS at all. This one runs the real compiler over a source file that carries
 * Tremor's base classes and asserts the utility appears in the emitted output.
 * The probe lives under the frontend directory so the compiler resolves the
 * project's own `tailwindcss` install.
 */
function compileTailwind(input: string): string {
  const dir = mkdtempSync(join(process.cwd(), '.tw-probe-'))
  try {
    writeFileSync(join(dir, 'probe.html'), input)
    const entry = join(dir, 'probe.css')
    writeFileSync(entry, '@import "tailwindcss";')
    const out = join(dir, 'out.css')
    execFileSync('npx', ['@tailwindcss/cli', '-i', entry, '-o', out], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return execFileSync('cat', [out], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('Tailwind 4 toolchain', () => {
  it('emits the utility classes the Tremor Card uses', () => {
    const emitted = compileTailwind(
      '<div class="relative w-full rounded-lg border p-6 text-left shadow-xs"></div>',
    )

    expect(emitted).toContain('rounded-lg')
    expect(emitted).toContain('p-6')
    expect(emitted).toContain('border')
  }, 90_000)
})
