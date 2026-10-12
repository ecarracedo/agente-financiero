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
    <form onSubmit={onSubmit} noValidate>
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
      <TextField
        id="bibliography-link"
        label="Link"
        value={values.link}
        onChange={(value) => onChange('link', value)}
      />
      <TextAreaField
        id="bibliography-description"
        label="Description"
        value={values.description}
        onChange={(value) => onChange('description', value)}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add resource'}
      </button>
    </form>
  )
}
