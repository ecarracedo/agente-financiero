/**
 * TOTP second-factor settings for the single user.
 *
 * Enrollment shows the secret and the `otpauth://` URL to scan with an
 * authenticator app, then confirms with a six-digit code. Disabling
 * requires re-entering the password.
 */

import { useEffect, useState } from 'react'

import { authApi, type CurrentUser } from '../auth/authApi'

/** Setup, confirm, and disable controls for TOTP enrolment. */
export function TotpSettings() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    try {
      setUser(await authApi.me())
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    let active = true
    authApi
      .me()
      .then((current) => {
        if (active) setUser(current)
      })
      .catch(() => {
        if (active) setUser(null)
      })
    return () => {
      active = false
    }
  }, [])

  async function startSetup() {
    setError(null)
    setNotice(null)
    try {
      const result = await authApi.totpSetup()
      setSecret(result.secret)
      setOtpauthUrl(result.otpauth_url)
      await refresh()
    } catch {
      setError('No se pudo iniciar la configuración.')
    }
  }

  async function confirm() {
    setError(null)
    try {
      const updated = await authApi.totpConfirm(code)
      setUser(updated)
      setSecret(null)
      setOtpauthUrl(null)
      setCode('')
      setNotice('Verificación en dos pasos activada.')
    } catch {
      setError('Código inválido.')
    }
  }

  async function disable() {
    setError(null)
    try {
      const updated = await authApi.totpDisable(password)
      setUser(updated)
      setPassword('')
      setNotice('Verificación en dos pasos desactivada.')
    } catch {
      setError('Contraseña inválida.')
    }
  }

  const inputClass =
    'bg-[#1c2028] px-3 py-1.5 rounded-lg border border-[#3d494c]/40 text-sm text-white focus:outline-none focus:border-[#4cd7f6]'
  const buttonClass =
    'px-3 py-1.5 rounded-lg bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 text-xs font-mono text-[#4cd7f6] hover:bg-[#4cd7f6]/20 transition-colors'

  return (
    <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl border border-[#3d494c]/30 overflow-hidden">
      <div className="px-6 py-4 border-b border-[#3d494c]/20">
        <h2 className="text-sm font-semibold text-white">Verificación en dos pasos</h2>
        <p className="text-xs text-[#869397] mt-1">
          Protegé el acceso con un código de tu aplicación de autenticación.
        </p>
      </div>
      <div className="px-6 py-4 flex flex-col gap-4">
        <p className="text-xs text-[#dfe2ee]">
          {user === null
            ? 'Cargando…'
            : user.totp_enabled
              ? 'Activada para esta cuenta.'
              : 'Desactivada para esta cuenta.'}
        </p>
        {error ? (
          <p role="alert" className="text-xs text-[#ff7f8b]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-xs text-[#46fa9c]">{notice}</p>
        ) : null}

        <div>
          <button type="button" onClick={() => void startSetup()} className={buttonClass}>
            Configurar
          </button>
        </div>

        {secret && otpauthUrl ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[#869397]">
              Escaneá este secreto en tu aplicación de autenticación, o ingresá la clave
              manualmente:
            </p>
            <code className="text-sm font-mono text-white bg-[#0a0e16] px-3 py-2 rounded-lg break-all">
              {secret}
            </code>
            <code className="text-[11px] font-mono text-[#869397] break-all">{otpauthUrl}</code>
            <div className="flex items-center gap-2">
              <label htmlFor="totp-confirm-code" className="text-xs text-[#869397]">
                Código
              </label>
              <input
                id="totp-confirm-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={inputClass}
              />
              <button type="button" onClick={() => void confirm()} className={buttonClass}>
                Confirmar
              </button>
            </div>
          </div>
        ) : null}

        {user?.totp_enabled ? (
          <div className="flex items-center gap-2 pt-2 border-t border-[#3d494c]/20">
            <label htmlFor="totp-disable-password" className="text-xs text-[#869397]">
              Contraseña
            </label>
            <input
              id="totp-disable-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
            <button type="button" onClick={() => void disable()} className={buttonClass}>
              Desactivar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
