import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { LoginPage } from './LoginPage'
import { authApi } from './authApi'

vi.mock('./authApi', () => ({
  authApi: {
    login: vi.fn(),
    verifyTotp: vi.fn(),
  },
}))

describe('LoginPage', () => {
  it('logs in with username and password and calls onAuthenticated', async () => {
    const onAuthenticated = vi.fn()
    vi.mocked(authApi.login).mockResolvedValue({
      status: 'ok',
      username: 'ecarracedo',
      totp_enabled: false,
    })

    render(<LoginPage onAuthenticated={onAuthenticated} />)

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ecarracedo' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'correct-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith('ecarracedo', 'correct-password'),
    )
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
  })

  it('shows an error and stays on the form with wrong credentials', async () => {
    const onAuthenticated = vi.fn()
    vi.mocked(authApi.login).mockRejectedValue(new Error('401'))

    render(<LoginPage onAuthenticated={onAuthenticated} />)

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ecarracedo' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas.')
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('asks for the TOTP code when the backend requires it', async () => {
    const onAuthenticated = vi.fn()
    vi.mocked(authApi.login).mockResolvedValue({
      status: 'totp_required',
      username: null,
      totp_enabled: true,
    })
    vi.mocked(authApi.verifyTotp).mockResolvedValue({
      status: 'ok',
      username: 'ecarracedo',
      totp_enabled: true,
    })

    render(<LoginPage onAuthenticated={onAuthenticated} />)

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ecarracedo' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'correct-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }))

    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }))

    await waitFor(() => expect(authApi.verifyTotp).toHaveBeenCalledWith('123456'))
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
  })
})
