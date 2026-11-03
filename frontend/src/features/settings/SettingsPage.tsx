/**
 * Settings workspace: user preferences for the trading terminal.
 *
 * Preferences live in `localStorage` (see `refreshInterval.ts` and
 * `catalogSettings.ts`), so they are per-browser and take effect immediately
 * without a backend round-trip.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'

import { api } from '../../api/client'
import type { PortfolioPosition, TickerAliasResponse } from '../../api/client'
import {
  readBrokers,
  readCategories,
  subscribeCatalog,
  writeBrokers,
  writeCategories,
} from './catalogSettings'
import {
  DEFAULT_REFRESH_MINUTES,
  REFRESH_INTERVAL_OPTIONS,
  readRefreshMinutes,
  subscribeRefreshMinutes,
  writeRefreshMinutes,
} from './refreshInterval'

/**
 * Editable list of values.
 *
 * Each list is stored as a whole array, so adding and removing always writes a
 * complete catalog instead of mutating a shared one.
 */
interface CatalogEditorProps {
  /** Field label shown above the list. */
  label: string
  /** Current values, in display order. */
  values: string[]
  /** Persist a new complete list. */
  onChange: (values: string[]) => void
  /** Placeholder for the add input. */
  placeholder: string
}

function CatalogEditor({ label, values, onChange, placeholder }: CatalogEditorProps) {
  const [draft, setDraft] = useState('')
  const trimmed = draft.trim()
  const canAdd = trimmed.length > 0 && !values.includes(trimmed)

  function add() {
    if (!canAdd) return
    onChange([...values, trimmed])
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-[#dfe2ee]">{label}</span>
      <ul className="flex flex-wrap gap-2">
        {values.map((value) => (
          <li
            key={value}
            className="flex items-center gap-1.5 rounded-lg bg-[#1c2028] border border-[#3d494c]/40 px-2.5 py-1 text-xs font-mono text-[#bcc9cd]"
          >
            {value}
            <button
              type="button"
              aria-label={`Quitar ${value}`}
              onClick={() => onChange(values.filter((entry) => entry !== value))}
              className="text-[#869397] hover:text-[#ff7f8b] transition-colors"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                close
              </span>
            </button>
          </li>
        ))}
        {values.length === 0 ? (
          <li className="text-xs text-[#869397]">Sin valores. Se usarán los del sistema.</li>
        ) : null}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          aria-label={`Agregar ${label}`}
          className="bg-[#1c2028] px-3 py-1.5 rounded-lg border border-[#3d494c]/40 text-sm text-white placeholder-[#869397] focus:outline-none focus:border-[#4cd7f6]"
        />
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="px-3 py-1.5 rounded-lg bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 text-xs font-mono text-[#4cd7f6] hover:bg-[#4cd7f6]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

/** Render the preferences available to the user. */
export function SettingsPage() {
  const refreshMinutes = useSyncExternalStore(
    subscribeRefreshMinutes,
    readRefreshMinutes,
    () => DEFAULT_REFRESH_MINUTES,
  )
  const brokers = useSyncExternalStore(subscribeCatalog, readBrokers, readBrokers)
  const categories = useSyncExternalStore(subscribeCatalog, readCategories, readCategories)

  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [aliases, setAliases] = useState<TickerAliasResponse[]>([])
  const [aliasTarget, setAliasTarget] = useState('')
  // A pending edit, tagged with the asset it belongs to. Keeping the tag means a
  // selection change can never write an old draft onto a different asset.
  const [aliasDraft, setAliasDraft] = useState<{ ticker: string; value: string } | null>(
    null,
  )
  const [aliasSaving, setAliasSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([api.listPortfolio(), api.listTickerAliases()])
      .then(([portfolio, aliasList]) => {
        if (!active) return
        setPositions(portfolio)
        setAliases(aliasList)
      })
      .catch(() => {
        // The editor stays empty when the data source is unavailable.
      })
    return () => {
      active = false
    }
  }, [])

  const aliasByTicker = new Map(
    aliases.map((alias) => [alias.broker_ticker.toUpperCase(), alias]),
  )

  /** Assets actually held, using alias broker_ticker (official name) when available, else raw ticker. */
  const heldTickers = Array.from(
    new Set(
      positions.map((position) => {
        const alias = aliasByTicker.get(position.ticker.toUpperCase())
        return alias ? alias.broker_ticker.toUpperCase() : position.ticker.toUpperCase()
      }),
    ),
  ).sort()

  /** What the input shows: the pending edit, else what is stored for the target. */
  const storedName =
    aliasTarget === '' ? '' : (aliasByTicker.get(aliasTarget)?.official_name ?? '')
  const draftValue =
    aliasDraft !== null && aliasDraft.ticker === aliasTarget ? aliasDraft.value : storedName

  async function saveAlias() {
    if (aliasTarget === '') return
    const stored = aliasByTicker.get(aliasTarget)
    const officialName = draftValue.trim()
    setAliasSaving(true)
    try {
      if (officialName === '') {
        if (!stored) return
        await api.deleteTickerAlias(stored.id)
        setAliases((prev) => prev.filter((alias) => alias.id !== stored.id))
        return
      }
      const saved = await api.createTickerAlias({
        broker_ticker: aliasTarget,
        official_name: officialName,
        provider: 'ppi',
      })
      setAliases((prev) => [
        ...prev.filter(
          (alias) => alias.broker_ticker.toUpperCase() !== aliasTarget,
        ),
        saved,
      ])
      setAliasDraft(null)
    } catch {
      // Keep the previous state when the write fails.
    } finally {
      setAliasSaving(false)
    }
  }

  async function removeAlias(alias: TickerAliasResponse) {
    try {
      await api.deleteTickerAlias(alias.id)
      setAliases((prev) => prev.filter((entry) => entry.id !== alias.id))
    } catch {
      // Keep the row when the delete fails.
    }
  }

  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      <header>
        <h1 id="settings-heading" className="text-xl font-semibold text-white font-headline">
          Configuración
        </h1>
        <p className="text-sm text-[#869397] mt-1">Preferencias del terminal</p>
      </header>

      <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl border border-[#3d494c]/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#3d494c]/20">
          <h2 className="text-sm font-semibold text-white">Precios de cartera</h2>
          <p className="text-xs text-[#869397] mt-1">
            Cada cuánto se vuelven a consultar las cotizaciones de las posiciones abiertas.
          </p>
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-6">
          <label htmlFor="refresh-interval" className="flex flex-col">
            <span className="text-sm text-[#dfe2ee]">Intervalo de actualización</span>
            <span className="text-xs text-[#869397]">
              Se aplica a la tabla de posiciones en cartera.
            </span>
          </label>
          <select
            id="refresh-interval"
            value={refreshMinutes}
            onChange={(event) => writeRefreshMinutes(Number(event.target.value))}
            className="bg-[#1c2028] px-3 py-1.5 rounded-lg border border-[#3d494c]/40 text-sm text-white focus:outline-none focus:border-[#4cd7f6]"
          >
            {REFRESH_INTERVAL_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes} className="bg-[#181c24] text-white">
                Cada {minutes} {minutes === 1 ? 'minuto' : 'minutos'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl border border-[#3d494c]/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#3d494c]/20">
          <h2 className="text-sm font-semibold text-white">Catálogo de cartera</h2>
          <p className="text-xs text-[#869397] mt-1">
            Valores disponibles en los selectores de broker y activo de "Posiciones en Cartera"
            y de "Registrar Transacciones".
          </p>
        </div>
        <div className="px-6 py-4 flex flex-col gap-6">
          <CatalogEditor
            label="Brokers"
            values={brokers}
            onChange={writeBrokers}
            placeholder="Ej.: COCOS"
          />
          <CatalogEditor
            label="Tipos de activo"
            values={categories}
            onChange={writeCategories}
            placeholder="Ej.: Obligación Negociable"
          />
        </div>
      </div>

      <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl border border-[#3d494c]/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#3d494c]/20">
          <h2 className="text-sm font-semibold text-white">Alias de cotización</h2>
          <p className="text-xs text-[#869397] mt-1">
            Elegí uno de tus activos en cartera y definí con qué nombre lo publica el
            proveedor de datos (PPI).
          </p>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4">
          {heldTickers.length === 0 ? (
            <p className="text-xs text-[#869397]">
              No hay activos registrados en la cartera.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="alias-asset" className="text-xs text-[#869397]">
                  Activo a configurar
                </label>
                <select
                  id="alias-asset"
                  aria-label="Activo a configurar"
                  value={aliasTarget}
                  onChange={(event) => {
                    setAliasTarget(event.target.value)
                    setAliasDraft(null)
                  }}
                  className="bg-[#1c2028] px-3 py-1.5 rounded-lg border border-[#3d494c]/40 text-sm text-white focus:outline-none focus:border-[#4cd7f6]"
                >
                  <option value="" className="bg-[#181c24] text-white">
                    Elegí un activo…
                  </option>
                  {heldTickers.map((ticker) => (
                    <option key={ticker} value={ticker} className="bg-[#181c24] text-white">
                      {ticker}
                    </option>
                  ))}
                </select>
              </div>

              {aliasTarget === '' ? null : (
                <div className="flex flex-col gap-1">
                  <label htmlFor="alias-name" className="text-xs text-[#869397]">
                    Alias de {aliasTarget}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="alias-name"
                      aria-label={`Alias de ${aliasTarget}`}
                      type="text"
                      value={draftValue}
                      onChange={(event) =>
                        setAliasDraft({ ticker: aliasTarget, value: event.target.value })
                      }
                      placeholder="Ej.: Delta Recursos Naturales Clase A"
                      className="flex-1 bg-[#1c2028] px-3 py-1.5 rounded-lg border border-[#3d494c]/40 text-sm text-white placeholder-[#869397] focus:outline-none focus:border-[#4cd7f6]"
                    />
                    <button
                      type="button"
                      onClick={() => void saveAlias()}
                      disabled={aliasSaving}
                      className="px-3 py-1.5 rounded-lg bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 text-xs font-mono text-[#4cd7f6] hover:bg-[#4cd7f6]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Guardar alias
                    </button>
                  </div>
                  <p className="text-[11px] text-[#869397]">
                    Nombre exacto del instrumento en PPI. Vacío = se cotiza con el propio
                    ticker.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-2 pt-2 border-t border-[#3d494c]/20">
            <span className="text-[10px] font-mono uppercase tracking-wide text-[#869397]">
              Alias configurados
            </span>
            {aliases.length === 0 ? (
              <p className="text-xs text-[#869397]">Sin alias configurados.</p>
            ) : (
              aliases.map((alias) => (
                <div
                  key={alias.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#1c2028] border border-[#3d494c]/40 px-3 py-2 text-xs font-mono text-[#bcc9cd]"
                >
                  <span>
                    <span className="text-[#4cd7f6]">{alias.broker_ticker}</span>
                    <span className="text-[#869397] mx-2">→</span>
                    {alias.official_name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Quitar alias ${alias.broker_ticker}`}
                    onClick={() => void removeAlias(alias)}
                    className="text-[#869397] hover:text-[#ff7f8b] transition-colors"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                      close
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
