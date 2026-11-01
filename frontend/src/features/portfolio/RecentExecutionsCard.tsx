import { NavLink } from 'react-router'

/**
 * Recent Executions Card from Obsidian Capital design.
 */
export function RecentExecutionsCard() {
  const executions = [
    {
      type: 'BUY',
      ticker: 'NVDA',
      details: '4 accs',
      time: 'Hoy, 14:32:10 FIX',
      amount: '$3,500.80',
      status: '',
      isBuy: true,
    },
    {
      type: 'BUY',
      ticker: 'BTC',
      details: '0.05 BTC',
      time: 'Ayer, 18:04:19 FIX',
      amount: '$3,210.00',
      status: '',
      isBuy: true,
    },
    {
      type: 'SELL',
      ticker: 'MSFT',
      details: '10 accs',
      time: '24 Feb, 10:15:02',
      amount: '$4,155.00',
      status: '',
      isBuy: false,
    },
  ]

  return (
    <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-3 border border-[#3d494c]/20">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">history</span>
          <h3 className="text-base font-semibold text-white font-headline">Últimas Transacciones</h3>
        </div>
        <NavLink
          to="/transactions"
          className="text-[10px] font-mono uppercase text-[#4cd7f6] hover:underline"
        >
          VER TODAS
        </NavLink>
      </div>

      <div className="flex flex-col gap-2 flex-1 justify-between">
        {executions.map((exec, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[#1c2028]/50 hover:bg-[#1c2028] transition-colors border border-[#3d494c]/20"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-mono font-bold ${
                  exec.isBuy
                    ? 'bg-[#46fa9c]/15 text-[#46fa9c]'
                    : 'bg-[#ff7f8b]/15 text-[#ffb2b7]'
                }`}
              >
                {exec.type}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white font-sans">
                  {exec.ticker} • {exec.details}
                </span>
                <span className="text-[10px] font-mono text-[#869397]">{exec.time}</span>
              </div>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-mono font-semibold text-white">{exec.amount}</span>
              {exec.status ? <span className="text-[10px] font-mono text-[#46fa9c] font-medium">{exec.status}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
