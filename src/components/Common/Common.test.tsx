import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import StatCard from './StatCard'
import ExportButton from './ExportButton'
import { ThemeModeProvider } from '../../themeMode'
import { BrowserRouter } from 'react-router-dom'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'

// Mock useThemeMode
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

describe('Common Components', () => {
  describe('StatCard', () => {
    it('renders label and value', () => {
      render(
        <ThemeModeProvider>
          <StatCard 
            icon={<WarningRoundedIcon />} 
            label="Total Incidents" 
            value={10} 
            trend="up" 
            trendValue="+2"
          />
        </ThemeModeProvider>
      )
      expect(screen.getByText('Total Incidents')).toBeDefined()
      expect(screen.getByText('10')).toBeDefined()
      expect(screen.getByText(/↑ \+2/)).toBeDefined()
    })
  })

  describe('ExportButton', () => {
    it('renders with label', () => {
      render(
        <ThemeModeProvider>
          <ExportButton data={[{ id: 1 }]} label="Export Data" />
        </ThemeModeProvider>
      )
      expect(screen.getByText('Export Data')).toBeDefined()
    })

    it('opens menu on click', () => {
      render(
        <ThemeModeProvider>
          <ExportButton data={[{ id: 1 }]} label="Export Data" />
        </ThemeModeProvider>
      )
      const button = screen.getByRole('button')
      fireEvent.click(button)
      expect(screen.getByText('Select Format')).toBeDefined()
      expect(screen.getByText('CSV')).toBeDefined()
      expect(screen.getByText('Excel')).toBeDefined()
    })

    it('is disabled when data is empty', () => {
      render(
        <ThemeModeProvider>
          <ExportButton data={[]} label="Export Data" />
        </ThemeModeProvider>
      )
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })
})
