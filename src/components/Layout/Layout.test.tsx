import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import authReducer from '../../features/auth/slices/authSlice'
import { ThemeModeProvider } from '../../themeMode'

// Mock useThemeMode for testing components that use it
vi.mock('../../themeMode', async () => {
  const actual = await vi.importActual('../../themeMode')
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
      alerts: (state = { unreadCount: 5 }) => state,
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

describe('Layout Components', () => {
  describe('Topbar', () => {
    it('renders the Topbar with user initials', () => {
      const initialState = {
        auth: {
          user: { displayName: 'John Doe', officerId: 'JD123', role: 'admin' },
          token: 'fake-token'
        }
      }
      renderWithProviders(<Topbar onMenuClick={vi.fn()} />, { initialState })
      
      expect(screen.getByText('John Doe')).toBeDefined()
      expect(screen.getByText('JD')).toBeDefined()
      expect(screen.getByText('admin')).toBeDefined()
    })

    it('renders the search bar in Topbar', () => {
      renderWithProviders(<Topbar onMenuClick={vi.fn()} />)
      expect(screen.getByPlaceholderText(/Search incidents/i)).toBeDefined()
    })
  })

  describe('Sidebar', () => {
    it('renders the brand title', () => {
      renderWithProviders(<Sidebar collapsed={false} />)
      expect(screen.getByText('RoadAccident')).toBeDefined()
    })

    it('renders navigation items', () => {
      renderWithProviders(<Sidebar collapsed={false} />)
      expect(screen.getByText('Dashboard')).toBeDefined()
      expect(screen.getByText('Accidents')).toBeDefined()
      expect(screen.getByText('Alerts')).toBeDefined()
    })
  })
})
