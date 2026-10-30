/**
 * Accessible, controlled form controls shared across feature forms.
 *
 * A field can carry a permanent `description` (a hint) and an `error` (a
 * validation failure). Both are linked to the input through `aria-describedby`
 * so assistive technology reads them with the field; only an `error` marks the
 * field `aria-invalid`, because a hint is not a failure.
 *
 * The label text lives in its own element and the messages sit outside it. If
 * the messages were inside the label, a screen reader would announce them as
 * part of the field's name ("Quantity Quantity must be a number") instead of as
 * its description.
 */

/** Ids of the hint and error elements a field is described by, in reading order. */
function describedBy(
  descriptionId: string | undefined,
  errorId: string | undefined,
): string | undefined {
  const ids = [descriptionId, errorId].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

/** Derive the hint and error element ids for a field. */
function messageIds(id: string, hasDescription: boolean, hasError: boolean) {
  return {
    descriptionId: hasDescription ? `${id}-description` : undefined,
    errorId: hasError ? `${id}-error` : undefined,
  }
}

export interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
  /** Permanent hint shown under the field and linked to it. */
  description?: string
  /** Validation failure; marks the field invalid and is linked to it. */
  error?: string
}

/** Labeled single-line text input. */
export function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  description,
  error,
}: TextFieldProps) {
  const { descriptionId, errorId } = messageIds(id, description !== undefined, error !== undefined)

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[#bcc9cd] font-mono">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(descriptionId, errorId)}
        className="w-full px-3 py-2 rounded-lg bg-[#1c2028] border border-[#3d494c]/60 text-white placeholder-[#869397] focus:outline-none focus:border-[#4cd7f6] focus:ring-1 focus:ring-[#4cd7f6] transition-all text-sm"
      />
      {description !== undefined ? (
        <span id={descriptionId} className="block text-xs text-[#869397]">
          {description}
        </span>
      ) : null}
      {error !== undefined ? (
        <span id={errorId} className="block text-xs text-[#ffb4ab] font-mono">
          {error}
        </span>
      ) : null}
    </div>
  )
}

export interface TextAreaFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  /** Permanent hint shown under the field and linked to it. */
  description?: string
  /** Validation failure; marks the field invalid and is linked to it. */
  error?: string
}

/** Labeled multi-line text input. */
export function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows = 3,
  description,
  error,
}: TextAreaFieldProps) {
  const { descriptionId, errorId } = messageIds(id, description !== undefined, error !== undefined)

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[#bcc9cd] font-mono">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(descriptionId, errorId)}
        className="w-full px-3 py-2 rounded-lg bg-[#1c2028] border border-[#3d494c]/60 text-white placeholder-[#869397] focus:outline-none focus:border-[#4cd7f6] focus:ring-1 focus:ring-[#4cd7f6] transition-all text-sm"
      />
      {description !== undefined ? (
        <span id={descriptionId} className="block text-xs text-[#869397]">
          {description}
        </span>
      ) : null}
      {error !== undefined ? (
        <span id={errorId} className="block text-xs text-[#ffb4ab] font-mono">
          {error}
        </span>
      ) : null}
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  id: string
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** Permanent hint shown under the field and linked to it. */
  description?: string
  /** Validation failure; marks the field invalid and is linked to it. */
  error?: string
}

/** Labeled native select. */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  description,
  error,
}: SelectFieldProps) {
  const { descriptionId, errorId } = messageIds(id, description !== undefined, error !== undefined)

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[#bcc9cd] font-mono">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy(descriptionId, errorId)}
        className="w-full px-3 py-2 rounded-lg bg-[#1c2028] border border-[#3d494c]/60 text-white focus:outline-none focus:border-[#4cd7f6] focus:ring-1 focus:ring-[#4cd7f6] transition-all text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description !== undefined ? (
        <span id={descriptionId} className="block text-xs text-[#869397]">
          {description}
        </span>
      ) : null}
      {error !== undefined ? (
        <span id={errorId} className="block text-xs text-[#ffb4ab] font-mono">
          {error}
        </span>
      ) : null}
    </div>
  )
}
