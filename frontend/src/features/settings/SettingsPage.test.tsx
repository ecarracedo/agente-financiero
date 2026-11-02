import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithRouter } from '../../../tests/render'
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
})
