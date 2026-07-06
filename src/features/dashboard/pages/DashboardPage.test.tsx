import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'
import DashboardPage from './DashboardPage'
import authReducer from '../../auth/slices/authSlice'
import incidentsReducer from '../../incidents/slices/incidentsSlice'
import alertsReducer from '../../alerts/slices/alertsSlice'
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
      incidents: incidentsReducer,
      alerts: alertsReducer,
      reports: (state = {}) => state,
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

describe('DashboardPage', () => {
  it('renders the Overview title', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText('Overview')).toBeDefined()
  })

  it('renders StatCards with statistics', () => {
    const initialState = {
      incidents: {
        list: [
          { id: 1, status: 'active', location: 'Tunis', severity: 'high', vehicles: 2, injuries: 0 },
          { id: 2, status: 'resolved', location: 'Sfax', severity: 'low', vehicles: 1, injuries: 0 }
        ],
        loading: false,
        stats: { avgResponseTime: 10 }
      },
      alerts: {
        list: [],
        unreadCount: 3,
        error: null
      }
    }
    renderWithProviders(<DashboardPage />, { initialState })
    
    // Some labels appear in more than one card/section, so match leniently.
    expect(screen.getAllByText('Open incidents').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unread Alerts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active Zones').length).toBeGreaterThan(0)
  })
})
