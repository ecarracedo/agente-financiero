/**
 * Accessible, controlled form controls shared across feature forms.
 */

export interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
}

/** Labeled single-line text input. */
export function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
}: TextFieldProps) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export interface TextAreaFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}

/** Labeled multi-line text input. */
export function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows = 3,
}: TextAreaFieldProps) {
  return (
    <label htmlFor={id}>
      {label}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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
}

/** Labeled native select. */
export function SelectField({ id, label, value, options, onChange }: SelectFieldProps) {
  return (
    <label htmlFor={id}>
      {label}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
