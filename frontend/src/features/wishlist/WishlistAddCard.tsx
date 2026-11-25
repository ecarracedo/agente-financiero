/**
 * Add-ticker card for the wishlist workspace.
 *
 * Uses the shared asset search so a ticker is always chosen through the same
 * provider-backed combobox as the rest of the application.
 */

import type { FormEvent } from 'react'

import { ErrorState, SuccessState } from '../../components/AsyncStates'
import { TickerSearch } from '../../components/TickerSearch'
import { marketApi } from '../market/marketApi'

interface WishlistAddCardProps {
  ticker: string
  error: string | null
  message: string | null
  onTickerChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

/** Render the sticky ticker-entry card. */
export function WishlistAddCard({
  ticker,
  error,
  message,
  onTickerChange,
  onSubmit,
}: WishlistAddCardProps) {
  return (
    <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 border border-[#3d494c]/20 sticky top-20">
      <div className="flex items-center gap-2 pb-3 border-b border-[#3d494c]/20">
        <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">
          add_circle
        </span>
        <h3 className="text-base font-semibold font-headline text-white">Agregar activo</h3>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TickerSearch
          id="wishlist-ticker"
          label="Buscar activo"
          value={ticker}
          onChange={onTickerChange}
          search={marketApi.searchTickers}
        />
        <button
          type="submit"
          className="w-full py-2 bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#003640] text-xs font-semibold rounded-lg shadow-md transition-all"
        >
          Add ticker
        </button>
      </form>

      {error !== null ? <ErrorState message={error} /> : null}
      {message !== null ? <SuccessState message={message} /> : null}
    </div>
  )
}
