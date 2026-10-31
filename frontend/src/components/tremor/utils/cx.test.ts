import { describe, expect, it } from 'vitest'

import { cx } from './cx'

/**
 * Class-name merging contract for the vendored Tremor utilities.
 *
 * Tremor components append a caller's `className` to their own base classes, so
 * a caller must be able to override a base utility. A plain join leaves both
 * classes in the attribute and lets CSS source order decide the winner, which is
 * fragile; Tremor Raw resolves the conflict with `twMerge`. These tests pin that
 * behavior so an override stays an override.
 */
describe('cx', () => {
  it('keeps a conflicting later utility and drops the earlier one', () => {
    expect(cx('p-6', 'p-2')).toBe('p-2')
  })

  it('resolves conflicts across grouped arguments', () => {
    expect(cx('text-left shadow-xs', 'p-6', 'text-center')).toBe(
      'shadow-xs p-6 text-center',
    )
  })

  it('keeps utilities that do not conflict', () => {
    expect(cx('rounded-lg', 'border')).toBe('rounded-lg border')
  })

  it('drops falsy values', () => {
    expect(cx('rounded-lg', false, undefined, null, 'border')).toBe(
      'rounded-lg border',
    )
  })

  it('lets a caller override a component base class', () => {
    // How Card uses it: base padding followed by the caller's own.
    expect(cx('w-full rounded-lg border p-6', 'p-2')).toBe(
      'w-full rounded-lg border p-2',
    )
  })
})
