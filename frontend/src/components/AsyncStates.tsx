/**
 * Reusable loading and error presentation components.
 */

/** Inline loading indicator announced to assistive technology. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <p role="status">{label}</p>
}

/** Inline error message announced to assistive technology. */
export function ErrorState({ message }: { message: string }) {
  return <p role="alert">{message}</p>
}
