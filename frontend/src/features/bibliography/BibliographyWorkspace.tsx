/**
 * Bibliography workspace: list, create, and delete bibliography resources.
 *
 * Optional metadata is omitted from the request when left blank so the backend
 * applies its own defaults; a blank category is sent explicitly as `"General"`.
 * Every mutation refreshes the list, and a missing resource (404) on delete is
 * surfaced as an error, never as success.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { BibliographyForm } from './BibliographyForm'
import type { BibliographyFormValues } from './BibliographyForm'
import { BibliographyTable } from './BibliographyTable'
import type { BibliographyCreateBody } from './bibliographyApi'
import { bibliographyApi } from './bibliographyApi'
import { useBibliography } from './useBibliography'

const EMPTY_VALUES: BibliographyFormValues = {
  title: '',
  author: '',
  year: '',
  category: '',
  link: '',
  description: '',
}

/**
 * Build the create request body, dropping optional fields the user left blank.
 *
 * @param values Raw form values held as strings.
 * @returns A body whose optional keys are present only when provided.
 */
function toRequestBody(values: BibliographyFormValues): BibliographyCreateBody {
  const body: BibliographyCreateBody = {
    title: values.title.trim(),
    author: values.author.trim(),
    category: values.category.trim() === '' ? 'General' : values.category.trim(),
  }

  const year = values.year.trim()
  if (year !== '') body.year = Number.parseInt(year, 10)

  const link = values.link.trim()
  if (link !== '') body.link = link

  const description = values.description.trim()
  if (description !== '') body.description = description

  return body
}

/** List, create, and delete bibliography resources. */
export function BibliographyWorkspace() {
  const [version, setVersion] = useState(0)
  const { status, items, error } = useBibliography(version)
  const [values, setValues] = useState<BibliographyFormValues>(EMPTY_VALUES)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function handleChange(field: keyof BibliographyFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = toRequestBody(values)
    if (body.title === '' || body.author === '') return

    setActionError(null)
    setMessage(null)
    setSubmitting(true)
    try {
      await bibliographyApi.add(body)
      setValues(EMPTY_VALUES)
      setMessage('Resource added.')
      setVersion((value) => value + 1)
    } catch (caught) {
      setActionError(describeApiError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(itemId: number) {
    setActionError(null)
    setMessage(null)
    try {
      await bibliographyApi.remove(itemId)
      setVersion((value) => value + 1)
    } catch (caught) {
      setActionError(describeApiError(caught))
    }
  }

  return (
    <section aria-labelledby="bibliography-heading">
      <h2 id="bibliography-heading">Bibliography</h2>

      <BibliographyForm
        values={values}
        submitting={submitting}
        onChange={handleChange}
        onSubmit={handleAdd}
      />

      {actionError ? <ErrorState message={actionError} /> : null}
      {message ? <p role="status">{message}</p> : null}

      {status === 'loading' ? <LoadingState label="Loading bibliography…" /> : null}
      {status === 'error' ? <ErrorState message={describeApiError(error)} /> : null}
      {status === 'ready' ? <BibliographyTable items={items} onDelete={handleDelete} /> : null}
    </section>
  )
}
