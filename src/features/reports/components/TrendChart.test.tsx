import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThemeModeProvider } from '../../../themeMode'
import TrendChart from './TrendChart'
import type { Incident } from '../../incidents/slices/incidentsSlice'

const incidents: Partial<Incident>[] = [
  { id: '1', time: '2026-05-01T10:00:00Z', timestamp: '2026-05-01T10:00:00Z', severity: 'high', status: 'active', location: 'Tunis', vehicles: 1, injuries: 0 },
  { id: '2', time: '2026-05-01T14:00:00Z', timestamp: '2026-05-01T14:00:00Z', severity: 'low', status: 'resolved', location: 'Sfax', vehicles: 1, injuries: 0 },
  { id: '3', time: '2026-05-08T09:00:00Z', timestamp: '2026-05-08T09:00:00Z', severity: 'critical', status: 'active', location: 'Sousse', vehicles: 2, injuries: 1 },
]

describe('TrendChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ThemeModeProvider>
        <TrendChart incidents={incidents as Incident[]} period="week" />
      </ThemeModeProvider>
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders a heading', () => {
    render(
      <ThemeModeProvider>
        <TrendChart incidents={incidents as Incident[]} period="week" />
      </ThemeModeProvider>
    )
    expect(screen.getByText(/incident trend/i)).toBeDefined()
  })
})
