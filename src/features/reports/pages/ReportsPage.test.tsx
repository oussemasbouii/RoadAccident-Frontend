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
  it('renders the Reports title', () => {
    renderWithProviders(<ReportsPage />)
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0)
  })

  it('renders the date-range filter', () => {
    renderWithProviders(<ReportsPage />)
    expect(screen.getByLabelText(/From/i)).toBeDefined()
  })

  it('renders StatCards derived from the incidents list', () => {
    const initialState = {
      incidents: {
        list: [
          { id: '1', status: 'active', location: 'Tunis', severity: 'high', vehicles: 2, injuries: 1, time: '2026-02-21 10:00' },
          { id: '2', status: 'resolved', location: 'Sfax', severity: 'low', vehicles: 1, injuries: 0, time: '2026-02-20 09:00' },
        ],
      },
    }
    renderWithProviders(<ReportsPage />, { initialState })
    // First stat card is labelled with the incidents title ("Road Accidents").
    expect(screen.getAllByText('Road Accidents').length).toBeGreaterThan(0)
  })
})
