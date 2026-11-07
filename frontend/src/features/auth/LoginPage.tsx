/**
 * Login page for the single-user deployment.
 *
 * Two steps when TOTP is enabled: username/password first, then the
 * six-digit code from the authenticator app. Errors are shown inline and
 * never reveal whether the username or the password was wrong.
 */

import { useState } from 'react'

import { authApi } from './authApi'

interface LoginPageProps {
  /** Called after a full session exists (password only or password + TOTP). */
  onAuthenticated: () => void
}

/** Login form with an optional second-factor step. */
export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [needsTotp, setNeedsTotp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await authApi.login(username, password)
      if (result.status === 'totp_required') {
        setNeedsTotp(true)
      } else {
        onAuthenticated()
      }
    } catch {
      setError('Credenciales inválidas.')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await authApi.verifyTotp(code)
      onAuthenticated()
    } catch {
      setError('Código inválido.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full bg-[#1c2028] px-3 py-2 rounded-lg border border-[#3d494c]/40 text-sm text-white focus:outline-none focus:border-[#4cd7f6]'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f131c] text-[#dfe2ee]">
      <div className="w-full max-w-sm bg-[#181c24]/80 rounded-xl border border-[#3d494c]/30 p-8 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-white font-headline">
            Agente Financiero
          </h1>
          <p className="text-xs text-[#869397]">
            {needsTotp
              ? 'Ingresá el código de tu aplicación de autenticación.'
              : 'Iniciá sesión para continuar.'}
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-xs text-[#ff7f8b]">
            {error}
          </p>
        ) : null}

        {needsTotp ? (
          <form onSubmit={submitCode} className="flex flex-col gap-4">
            <label htmlFor="totp-code" className="flex flex-col gap-1.5 text-sm">
              Código de 6 dígitos
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 text-sm font-mono text-[#4cd7f6] hover:bg-[#4cd7f6]/20 disabled:opacity-40 transition-colors"
            >
              Verificar
            </button>
          </form>
        ) : (
          <form onSubmit={submitCredentials} className="flex flex-col gap-4">
            <label htmlFor="login-username" className="flex flex-col gap-1.5 text-sm">
              Usuario
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={inputClass}
              />
            </label>
            <label htmlFor="login-password" className="flex flex-col gap-1.5 text-sm">
              Contraseña
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 text-sm font-mono text-[#4cd7f6] hover:bg-[#4cd7f6]/20 disabled:opacity-40 transition-colors"
            >
              Ingresar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
