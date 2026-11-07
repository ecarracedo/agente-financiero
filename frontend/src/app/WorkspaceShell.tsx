import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'

import { api } from '../api/client'
import { authApi } from '../features/auth/authApi'
import { DEFAULT_WORKSPACE, WORKSPACE_ROUTES } from './routes'

type BackendStatus = 'loading' | 'ready' | 'unavailable'

const ROUTE_ICONS: Record<string, string> = {
  portfolio: 'pie_chart',
  transactions: 'receipt_long',
  market: 'candlestick_chart',
  alerts: 'notifications',
  wishlist: 'monitoring',
  bibliography: 'menu_book',
  tools: 'calculate',
  configuracion: 'settings',
}

/**
 * Application shell in Obsidian Capital design system.
 *
 * Renders the persistent left navigation rail and hosts each workspace. All
 * workspaces stay mounted and inactive ones are hidden with the `hidden`
 * attribute (preserves user state without a global store).
 */
export function WorkspaceShell() {
  const location = useLocation()
  const [, setStatus] = useState<BackendStatus>('loading')
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    try {
      return localStorage.getItem('obsidian.sidebar.visible') !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('obsidian.sidebar.visible', String(sidebarVisible))
    } catch {
      // ignore
    }
  }, [sidebarVisible])

  const requestedPath = location.pathname.replace(/^\//, '').split('/')[0]
  const activePath = requestedPath === '' ? DEFAULT_WORKSPACE : requestedPath

  useEffect(() => {
    let active = true
    api
      .ready()
      .then(() => {
        if (active) setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('unavailable')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0f131c] text-[#dfe2ee] font-sans">
      {/* Left Navigation Rail (Obsidian Sidebar) */}
      {sidebarVisible ? (
      <aside className="fixed left-0 top-0 bottom-0 w-48 bg-[#181c24] border-r border-[#3d494c]/30 z-50 flex flex-col justify-between">
        <div className="flex flex-col">
          {/* Logo / Branding */}
          <div className="h-16 px-4 flex items-center gap-2.5 border-b border-[#3d494c]/20 bg-[#0a0e16]/60">
            <div className="w-7 h-7 rounded-lg bg-[#06b6d4]/10 border border-[#06b6d4]/30 flex items-center justify-center text-[#4cd7f6]">
              <span className="material-symbols-outlined text-[18px]">diamond</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm tracking-tight text-white font-headline">
                Obsidian
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[#4cd7f6] font-mono">
                Invest
              </span>
            </div>
          </div>

          {/* Section Heading */}
          <div className="px-5 pt-6 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#869397] font-mono">
              Trading Terminal
            </span>
          </div>

          {/* Nav List */}
          <nav aria-label="Workspaces" className="flex flex-col gap-1 px-2">
            {WORKSPACE_ROUTES.map((route) => {
              const isActive = activePath === route.path
              const iconName = ROUTE_ICONS[route.path] ?? 'apps'
              return (
                <NavLink
                  key={route.path}
                  to={`/${route.path}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#262a33] text-[#4cd7f6] shadow-xs'
                      : 'text-[#bcc9cd] hover:bg-[#1c2028] hover:text-white'
                  }`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] shrink-0">
                    {iconName}
                  </span>
                  <span className="truncate">{route.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div />
      </aside>
      ) : null}

      {/* Main Container Area */}
      <div className={`flex flex-col min-h-screen transition-all duration-200 ${sidebarVisible ? 'pl-48' : 'pl-0'}`}>
        {/* Top Header */}
        <header className="sticky top-0 z-40 h-16 bg-[#0f131c]/85 backdrop-blur-xl border-b border-[#3d494c]/30 flex items-center justify-between px-8">
          <div className="flex items-center gap-4 overflow-hidden">
            <button
              type="button"
              onClick={() => setSidebarVisible((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#bcc9cd] hover:text-white hover:bg-[#1c2028] transition-colors border border-[#3d494c]/40"
              title={sidebarVisible ? 'Ocultar menú' : 'Mostrar menú'}
              aria-label={sidebarVisible ? 'Ocultar menú lateral' : 'Mostrar menú lateral'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {sidebarVisible ? 'menu_open' : 'menu'}
              </span>
              <span className="text-xs font-mono hidden sm:inline">
                {sidebarVisible ? 'Ocultar' : 'Menú'}
              </span>
            </button>
            <div className="hidden xl:flex items-center gap-3 py-1 px-3 rounded-lg bg-[#0a0e16]/60 border border-[#3d494c]/20">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[#869397]">SPX</span>
                <span className="text-white font-medium">5,117.09</span>
                <span className="text-[#46fa9c] font-semibold">+0.42%</span>
              </div>
              <div className="w-px h-3 bg-[#3d494c]/40" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[#869397]">NDX</span>
                <span className="text-white font-medium">18,293.20</span>
                <span className="text-[#46fa9c] font-semibold">+0.81%</span>
              </div>
              <div className="w-px h-3 bg-[#3d494c]/40" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-[#869397]">BTC/USD</span>
                <span className="text-white font-medium">64,280.00</span>
                <span className="text-[#46fa9c] font-semibold">+2.34%</span>
              </div>
            </div>

            <div className="relative flex items-center w-64 lg:w-72">
              <span className="material-symbols-outlined absolute left-2.5 text-[#869397] pointer-events-none text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar activo o ticker..."
                className="w-full pl-8 pr-12 py-1.5 rounded-lg bg-[#1c2028] border border-[#3d494c]/40 text-xs text-white placeholder-[#869397] focus:outline-none focus:border-[#4cd7f6] transition-colors font-sans"
              />
              <kbd className="absolute right-2 text-[10px] font-mono text-[#869397] bg-[#262a33] px-1.5 py-0.5 rounded">
                Ctrl+K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void (async () => {
                try {
                  await authApi.logout()
                } finally {
                  window.location.reload()
                }
              })()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#bcc9cd] hover:text-white hover:bg-[#1c2028] transition-colors border border-[#3d494c]/40 text-xs font-mono"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Salir
            </button>
            <button
              type="button"
              className="relative p-2 rounded-lg text-[#bcc9cd] hover:text-white hover:bg-[#1c2028] transition-colors"
              title="Notificaciones"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#06b6d4]" />
            </button>
            <div className="flex items-center gap-2.5 pl-2 border-l border-[#3d494c]/30">
              <div className="flex flex-col text-right hidden md:block">
                <span className="text-xs font-medium text-white leading-tight font-sans">
                  Trader Pro
                </span>
                <span className="text-[10px] font-mono font-semibold text-[#4cd7f6]">
                  INSTITUTIONAL
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#262a33] border border-[#4cd7f6]/40 flex items-center justify-center text-xs font-bold font-mono text-[#4cd7f6]">
                TP
              </div>
            </div>
          </div>
        </header>

        {/* Workspace Views */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6 flex-1">
          {WORKSPACE_ROUTES.map((route) => (
            <div key={route.path} hidden={route.path !== activePath}>
              {route.element}
            </div>
          ))}
        </main>
      </div>
    </div>
  )
}
