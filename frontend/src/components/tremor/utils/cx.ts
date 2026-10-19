/**
 * Vendored from Tremor Raw.
 *
 * Joins truthy class name fragments into a single class string.
 */
export function cx(...args: (string | undefined | null | false)[]): string {
  return args.filter(Boolean).join(' ')
}
