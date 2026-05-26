import { useMemo, useState } from 'react'
import type { Incident } from '../../../incidents/slices/incidentsSlice'

export type Preset = 'today' | '7d' | '30d' | '90d' | '1y' | 'custom'

export interface DateRange {
  from: Date
  to: Date
}

export interface KpiFiltersResult {
  preset: Preset
  customFrom: string
  customTo: string
  severities: Incident['severity'][]
  statuses: Incident['status'][]
  dateRange: DateRange
  filteredIncidents: Incident[]
  prevPeriodIncidents: Incident[]
  setPreset: (p: Preset) => void
  setCustomFrom: (d: string) => void
  setCustomTo: (d: string) => void
  toggleSeverity: (s: Incident['severity']) => void
  toggleStatus: (s: Incident['status']) => void
}

const DAYS_BACK: Record<Exclude<Preset, 'custom'>, number> = {
  today: 0,
  '7d': 6,
  '30d': 29,
  '90d': 89,
  '1y': 364,
}

function buildDateRange(preset: Preset, customFrom: string, customTo: string): DateRange {
  const now = new Date()

  if (preset === 'custom') {
    const from = customFrom
      ? new Date(customFrom + 'T00:00:00')
      : (() => { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d })()
    const to = customTo
      ? new Date(customTo + 'T23:59:59')
      : (() => { const d = new Date(now); d.setHours(23, 59, 59, 999); return d })()
    return { from, to }
  }

  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  const from = new Date(now)
  from.setDate(from.getDate() - DAYS_BACK[preset])
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

function applyFilters(
  incidents: Incident[],
  range: DateRange,
  severities: Incident['severity'][],
  statuses: Incident['status'][]
): Incident[] {
  return incidents.filter((inc) => {
    if (inc.timestamp) {
      const d = new Date(inc.timestamp)
      if (!Number.isNaN(d.getTime()) && (d < range.from || d > range.to)) return false
    }
    if (severities.length > 0 && !severities.includes(inc.severity)) return false
    if (statuses.length > 0 && !statuses.includes(inc.status)) return false
    return true
  })
}

export function useKpiFilters(incidents: Incident[]): KpiFiltersResult {
  const [preset, setPreset] = useState<Preset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [severities, setSeverities] = useState<Incident['severity'][]>([])
  const [statuses, setStatuses] = useState<Incident['status'][]>([])

  const dateRange = useMemo(
    () => buildDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  )

  const filteredIncidents = useMemo(
    () => applyFilters(incidents, dateRange, severities, statuses),
    [incidents, dateRange, severities, statuses]
  )

  const prevPeriodIncidents = useMemo(() => {
    const duration = dateRange.to.getTime() - dateRange.from.getTime()
    const prevRange: DateRange = {
      from: new Date(dateRange.from.getTime() - duration),
      to:   new Date(dateRange.from.getTime()),
    }
    return applyFilters(incidents, prevRange, severities, statuses)
  }, [incidents, dateRange, severities, statuses])

  const toggleSeverity = (s: Incident['severity']) =>
    setSeverities((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const toggleStatus = (s: Incident['status']) =>
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  return {
    preset, customFrom, customTo, severities, statuses,
    dateRange, filteredIncidents, prevPeriodIncidents,
    setPreset, setCustomFrom, setCustomTo, toggleSeverity, toggleStatus,
  }
}
