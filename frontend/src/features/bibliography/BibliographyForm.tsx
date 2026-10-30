/**
 * Controlled form for creating a bibliography resource.
 */

import type { FormEvent } from 'react'

import { TextAreaField, TextField } from '../../components/FormControls'

/** Editable bibliography form fields, all held as strings. */
export interface BibliographyFormValues {
  title: string
  author: string
  year: string
  category: string
  link: string
  description: string
}

export interface BibliographyFormProps {
  values: BibliographyFormValues
  submitting: boolean
  onChange: (field: keyof BibliographyFormValues, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

/** Render the title/author/optional-metadata inputs and the create action. */
export function BibliographyForm({
  values,
  submitting,
  onChange,
  onSubmit,
}: BibliographyFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="bibliography-title"
          label="Title"
          value={values.title}
          onChange={(value) => onChange('title', value)}
        />
        <TextField
          id="bibliography-author"
          label="Author"
          value={values.author}
          onChange={(value) => onChange('author', value)}
        />
        <TextField
          id="bibliography-year"
          label="Year"
          value={values.year}
          onChange={(value) => onChange('year', value)}
          inputMode="numeric"
        />
        <TextField
          id="bibliography-category"
          label="Category"
          value={values.category}
          onChange={(value) => onChange('category', value)}
        />
        <div className="md:col-span-2">
          <TextField
            id="bibliography-link"
            label="Link"
            value={values.link}
            onChange={(value) => onChange('link', value)}
          />
        </div>
        <div className="md:col-span-2">
          <TextAreaField
            id="bibliography-description"
            label="Description"
            value={values.description}
            onChange={(value) => onChange('description', value)}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[#06b6d4] px-5 py-2.5 text-sm font-semibold text-[#003640] hover:bg-[#4cd7f6] disabled:opacity-50 transition-all shadow-md"
      >
        {submitting ? 'Adding…' : 'Add resource'}
      </button>
    </form>
  )
}
