// Tremor cx [v0.0.0]
// Vendored into this repository from Tremor Raw. See openspec change
// frontend-tremor-redesign, decision D1.

import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Join class names and resolve Tailwind utility conflicts.
 *
 * `clsx` handles conditionals and falsy values; `twMerge` keeps the last utility
 * of each conflicting group, so a caller's `className` overrides a component's
 * base class instead of relying on CSS source order.
 */
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}
