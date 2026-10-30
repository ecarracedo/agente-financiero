/**
 * Exposure Alert / Rebalance Recommendation Card from Obsidian Capital design.
 */
export function ExposureAlertCard() {
  return (
    <div className="bg-gradient-to-br from-[#181c24] to-[#1c2028] rounded-xl p-6 shadow-md relative overflow-hidden border border-[#3d494c]/20 flex flex-col justify-between">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#ff7f8b]/20 text-[#ffb2b7] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">notification_important</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#ffb2b7] font-bold uppercase tracking-wider">
                Aviso de Exposición
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#ffb2b7]/15 text-[10px] font-mono text-[#ffb2b7] font-semibold uppercase">
                Rebalanceo Sugerido
              </span>
            </div>
            <h4 className="text-base font-semibold text-white font-headline">
              Sobreponderación en NVIDIA
            </h4>
            <p className="text-xs text-[#bcc9cd] leading-relaxed">
              La posición en <strong className="text-white">NVDA</strong> supera el umbral de asignación máxima recomendado (10.0%) con un retorno acumulado del +44.02%.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-[#0a0e16]/40 p-3 rounded-lg border border-[#3d494c]/20">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[#869397]">PONDERACIÓN ACTUAL</span>
            <span className="text-xs font-mono text-[#ffb2b7] font-bold">14.1% (Límite: 10%)</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[#869397]">DESVIACIÓN</span>
            <span className="text-xs font-mono text-[#ffb2b7] font-bold">+4.10% s/ límite</span>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 flex items-center justify-between gap-2 border-t border-[#3d494c]/20">
        <div className="flex items-center gap-1 text-xs text-[#869397]">
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span>Venta parcial recomendada: ~7 accs</span>
        </div>
        <button
          type="button"
          className="bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#003640] text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"
        >
          Revisar Estrategia
        </button>
      </div>
    </div>
  )
}
