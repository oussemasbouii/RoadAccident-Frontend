import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'
import SettingsPage from './SettingsPage'
import AdminAccountsPage from './AdminAccountsPage'
import authReducer from '../../auth/slices/authSlice'
import { ThemeModeProvider } from '../../../themeMode'

// Mock useThemeMode
vi.mock('../../../themeMode', async () => {
  const actual = await vi.importActual('../../../themeMode')
  return {
    ...actual,
    useThemeMode: () => ({
      mode: 'light',
      toggleMode: vi.fn(),
    }),
  }
})

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: initialState,
  })
}

const renderWithProviders = (ui: React.ReactElement, { initialState = {} } = {}) => {
  const store = createMockStore(initialState)
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeModeProvider>
          {ui}
        </ThemeModeProvider>
      </BrowserRouter>
    </Provider>
  )
}

describe('Settings & Admin Pages', () => {
  describe('SettingsPage', () => {
    it('renders user profile in settings', () => {
      const initialState = {
        auth: {
          user: { displayName: 'John Doe', officerId: 'JD123', role: 'admin' },
          token: 'fake-token'
        }
      }
      renderWithProviders(<SettingsPage />, { initialState })
      
      const names = screen.getAllByText('John Doe')
      expect(names.length).toBeGreaterThan(0)
      expect(screen.getByText('ADMIN')).toBeDefined()
      const ids = screen.getAllByText('JD123')
      expect(ids.length).toBeGreaterThan(0)
    })

    it('renders system preferences', () => {
      renderWithProviders(<SettingsPage />)
      expect(screen.getByText(/Enable High-Contrast/i)).toBeDefined()
    })
  })

  describe('AdminAccountsPage', () => {
    it('renders the page title', () => {
      renderWithProviders(<AdminAccountsPage />)
      expect(screen.getByText('User Accounts')).toBeDefined()
    })

    it('renders the search field', () => {
      renderWithProviders(<AdminAccountsPage />)
      expect(screen.getByLabelText(/Search users/i)).toBeDefined()
    })
  })
})
