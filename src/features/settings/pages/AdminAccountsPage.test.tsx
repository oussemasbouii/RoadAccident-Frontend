import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import authReducer from '../../auth/slices/authSlice'
import notificationsReducer from '../../notifications/slices/notificationsSlice'
import { ThemeModeProvider } from '../../../themeMode'

// Controllable API mock (overrides the global empty-data mock from test/setup.ts).
const mocks = vi.hoisted(() => {
  const officer = {
    id: 'u1',
    officerId: 'OFF-1',
    firstName: 'Ahmed',
    lastName: 'Ben Salah',
    role: 'officer',
    isValid: true,
    isFrozen: false,
    validated: true,
  }
  return {
    officer,
    list: vi.fn(() => Promise.resolve({ data: { data: [officer] } })),
    softDelete: vi.fn(() => Promise.resolve({ data: {} })),
    restore: vi.fn(() => Promise.resolve({ data: {} })),
    noop: vi.fn(() => Promise.resolve({ data: {} })),
  }
})

vi.mock('@/services/api', () => ({
  apiService: {
    users: {
      list: mocks.list,
      softDelete: mocks.softDelete,
      restore: mocks.restore,
      updateStatus: mocks.noop,
      update: mocks.noop,
      updatePassword: mocks.noop,
      revokeSessions: mocks.noop,
    },
    admin: { validateOfficer: mocks.noop },
  },
  default: {},
}))

import AdminAccountsPage from './AdminAccountsPage'

const renderPage = () => {
  const store = configureStore({
    reducer: { auth: authReducer, notifications: notificationsReducer },
    preloadedState: { auth: { user: { id: 'admin1', role: 'admin' } } } as any,
  })
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeModeProvider>
          <AdminAccountsPage />
        </ThemeModeProvider>
      </BrowserRouter>
    </Provider>
  )
}

describe('AdminAccountsPage — deactivate / restore', () => {
  beforeEach(() => {
    mocks.list.mockClear()
    mocks.softDelete.mockClear()
    mocks.restore.mockClear()
  })

  it('deactivates a user after confirming the dialog', async () => {
    const { container } = renderPage()

    expect(await screen.findByText('Ahmed Ben Salah')).toBeInTheDocument()

    // Open the deactivate confirmation dialog via the row action icon.
    const deactivateIcon = container.querySelector('[data-testid="PersonOffRoundedIcon"]')
    expect(deactivateIcon).not.toBeNull()
    fireEvent.click(deactivateIcon!.closest('button')!)

    // Confirm in the dialog (no reason supplied → softDelete called without a body).
    const confirmBtn = await screen.findByRole('button', { name: /Deactivate account/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => expect(mocks.softDelete).toHaveBeenCalledWith('u1', undefined))

    // Row now reflects the deactivated state.
    expect(await screen.findByText('Deactivated')).toBeInTheDocument()
  }, 15000)

  it('restores an already-deactivated user', async () => {
    // This run returns an officer that is already soft-deleted.
    mocks.list.mockResolvedValueOnce({
      data: { data: [{ ...mocks.officer, deletedAt: '2026-06-01T00:00:00Z', isValid: false }] },
    } as any)
    renderPage()

    expect(await screen.findByText('Ahmed Ben Salah')).toBeInTheDocument()
    // Deactivated rows expose a Restore action instead of the usual controls.
    const restoreBtn = await screen.findByRole('button', { name: /Restore/i })
    fireEvent.click(restoreBtn)

    await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith('u1'))
  }, 15000)
})
