import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, DEFAULT_BASE_URL, request, resolveBaseUrl } from './http'
import { api } from './client'

/** Build a JSON Response with the given status and payload. */
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('resolveBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses VITE_API_BASE_URL when configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.test')
    expect(resolveBaseUrl()).toBe('http://api.example.test')
  })

  it('falls back to the documented default when VITE_API_BASE_URL is missing', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    expect(DEFAULT_BASE_URL).toBe('http://localhost:8000')
    expect(resolveBaseUrl()).toBe(DEFAULT_BASE_URL)
  })
})

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('builds the request URL from the base URL and the given path', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await request<{ status: string }>('/health')

    expect(fetchMock).toHaveBeenCalledWith('http://api.example.test/health', undefined)
    expect(result).toEqual({ status: 'ok' })
  })

  it('lets the typed client build the base URL plus path for a known endpoint', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    await api.listPortfolio()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.example.test/api/v1/portfolio',
      undefined,
    )
  })

  it('propagates a 422 as an ApiError carrying status and parsed detail', async () => {
    const detail = [{ loc: ['body', 'quantity'], msg: 'Input should be greater than 0' }]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail }, 422)),
    )

    const error = await request('/api/v1/transactions').catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(422)
    expect((error as ApiError).detail).toEqual(detail)
  })

  it('propagates a 503 as an ApiError carrying status and parsed detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'database unavailable' }, 503)),
    )

    await expect(request('/ready')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      detail: 'database unavailable',
    })
  })

  it('keeps monetary values as strings and never coerces them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([{ ticker: 'AAPL', quantity: '1.5', average_price: '100.25' }]),
      ),
    )

    const [position] = await request<Array<Record<string, unknown>>>('/api/v1/portfolio')

    expect(typeof position.quantity).toBe('string')
    expect(position.quantity).toBe('1.5')
    expect(typeof position.average_price).toBe('string')
    expect(position.average_price).toBe('100.25')
  })
})
