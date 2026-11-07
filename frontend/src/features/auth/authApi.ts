/**
 * Authentication API client.
 *
 * Login is two steps when TOTP is enabled: password first (returns
 * `totp_required` and a short-lived pre-auth cookie), then the six-digit
 * code (returns a full session cookie). All requests send cookies via the
 * shared `request` helper (`credentials: 'include'`).
 */

import { request } from '../../api/http'

/** Public identity returned by the backend for the authenticated user. */
export interface CurrentUser {
  username: string
  email: string
  totp_enabled: boolean
}

/** Outcome of the password step: either a session or a pending TOTP step. */
export interface LoginResult {
  status: 'ok' | 'totp_required'
  username: string | null
  totp_enabled: boolean
}

/** Enrollment material returned once when setting up TOTP. */
export interface TotpSetup {
  secret: string
  otpauth_url: string
}

export const authApi = {
  /** Authenticate with username and password. */
  login(username: string, password: string): Promise<LoginResult> {
    return request<LoginResult>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  },

  /** Complete login with a TOTP code after the password step. */
  verifyTotp(code: string): Promise<LoginResult> {
    return request<LoginResult>('/api/v1/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  },

  /** Return the authenticated user, or throw 401 when unauthenticated. */
  me(): Promise<CurrentUser> {
    return request<CurrentUser>('/api/v1/auth/me')
  },

  /** End the current session. */
  logout(): Promise<LoginResult> {
    return request<LoginResult>('/api/v1/auth/logout', { method: 'POST' })
  },

  /** Generate a new TOTP secret for enrollment. */
  totpSetup(): Promise<TotpSetup> {
    return request<TotpSetup>('/api/v1/auth/totp/setup', { method: 'POST' })
  },

  /** Enable TOTP after verifying a code from the authenticator app. */
  totpConfirm(code: string): Promise<CurrentUser> {
    return request<CurrentUser>('/api/v1/auth/totp/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  },

  /** Disable TOTP after re-entering the password. */
  totpDisable(password: string): Promise<CurrentUser> {
    return request<CurrentUser>('/api/v1/auth/totp/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
  },
}
