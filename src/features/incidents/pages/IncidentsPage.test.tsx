import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'
import IncidentsPage from './IncidentsPage'
import authReducer from '../../auth/slices/authSlice'
import incidentsReducer from '../../incidents/slices/incidentsSlice'
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
      alerts: (state = {}) => state,
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

describe('IncidentsPage', () => {
  it('renders the Road Accidents title', () => {
    renderWithProviders(<IncidentsPage />)
    // Title appears in the page header and the table card header.
    expect(screen.getAllByText('Road Accidents').length).toBeGreaterThan(0)
  })

  it('renders the incident management data table', () => {
    const initialState = {
      incidents: {
        list: [
          { id: '1', status: 'active', location: 'Tunis', severity: 'high', vehicles: 2, injuries: 0, time: '2026-02-21 10:00' },
        ],
        loading: false,
        stats: { avgResponseTime: 10 }
      }
    }
    renderWithProviders(<IncidentsPage />, { initialState })
    
    // Desktop table truncates the id (e.g. "#1…"), so match loosely.
    expect(screen.getByText(/#1/)).toBeDefined()
    expect(screen.getByText('Tunis')).toBeDefined()
  })
})
