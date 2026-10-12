/**
 * Bibliography boundary for the bibliography feature.
 *
 * Wraps the bibliography CRUD endpoints. Optional metadata fields are sent
 * only when the user provides them so the backend applies its own defaults
 * (for example, `category` defaults to `"General"`).
 */

import { request } from '../../api/http'
import type { components } from '../../api/types'

/** One bibliography resource with its optional metadata. */
export type BibliographyItem = components['schemas']['BibliographyItemResponse']

/** Body accepted by `POST /api/v1/bibliography`. */
export type BibliographyCreateBody = components['schemas']['BibliographyCreateRequest']

/** Acknowledgement returned by a removal. */
export type BibliographyRemoved = components['schemas']['MutationResponse']

/** Typed bibliography operations used by the bibliography workspace. */
export const bibliographyApi = {
  /** List every bibliography resource. */
  list: (): Promise<BibliographyItem[]> =>
    request<BibliographyItem[]>('/api/v1/bibliography'),
  /** Create a resource; the backend validates required and optional fields. */
  add: (body: BibliographyCreateBody): Promise<BibliographyItem> =>
    request<BibliographyItem>('/api/v1/bibliography', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  /** Delete a resource; a missing item yields 404. */
  remove: (itemId: number): Promise<BibliographyRemoved> =>
    request<BibliographyRemoved>(`/api/v1/bibliography/${itemId}`, { method: 'DELETE' }),
}
