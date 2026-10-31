/**
 * HTTP layer for the financial agent frontend.
 *
 * Provides a typed fetch wrapper over the backend boundary. Monetary values are
 * returned exactly as the backend sends them (strings) and are never coerced to
 * numbers by this layer.
 */

/** Default backend base URL used when `VITE_API_BASE_URL` is not configured. */
export const DEFAULT_BASE_URL = 'http://localhost:8000'

/** Error raised for any non-2xx response, carrying status and parsed detail. */
export class ApiError extends Error {
  /** HTTP status code returned by the backend. */
  readonly status: number
  /** Parsed FastAPI `detail` payload when the error body provides one. */
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** Resolve the backend base URL, falling back to the documented default. */
export function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  return typeof configured === 'string' && configured.trim().length > 0
    ? configured.trim()
    : DEFAULT_BASE_URL
}

/** Extract the FastAPI `detail` field from an error response body. */
async function parseErrorDetail(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json()
    if (body !== null && typeof body === 'object' && 'detail' in body) {
      return (body as { detail: unknown }).detail
    }
    return body
  } catch {
    return null
  }
}

/**
 * Perform a typed JSON request against the backend.
 *
 * @param path Backend path, including the `/api/v1` prefix when applicable.
 * @param init Optional fetch options (method, headers, body).
 * @returns The parsed JSON payload typed by the caller.
 * @throws {ApiError} When the response status is outside the 2xx range.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, init)
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response))
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
