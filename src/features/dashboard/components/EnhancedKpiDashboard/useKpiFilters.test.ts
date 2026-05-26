import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKpiFilters } from './useKpiFilters'
import type { Incident } from '../../../incidents/slices/incidentsSlice'

const inc = (overrides: Partial<Incident> = {}): Incident => ({
  id: crypto.randomUUID(),
  location: 'Test',
  severity: 'medium',
  status: 'active',
  time: new Date().toLocaleString(),
  vehicles: 1,
  injuries: 0,
  ...overrides,
})

describe('useKpiFilters', () => {
  it('includes all incidents when no filters active and timestamps absent', () => {
    const { result } = renderHook(() => useKpiFilters([inc(), inc()]))
    expect(result.current.filteredIncidents).toHaveLength(2)
  })

  it('excludes incidents outside the date window', () => {
    const old = new Date()
    old.setFullYear(old.getFullYear() - 2)
    const incidents = [inc({ timestamp: new Date().toISOString() }), inc({ timestamp: old.toISOString() })]
    const { result } = renderHook(() => useKpiFilters(incidents))
    expect(result.current.filteredIncidents).toHaveLength(1)
  })

  it('filters by severity when a severity is toggled on', () => {
    const incidents = [
      inc({ severity: 'critical', timestamp: new Date().toISOString() }),
      inc({ severity: 'low', timestamp: new Date().toISOString() }),
    ]
    const { result } = renderHook(() => useKpiFilters(incidents))
    act(() => result.current.toggleSeverity('critical'))
    expect(result.current.filteredIncidents).toHaveLength(1)
    expect(result.current.filteredIncidents[0].severity).toBe('critical')
  })

  it('toggleSeverity deselects when called twice', () => {
    const { result } = renderHook(() => useKpiFilters([]))
    act(() => result.current.toggleSeverity('high'))
    act(() => result.current.toggleSeverity('high'))
    expect(result.current.severities).not.toContain('high')
  })

  it('prevPeriodIncidents covers the previous equivalent window', () => {
    const now = new Date()
    const inCurrent = new Date(now); inCurrent.setDate(inCurrent.getDate() - 10)
    const inPrev    = new Date(now); inPrev.setDate(inPrev.getDate() - 40)
    const tooOld    = new Date(now); tooOld.setDate(tooOld.getDate() - 100)
    const incidents = [
      inc({ timestamp: inCurrent.toISOString() }),
      inc({ timestamp: inPrev.toISOString() }),
      inc({ timestamp: tooOld.toISOString() }),
    ]
    const { result } = renderHook(() => useKpiFilters(incidents))
    expect(result.current.filteredIncidents).toHaveLength(1)
    expect(result.current.prevPeriodIncidents).toHaveLength(1)
  })

  it('setPreset updates the preset value', () => {
    const { result } = renderHook(() => useKpiFilters([]))
    expect(result.current.preset).toBe('30d')
    act(() => result.current.setPreset('7d'))
    expect(result.current.preset).toBe('7d')
  })
})
