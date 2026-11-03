import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderWithRouter } from '../../../tests/render'
import { server } from '../../../tests/setup'
import {
  BROKERS_STORAGE_KEY,
  CATEGORIES_STORAGE_KEY,
  DEFAULT_BROKERS,
  DEFAULT_CATEGORIES,
} from './catalogSettings'
import { REFRESH_INTERVAL_STORAGE_KEY } from './refreshInterval'

/**
 * Settings workspace against the shared MSW harness.
 *
 * The shell renders every workspace and hides the inactive ones, so each query
 * is scoped to the configuration section: the portfolio is mounted too and its
 * selectors repeat the same broker and asset-type names.
 *
 * The catalogs are the only mutation surface here, and they live in
 * `localStorage`, so a test asserts on both what the workspace shows and what it
 * persisted — a catalog that renders but never reaches storage would break every
 * other workspace on reload.
 */
describe('SettingsPage', () => {
  /** The configuration section, isolated from the rest of the mounted shell. */
  async function settingsSection(): Promise<HTMLElement> {
    const heading = await screen.findByRole('heading', { name: /configuración/i })
    return heading.closest('section') as HTMLElement
  }

  /** Read a stored catalog as the user would find it after a reload. */
  function storedCatalog(key: string): string[] | null {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as string[])
  }

  it('offers the default catalogs before the user customizes anything', async () => {
    renderWithRouter({ initialEntries: ['/configuracion'] })

    const section = await settingsSection()
    const settings = within(section)

    for (const broker of DEFAULT_BROKERS) {
      expect(settings.getByText(broker)).toBeInTheDocument()
    }
    for (const category of DEFAULT_CATEGORIES) {
      expect(settings.getByText(category)).toBeInTheDocument()
    }
  })

  it('adds a broker and persists the new catalog', async () => {
    renderWithRouter({ initialEntries: ['/configuracion'] })

    const settings = within(await settingsSection())
    const input = settings.getByLabelText('Agregar Brokers')

    fireEvent.change(input, { target: { value: 'COCOS' } })
    fireEvent.click(within(input.parentElement as HTMLElement).getByRole('button', { name: /agregar/i }))

    expect(settings.getByText('COCOS')).toBeInTheDocument()
    expect(storedCatalog(BROKERS_STORAGE_KEY)).toEqual([...DEFAULT_BROKERS, 'COCOS'])
  })

  it('removes a catalog entry from the list and from storage', async () => {
    renderWithRouter({ initialEntries: ['/configuracion'] })

    const settings = within(await settingsSection())

    fireEvent.click(settings.getByRole('button', { name: 'Quitar BINANCE' }))

    expect(settings.queryByText('BINANCE')).not.toBeInTheDocument()
    expect(storedCatalog(BROKERS_STORAGE_KEY)).toEqual(
      DEFAULT_BROKERS.filter((broker) => broker !== 'BINANCE'),
    )
  })

  it('refuses to add an entry that is already in the catalog', async () => {
    renderWithRouter({ initialEntries: ['/configuracion'] })

    const settings = within(await settingsSection())
    const input = settings.getByLabelText('Agregar Brokers')

    fireEvent.change(input, { target: { value: 'ECO' } })

    expect(
      within(input.parentElement as HTMLElement).getByRole('button', { name: /agregar/i }),
    ).toBeDisabled()
  })

  it('falls back to the default catalogs when storage is corrupted', async () => {
    window.localStorage.setItem(BROKERS_STORAGE_KEY, '{not json')
    window.localStorage.setItem(CATEGORIES_STORAGE_KEY, '[]')

    renderWithRouter({ initialEntries: ['/configuracion'] })

    const settings = within(await settingsSection())

    for (const broker of DEFAULT_BROKERS) {
      expect(settings.getByText(broker)).toBeInTheDocument()
    }
    expect(settings.getByText('Cripto')).toBeInTheDocument()
  })

  it('changes the refresh interval and persists it', async () => {
    renderWithRouter({ initialEntries: ['/configuracion'] })

    const settings = within(await settingsSection())
    const selector = settings.getByLabelText(/intervalo de actualización/i)

    fireEvent.change(selector, { target: { value: '10' } })

    expect(window.localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY)).toBe('10')
  })

  /**
   * Alias editor.
   *
   * The only choice offered is the set of assets actually held: a mapping is
   * configured per held ticker, and the official name is typed rather than
   * picked from the provider instrument list.
   */
  describe('alias de cotización', () => {
    it('offers only the assets held in the portfolio', async () => {
      renderWithRouter({ initialEntries: ['/configuracion'] })

      const settings = within(await settingsSection())
      const selector = (await settings.findByLabelText(
        'Activo a configurar',
      )) as HTMLSelectElement

      const values = Array.from(selector.options).map((option) => option.value)
      // The placeholder plus the single held ticker, nothing from the provider.
      expect(values).toEqual(['', 'AAPL'])
    })

    it('prefills the alias already stored for the selected asset', async () => {
      renderWithRouter({ initialEntries: ['/configuracion'] })

      const settings = within(await settingsSection())
      const selector = (await settings.findByLabelText(
        'Activo a configurar',
      )) as HTMLSelectElement

      fireEvent.change(selector, { target: { value: 'AAPL' } })

      expect(settings.getByLabelText('Alias de AAPL')).toHaveValue(
        'Allaria Diversificado Clase A',
      )
    })

    it('starts with an empty alias for an asset without a mapping', async () => {
      server.use(http.get('*/api/v1/ticker-aliases', () => HttpResponse.json([])))

      renderWithRouter({ initialEntries: ['/configuracion'] })

      const settings = within(await settingsSection())
      const selector = (await settings.findByLabelText(
        'Activo a configurar',
      )) as HTMLSelectElement

      fireEvent.change(selector, { target: { value: 'AAPL' } })

      expect(settings.getByLabelText('Alias de AAPL')).toHaveValue('')
    })

    it('saves the alias typed for the selected asset', async () => {
      server.use(http.get('*/api/v1/ticker-aliases', () => HttpResponse.json([])))

      renderWithRouter({ initialEntries: ['/configuracion'] })

      const settings = within(await settingsSection())
      const selector = (await settings.findByLabelText(
        'Activo a configurar',
      )) as HTMLSelectElement

      fireEvent.change(selector, { target: { value: 'AAPL' } })
      fireEvent.change(settings.getByLabelText('Alias de AAPL'), {
        target: { value: 'Delta Recursos Naturales Clase A' },
      })
      fireEvent.click(settings.getByRole('button', { name: 'Guardar alias' }))

      await waitFor(() =>
        expect(settings.getByText('Delta Recursos Naturales Clase A')).toBeInTheDocument(),
      )
      expect(settings.getByRole('button', { name: 'Quitar alias AAPL' })).toBeInTheDocument()
    })

    it('removes a stored alias from the list', async () => {
      renderWithRouter({ initialEntries: ['/configuracion'] })

      const settings = within(await settingsSection())

      fireEvent.click(
        await settings.findByRole('button', { name: 'Quitar alias AAPL' }),
      )

      await waitFor(() =>
        expect(settings.getByText('Sin alias configurados.')).toBeInTheDocument(),
      )
    })
  })
})
