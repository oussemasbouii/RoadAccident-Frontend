import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'
import ReportsPage from './ReportsPage'
import authReducer from '../../auth/slices/authSlice'
import reportsReducer from '../slices/reportsSlice'
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
      reports: reportsReducer,
      incidents: (state = { list: [] }) => state,
      alerts: (state = { list: [] }) => state,
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

describe('ReportsPage', () => {
  it('renders the Reports & Analytics title', () => {
    renderWithProviders(<ReportsPage />)
    expect(screen.getByText('Reports & Analytics')).toBeDefined()
  })

  it('renders time range filter', () => {
    renderWithProviders(<ReportsPage />)
    expect(screen.getByText('This Month')).toBeDefined()
  })

  it('renders StatCards with analytics data', () => {
    const initialState = {
      reports: {
        stats: { totalIncidents: 150, resolvedToday: 5, avgResponseTime: 12, injuryRate: 0.05 },
        incidentsByLocation: [],
        loading: false
      }
    }
    renderWithProviders(<ReportsPage />, { initialState })
    expect(screen.getByText('Total Incidents')).toBeDefined()
    expect(screen.getByText('150')).toBeDefined()
  })
})
