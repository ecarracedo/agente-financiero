/**
 * The four view states a data view renders: loading, empty, error and success.
 *
 * Each is its own element with its own accessible role, so a screen reader can
 * tell them apart without relying on the wording:
 *
 * - `LoadingState` and `SuccessState` are polite announcements (`role="status"`).
 *   Both are transient and a caller renders one or the other, never both, so the
 *   shared role is correct rather than ambiguous.
 * - `ErrorState` is assertive (`role="alert"`).
 * - `EmptyState` is neither: it is a settled state, not an event, so it carries
 *   no live role and a view that shows it is never also loading.
 *
 * The empty message is required, because the spec asks for a state specific to
 * the view ("no holdings yet", "no wishlist entries") rather than one generic
 * string reused everywhere.
 */

/** Inline loading indicator announced to assistive technology. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="text-xs font-mono text-[#4cd7f6] flex items-center gap-2 py-2">
      <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-ping" />
      <span>{label}</span>
    </p>
  )
}

/**
 * Settled empty state for a view that has no records.
 *
 * Carries no live role: it is the result of a finished load, so announcing it as
 * a status would report an event that never happened.
 */
export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-[#869397] font-mono py-6 text-center">{message}</p>
}

/** Inline error message announced to assistive technology. */
export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-[#ffb4ab] font-mono">
      {message}
    </p>
  )
}

/**
 * Scoped success confirmation for an action that just completed.
 *
 * The caller owns its lifetime: it is cleared when the next action starts or the
 * user navigates, so a stale message never outlives the action it describes.
 */
export function SuccessState({ message }: { message: string }) {
  return (
    <p role="status" className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-[#46fa9c] font-mono">
      {message}
    </p>
  )
}
