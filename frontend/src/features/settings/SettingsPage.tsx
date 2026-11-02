/**
 * Settings workspace: user preferences for the trading terminal.
 *
 * Preferences live in `localStorage` (see `refreshInterval.ts` and
 * `catalogSettings.ts`), so they are per-browser and take effect immediately
 * without a backend round-trip.
 */

import { useState, useSyncExternalStore } from 'react'

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
    </section>
  )
}
