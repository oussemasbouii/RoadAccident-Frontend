# Enhanced KPI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `NationalKpiDashboard` with `EnhancedKpiDashboard` — a split-layout component with a filter bar, period-comparison KPI cards, time-of-day grid, cause ranking, Mapbox heatmap, and PNG snapshot export.

**Architecture:** Seven focused sub-components compose under a single `index.tsx` orchestrator. All filter state lives in `useKpiFilters`. Left column = analytics stack; right column = sticky Mapbox heatmap panel. No backend changes — everything derives from the existing `/incidents` response.

**Tech Stack:** React 18, TypeScript, MUI v7, Mapbox GL JS (`mapbox-gl`), `html2canvas`, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-05-26-enhanced-kpi-dashboard-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/features/incidents/slices/incidentsSlice.ts` | Modify | Add `cause?: string` to `Incident`; extract in `toUiIncident` |
| `src/i18n.types.ts` | Modify | Extend `TranslationMessages` with new dashboard keys + `accident.cause` |
| `src/locales/en.ts` | Modify | English translations for new keys |
| `src/locales/fr.ts` | Modify | French translations |
| `src/locales/ar.ts` | Modify | Arabic translations |
| `src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.ts` | Create | Filter state, `dateRange`, `filteredIncidents`, `prevPeriodIncidents` |
| `src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.tsx` | Create | 4 KPI cards with %-change delta badges |
| `src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.tsx` | Create | Date presets + custom picker + severity/status chips + PNG export |
| `src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.tsx` | Create | 7×24 heat matrix of incident density |
| `src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.tsx` | Create | Top-8 cause horizontal bars |
| `src/features/dashboard/components/EnhancedKpiDashboard/LegacyDashboardPanels.tsx` | Create | 7-day trend + severity donut + operational pulse (migrated verbatim) |
| `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx` | Create | Mapbox heatmap layer + hotspot list |
| `src/features/dashboard/components/EnhancedKpiDashboard/index.tsx` | Create | Orchestrator — composes all sub-components in split layout |
| `src/features/dashboard/pages/DashboardPage.tsx` | Modify | Swap `NationalKpiDashboard` → `EnhancedKpiDashboard` |
| `src/features/dashboard/pages/DashboardPage.test.tsx` | Modify | Add `mapbox-gl` mock; update import |
| `src/features/dashboard/components/NationalKpiDashboard.tsx` | Delete | Replaced entirely |

---

## Task 1 — Add `cause` to the Incident model

**Files:**
- Modify: `src/features/incidents/slices/incidentsSlice.ts`

- [ ] **Step 1.1 — Add `cause?: string` to the `Incident` interface**

In `incidentsSlice.ts` find the `Incident` interface (lines 4–16). Add the `cause` field after `description`:

```typescript
export interface Incident {
  id: string
  location: string
  latitude?: number
  longitude?: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'responded' | 'resolved'
  time: string
  timestamp?: string
  vehicles: number
  injuries: number
  description?: string
  cause?: string
}
```

- [ ] **Step 1.2 — Extract `cause` in `toUiIncident`**

In `toUiIncident` (the `return { ... }` block around line 95), add `cause` after `description`:

```typescript
    description: raw?.description || raw?.comment || raw?.damagesReport?.damageDescription,
    cause: raw?.damagesReport?.accidentCauseId ?? undefined,
```

- [ ] **Step 1.3 — Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.4 — Commit**

```bash
git add src/features/incidents/slices/incidentsSlice.ts
git commit -m "feat: add cause field to Incident model extracted from damagesReport"
```

---

## Task 2 — Add i18n keys

**Files:**
- Modify: `src/i18n.types.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/fr.ts`
- Modify: `src/locales/ar.ts`

- [ ] **Step 2.1 — Extend `TranslationMessages` in `src/i18n.types.ts`**

Open `src/i18n.types.ts`. Find the `dashboard` section and append these keys to it:

```typescript
    filter_period: string
    filter_custom: string
    filter_from: string
    filter_to: string
    filter_apply: string
    filter_severity: string
    filter_status: string
    export_png: string
    period_comparison_vs: string
    time_of_day_grid: string
    time_of_day_subtitle: string
    no_time_data: string
    cause_ranking: string
    cause_ranking_subtitle: string
    no_cause_data: string
    heatmap_title: string
    heatmap_low: string
    heatmap_high: string
    no_location_data: string
```

Then add a new top-level `accident` property alongside `dashboard`, `alerts`, etc.:

```typescript
  accident: {
    cause: {
      INATTENTION: string
      INAPPROPRIATE_SPEED: string
      INFRACTION: string
      INEXPERIENCE: string
      FATIGUE: string
      ALCOHOL_DRUGS: string
      ILLNESS: string
      ROAD_CONDITION: string
      SIGNAGE_CONDITION: string
      VEHICLE_CONDITION: string
      BREAKDOWN: string
      OVERLOAD: string
      ADVERSE_WEATHER: string
      GLARE: string
      ANIMAL: string
      OTHER: string
      NO_OPINION: string
    }
  }
```

- [ ] **Step 2.2 — Add keys to `src/locales/en.ts`**

At the end of the `dashboard` object (before its closing `}`), add:

```typescript
    filter_period: 'Period',
    filter_custom: 'Custom…',
    filter_from: 'From',
    filter_to: 'To',
    filter_apply: 'Apply',
    filter_severity: 'Severity',
    filter_status: 'Status',
    export_png: 'Export PNG',
    period_comparison_vs: 'vs prev {{n}}d',
    time_of_day_grid: 'Time of Day',
    time_of_day_subtitle: 'Incidents by day of week and hour',
    no_time_data: 'No time data available',
    cause_ranking: 'Top Causes',
    cause_ranking_subtitle: 'Ranked by incident count',
    no_cause_data: 'Cause data not available',
    heatmap_title: 'Incident Heatmap',
    heatmap_low: 'Low density',
    heatmap_high: 'High density',
    no_location_data: 'No location data for this period',
```

After the last top-level section in `en.ts`, add:

```typescript
  accident: {
    cause: {
      INATTENTION: 'Inattention',
      INAPPROPRIATE_SPEED: 'Inappropriate speed',
      INFRACTION: 'Infraction',
      INEXPERIENCE: 'Inexperience',
      FATIGUE: 'Fatigue',
      ALCOHOL_DRUGS: 'Alcohol / Drugs',
      ILLNESS: 'Illness',
      ROAD_CONDITION: 'Road condition',
      SIGNAGE_CONDITION: 'Signage condition',
      VEHICLE_CONDITION: 'Vehicle condition',
      BREAKDOWN: 'Breakdown',
      OVERLOAD: 'Overload',
      ADVERSE_WEATHER: 'Adverse weather',
      GLARE: 'Glare',
      ANIMAL: 'Animal',
      OTHER: 'Other',
      NO_OPINION: 'No opinion',
    },
  },
```

- [ ] **Step 2.3 — Add keys to `src/locales/fr.ts`**

Same structure; paste after the `dashboard` closing brace and at end of top-level object:

```typescript
    // inside dashboard:
    filter_period: 'Période',
    filter_custom: 'Personnalisé…',
    filter_from: 'Du',
    filter_to: 'Au',
    filter_apply: 'Appliquer',
    filter_severity: 'Sévérité',
    filter_status: 'Statut',
    export_png: 'Exporter PNG',
    period_comparison_vs: 'vs préc. {{n}}j',
    time_of_day_grid: 'Heure du jour',
    time_of_day_subtitle: 'Incidents par jour et heure',
    no_time_data: 'Aucune donnée horaire',
    cause_ranking: 'Principales causes',
    cause_ranking_subtitle: 'Classées par nombre d\'incidents',
    no_cause_data: 'Données de cause indisponibles',
    heatmap_title: 'Carte thermique',
    heatmap_low: 'Faible densité',
    heatmap_high: 'Forte densité',
    no_location_data: 'Aucune donnée de localisation',
```

```typescript
  // new top-level section:
  accident: {
    cause: {
      INATTENTION: 'Inattention',
      INAPPROPRIATE_SPEED: 'Vitesse inadaptée',
      INFRACTION: 'Infraction',
      INEXPERIENCE: 'Inexpérience',
      FATIGUE: 'Fatigue',
      ALCOHOL_DRUGS: 'Alcool / Drogues',
      ILLNESS: 'Maladie',
      ROAD_CONDITION: 'État de la route',
      SIGNAGE_CONDITION: 'État de la signalisation',
      VEHICLE_CONDITION: 'État du véhicule',
      BREAKDOWN: 'Panne',
      OVERLOAD: 'Surcharge',
      ADVERSE_WEATHER: 'Météo défavorable',
      GLARE: 'Éblouissement',
      ANIMAL: 'Animal',
      OTHER: 'Autre',
      NO_OPINION: 'Sans opinion',
    },
  },
```

- [ ] **Step 2.4 — Add keys to `src/locales/ar.ts`**

```typescript
    // inside dashboard:
    filter_period: 'الفترة',
    filter_custom: 'مخصص…',
    filter_from: 'من',
    filter_to: 'إلى',
    filter_apply: 'تطبيق',
    filter_severity: 'الخطورة',
    filter_status: 'الحالة',
    export_png: 'تصدير PNG',
    period_comparison_vs: 'مقابل سابق {{n}}ي',
    time_of_day_grid: 'وقت اليوم',
    time_of_day_subtitle: 'الحوادث حسب اليوم والساعة',
    no_time_data: 'لا توجد بيانات وقت',
    cause_ranking: 'أبرز الأسباب',
    cause_ranking_subtitle: 'مرتبة حسب عدد الحوادث',
    no_cause_data: 'بيانات السبب غير متوفرة',
    heatmap_title: 'خريطة الكثافة',
    heatmap_low: 'كثافة منخفضة',
    heatmap_high: 'كثافة عالية',
    no_location_data: 'لا توجد بيانات موقع',
```

```typescript
  // new top-level section:
  accident: {
    cause: {
      INATTENTION: 'عدم الانتباه',
      INAPPROPRIATE_SPEED: 'سرعة غير مناسبة',
      INFRACTION: 'مخالفة',
      INEXPERIENCE: 'قلة الخبرة',
      FATIGUE: 'التعب',
      ALCOHOL_DRUGS: 'الكحول / المخدرات',
      ILLNESS: 'مرض',
      ROAD_CONDITION: 'حالة الطريق',
      SIGNAGE_CONDITION: 'حالة الإشارات',
      VEHICLE_CONDITION: 'حالة المركبة',
      BREAKDOWN: 'عطل',
      OVERLOAD: 'الحمولة الزائدة',
      ADVERSE_WEATHER: 'طقس سيء',
      GLARE: 'الوهج',
      ANIMAL: 'حيوان',
      OTHER: 'أخرى',
      NO_OPINION: 'لا رأي',
    },
  },
```

- [ ] **Step 2.5 — Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.6 — Commit**

```bash
git add src/i18n.types.ts src/locales/en.ts src/locales/fr.ts src/locales/ar.ts
git commit -m "feat: add i18n keys for enhanced KPI dashboard and accident causes"
```

---

## Task 3 — Create `useKpiFilters`

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.ts`
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.test.ts`

- [ ] **Step 3.1 — Write failing tests**

Create `src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.test.ts`:

```typescript
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
```

- [ ] **Step 3.2 — Run to verify failure**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.test.ts
```

Expected: all tests FAIL with "Cannot find module './useKpiFilters'"

- [ ] **Step 3.3 — Create `useKpiFilters.ts`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.ts`:

```typescript
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
    const to = customTo ? new Date(customTo + 'T23:59:59') : (() => { const d = new Date(now); d.setHours(23, 59, 59, 999); return d })()
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
```

- [ ] **Step 3.4 — Run tests to verify they pass**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.test.ts
```

Expected: all 6 tests PASS

- [ ] **Step 3.5 — Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/
git commit -m "feat: add useKpiFilters hook with filter state and period comparison"
```

---

## Task 4 — Create `KpiSummaryCards`

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.tsx`
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.test.tsx`

- [ ] **Step 4.1 — Write failing tests**

Create `src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'
import KpiSummaryCards from './KpiSummaryCards'
import type { Incident } from '../../../incidents/slices/incidentsSlice'

vi.mock('../../../../themeMode', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  useThemeMode: () => ({ mode: 'light', locale: 'en-US' }),
}))

const theme = createTheme()
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const inc = (o: Partial<Incident> = {}): Incident => ({
  id: crypto.randomUUID(), location: 'X', severity: 'medium',
  status: 'active', time: '', vehicles: 1, injuries: 0, ...o,
})

describe('KpiSummaryCards', () => {
  it('renders 4 cards', () => {
    wrap(<KpiSummaryCards filtered={[]} prev={[]} />)
    expect(screen.getAllByRole('article')).toHaveLength(4)
  })

  it('shows ↑ badge when current total exceeds previous', () => {
    wrap(<KpiSummaryCards filtered={[inc(), inc()]} prev={[inc()]} />)
    expect(screen.getByTestId('delta-total').textContent).toMatch(/↑/)
  })

  it('shows ↓ badge when current total is below previous', () => {
    wrap(<KpiSummaryCards filtered={[inc()]} prev={[inc(), inc()]} />)
    expect(screen.getByTestId('delta-total').textContent).toMatch(/↓/)
  })

  it('shows → badge when current equals previous', () => {
    wrap(<KpiSummaryCards filtered={[inc()]} prev={[inc()]} />)
    expect(screen.getByTestId('delta-total').textContent).toMatch(/→/)
  })
})
```

- [ ] **Step 4.2 — Run to verify failure**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.test.tsx
```

Expected: FAIL — "Cannot find module './KpiSummaryCards'"

- [ ] **Step 4.3 — Create `KpiSummaryCards.tsx`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.tsx`:

```typescript
import { useMemo } from 'react'
import { Box, Paper, Stack, Typography, alpha, useTheme } from '@mui/material'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

interface Props {
  filtered: Incident[]
  prev: Incident[]
}

interface DeltaProps {
  current: number
  previous: number
  'data-testid'?: string
}

function DeltaBadge({ current, previous, 'data-testid': testId }: DeltaProps) {
  const theme = useTheme()
  const pct = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <Typography variant="caption" data-testid={testId} sx={{ color: 'text.disabled', fontWeight: 700 }}>→ 0%</Typography>
  return (
    <Typography
      variant="caption"
      data-testid={testId}
      sx={{ fontWeight: 700, color: pct > 0 ? theme.palette.warning.main : theme.palette.success.main }}
    >
      {pct > 0 ? `↑ +${pct}%` : `↓ ${pct}%`}
    </Typography>
  )
}

export default function KpiSummaryCards({ filtered, prev }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()

  const cards = useMemo(() => {
    const curOpen     = filtered.filter((i) => i.status !== 'resolved').length
    const prevOpen    = prev.filter((i) => i.status !== 'resolved').length
    const curInjuries = filtered.reduce((s, i) => s + i.injuries, 0)
    const prevInjuries = prev.reduce((s, i) => s + i.injuries, 0)
    const curCritical = filtered.filter((i) => i.severity === 'critical').length
    const prevCritical = prev.filter((i) => i.severity === 'critical').length

    return [
      { label: t('dashboard.incidents'),      value: filtered.length, prevValue: prev.length,  icon: <TimelineRoundedIcon fontSize="small" />,      tint: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main,  testId: 'delta-total'    },
      { label: t('dashboard.open_incidents'), value: curOpen,         prevValue: prevOpen,      icon: <WarningRoundedIcon fontSize="small" />,        tint: alpha(theme.palette.error.main, 0.08),   color: theme.palette.error.main,    testId: 'delta-open'     },
      { label: t('dashboard.injuries'),       value: curInjuries,     prevValue: prevInjuries,  icon: <LocalHospitalRoundedIcon fontSize="small" />,  tint: alpha(theme.palette.warning.main, 0.08), color: theme.palette.warning.main,  testId: 'delta-injuries' },
      { label: t('dashboard.critical_cases'), value: curCritical,     prevValue: prevCritical,  icon: <ErrorRoundedIcon fontSize="small" />,          tint: alpha(theme.palette.error.main, 0.06),   color: theme.palette.error.main,    testId: 'delta-critical' },
    ]
  }, [filtered, prev, t, theme.palette])

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
      {cards.map((c) => (
        <Paper
          key={c.label}
          role="article"
          variant="outlined"
          sx={{ p: 2, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.7), bgcolor: alpha(theme.palette.background.paper, 0.96) }}
        >
          <Stack spacing={1}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: c.tint, color: c.color }}>
              {c.icon}
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{c.label}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -0.5, lineHeight: 1.05 }}>{c.value}</Typography>
            </Box>
            <DeltaBadge current={c.value} previous={c.prevValue} data-testid={c.testId} />
          </Stack>
        </Paper>
      ))}
    </Box>
  )
}
```

- [ ] **Step 4.4 — Run tests to verify they pass**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.test.tsx
```

Expected: all 4 tests PASS

- [ ] **Step 4.5 — Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/
git commit -m "feat: add KpiSummaryCards with automatic period-comparison delta badges"
```

---

## Task 5 — Create `KpiFilterBar`

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.tsx`
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.test.tsx`

- [ ] **Step 5.1 — Write failing tests**

Create `src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'
import KpiFilterBar from './KpiFilterBar'
import type { KpiFiltersResult } from './useKpiFilters'

vi.mock('../../../../themeMode', () => ({
  useTranslation: () => ({ t: (k: string) => {
    const m: Record<string,string> = {
      'dashboard.filter_period': 'Period',
      'dashboard.filter_custom': 'Custom…',
      'dashboard.filter_from':   'From',
      'dashboard.filter_to':     'To',
      'dashboard.filter_severity': 'Severity',
      'dashboard.filter_status':   'Status',
      'dashboard.export_png':      'Export PNG',
    }
    return m[k] ?? k
  }}
}))
vi.mock('html2canvas', () => ({ default: vi.fn().mockResolvedValue({ toDataURL: () => '' }) }))

const theme = createTheme()
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

function makeFilters(overrides: Partial<KpiFiltersResult> = {}): KpiFiltersResult {
  return {
    preset: '30d', customFrom: '', customTo: '',
    severities: [], statuses: [],
    dateRange: { from: new Date(), to: new Date() },
    filteredIncidents: [], prevPeriodIncidents: [],
    setPreset: vi.fn(), setCustomFrom: vi.fn(), setCustomTo: vi.fn(),
    toggleSeverity: vi.fn(), toggleStatus: vi.fn(),
    ...overrides,
  }
}

describe('KpiFilterBar', () => {
  it('renders all 5 preset chips + Custom', () => {
    wrap(<KpiFilterBar filters={makeFilters()} exportRef={{ current: null }} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('7 days')).toBeInTheDocument()
    expect(screen.getByText('30 days')).toBeInTheDocument()
    expect(screen.getByText('90 days')).toBeInTheDocument()
    expect(screen.getByText('1 year')).toBeInTheDocument()
    expect(screen.getByText('Custom…')).toBeInTheDocument()
  })

  it('calls setPreset with correct value on chip click', () => {
    const setPreset = vi.fn()
    wrap(<KpiFilterBar filters={makeFilters({ setPreset })} exportRef={{ current: null }} />)
    fireEvent.click(screen.getByText('7 days'))
    expect(setPreset).toHaveBeenCalledWith('7d')
  })

  it('shows date inputs only when preset is custom', () => {
    wrap(<KpiFilterBar filters={makeFilters({ preset: 'custom' })} exportRef={{ current: null }} />)
    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
  })

  it('calls toggleSeverity on severity chip click', () => {
    const toggleSeverity = vi.fn()
    wrap(<KpiFilterBar filters={makeFilters({ toggleSeverity })} exportRef={{ current: null }} />)
    fireEvent.click(screen.getByText('Critical'))
    expect(toggleSeverity).toHaveBeenCalledWith('critical')
  })
})
```

- [ ] **Step 5.2 — Run to verify failure**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.test.tsx
```

Expected: FAIL — "Cannot find module './KpiFilterBar'"

- [ ] **Step 5.3 — Create `KpiFilterBar.tsx`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.tsx`:

```typescript
import { RefObject, useState } from 'react'
import { Box, Button, Chip, Collapse, Paper, Stack, TextField, Typography, alpha, useTheme } from '@mui/material'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import html2canvas from 'html2canvas'
import type { KpiFiltersResult, Preset } from './useKpiFilters'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

interface Props {
  filters: KpiFiltersResult
  exportRef: RefObject<HTMLDivElement>
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Today',   value: 'today' },
  { label: '7 days',  value: '7d'    },
  { label: '30 days', value: '30d'   },
  { label: '90 days', value: '90d'   },
  { label: '1 year',  value: '1y'    },
]

const SEVERITIES: { label: string; value: Incident['severity']; color: string }[] = [
  { label: 'Critical', value: 'critical', color: '#B91C1C' },
  { label: 'High',     value: 'high',     color: '#EA580C' },
  { label: 'Medium',   value: 'medium',   color: '#0284C7' },
  { label: 'Low',      value: 'low',      color: '#16A34A' },
]

const STATUSES: { label: string; value: Incident['status'] }[] = [
  { label: 'Active',    value: 'active'    },
  { label: 'Responded', value: 'responded' },
  { label: 'Resolved',  value: 'resolved'  },
]

export default function KpiFilterBar({ filters, exportRef }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!exportRef.current || exporting) return
    setExporting(true)
    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: theme.palette.background.default,
        useCORS: true,
        scale: 2,
      })
      const link = document.createElement('a')
      link.download = `kpi-snapshot-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.7), bgcolor: alpha(theme.palette.background.paper, 0.96) }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.75}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 48 }}>
            {t('dashboard.filter_period')}
          </Typography>
          {PRESETS.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              size="small"
              onClick={() => filters.setPreset(p.value)}
              variant={filters.preset === p.value ? 'filled' : 'outlined'}
              color={filters.preset === p.value ? 'primary' : 'default'}
              sx={{ fontWeight: 600 }}
            />
          ))}
          <Chip
            label={t('dashboard.filter_custom')}
            size="small"
            onClick={() => filters.setPreset('custom')}
            variant={filters.preset === 'custom' ? 'filled' : 'outlined'}
            color={filters.preset === 'custom' ? 'primary' : 'default'}
            sx={{ fontWeight: 600 }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<CameraAltRoundedIcon />}
            onClick={handleExport}
            disabled={exporting}
            sx={{ borderRadius: 6, whiteSpace: 'nowrap' }}
          >
            {t('dashboard.export_png')}
          </Button>
        </Stack>

        <Collapse in={filters.preset === 'custom'}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <TextField
              label={t('dashboard.filter_from')}
              type="date"
              size="small"
              value={filters.customFrom}
              onChange={(e) => filters.setCustomFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'aria-label': 'From' }}
              sx={{ width: 160 }}
            />
            <TextField
              label={t('dashboard.filter_to')}
              type="date"
              size="small"
              value={filters.customTo}
              onChange={(e) => filters.setCustomTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'aria-label': 'To' }}
              sx={{ width: 160 }}
            />
          </Stack>
        </Collapse>

        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" gap={0.5}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 48 }}>
            {t('dashboard.filter_severity')}
          </Typography>
          {SEVERITIES.map((s) => {
            const selected = filters.severities.includes(s.value)
            return (
              <Chip
                key={s.value}
                label={s.label}
                size="small"
                onClick={() => filters.toggleSeverity(s.value)}
                variant={selected ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600, ...(selected && { bgcolor: alpha(s.color, 0.15), borderColor: s.color, color: s.color }) }}
              />
            )
          })}
          <Box sx={{ width: 12 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            {t('dashboard.filter_status')}
          </Typography>
          {STATUSES.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              size="small"
              onClick={() => filters.toggleStatus(s.value)}
              variant={filters.statuses.includes(s.value) ? 'filled' : 'outlined'}
              color={filters.statuses.includes(s.value) ? 'primary' : 'default'}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}
```

- [ ] **Step 5.4 — Run tests to verify they pass**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.test.tsx
```

Expected: all 4 tests PASS

- [ ] **Step 5.5 — Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/
git commit -m "feat: add KpiFilterBar with date presets, custom range, severity/status chips, and PNG export"
```

---

## Task 6 — Create `TimeOfDayGrid`

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.tsx`
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.test.tsx`

- [ ] **Step 6.1 — Write failing tests**

Create `src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'
import TimeOfDayGrid, { buildMatrix } from './TimeOfDayGrid'
import type { Incident } from '../../../incidents/slices/incidentsSlice'

vi.mock('../../../../themeMode', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  useThemeMode: () => ({ mode: 'light', locale: 'en-US' }),
}))

const theme = createTheme()
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const inc = (timestamp?: string): Incident => ({
  id: crypto.randomUUID(), location: 'X', severity: 'low',
  status: 'active', time: timestamp ?? '', vehicles: 1, injuries: 0, timestamp,
})

describe('buildMatrix', () => {
  it('returns a 7×24 zero matrix for empty input', () => {
    const m = buildMatrix([])
    expect(m).toHaveLength(7)
    expect(m[0]).toHaveLength(24)
    expect(m.flat().every((v) => v === 0)).toBe(true)
  })

  it('places a count in the correct day/hour cell', () => {
    // Find a Wednesday at 14:00 local time by constructing the date directly
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() - 3 + 7) % 7)) // most recent Wednesday
    d.setHours(14, 0, 0, 0)
    const m = buildMatrix([inc(d.toISOString())])
    const dayIdx  = (d.getDay() + 6) % 7  // Mon=0
    expect(m[dayIdx][14]).toBe(1)
  })
})

describe('TimeOfDayGrid', () => {
  it('renders Mon and Sun labels', () => {
    wrap(<TimeOfDayGrid incidents={[]} />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('shows empty state when no incidents have valid timestamps', () => {
    wrap(<TimeOfDayGrid incidents={[inc()]} />)
    expect(screen.getByText(/no time data/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6.2 — Run to verify failure**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.test.tsx
```

Expected: FAIL — "Cannot find module './TimeOfDayGrid'"

- [ ] **Step 6.3 — Create `TimeOfDayGrid.tsx`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.tsx`:

```typescript
import { useMemo } from 'react'
import { Box, Paper, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

const DAY_LABELS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_TICKS  = [0, 6, 12, 18, 23]
const HOUR_LABELS = ['00', '06', '12', '18', '23']

export function buildMatrix(incidents: Incident[]): number[][] {
  const m: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const inc of incidents) {
    if (!inc.timestamp) continue
    const d = new Date(inc.timestamp)
    if (Number.isNaN(d.getTime())) continue
    const dayIdx = (d.getDay() + 6) % 7   // Sun(0)→Mon=0
    m[dayIdx][d.getHours()] += 1
  }
  return m
}

export default function TimeOfDayGrid({ incidents }: { incidents: Incident[] }) {
  const theme = useTheme()
  const { t } = useTranslation()

  const matrix   = useMemo(() => buildMatrix(incidents), [incidents])
  const maxCount = useMemo(() => Math.max(...matrix.flat(), 1), [matrix])
  const hasData  = useMemo(() => matrix.flat().some((v) => v > 0), [matrix])

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.25, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.7), bgcolor: alpha(theme.palette.background.paper, 0.96) }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{t('dashboard.time_of_day_grid')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('dashboard.time_of_day_subtitle')}</Typography>
        </Box>

        {!hasData ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('dashboard.no_time_data')}</Typography>
          </Box>
        ) : (
          <Box>
            {matrix.map((row, dayIdx) => (
              <Box
                key={DAY_LABELS[dayIdx]}
                sx={{ display: 'grid', gridTemplateColumns: '32px repeat(24, 1fr)', gap: '2px', mb: '2px' }}
              >
                <Typography variant="caption" color="text.secondary"
                  sx={{ fontWeight: 700, fontSize: 10, alignSelf: 'center', lineHeight: '14px' }}
                >
                  {DAY_LABELS[dayIdx]}
                </Typography>
                {row.map((count, hourIdx) => (
                  <Tooltip
                    key={hourIdx}
                    title={`${DAY_LABELS[dayIdx]} ${String(hourIdx).padStart(2,'0')}:00 — ${count} incident${count !== 1 ? 's' : ''}`}
                    placement="top"
                  >
                    <Box
                      sx={{
                        height: 14,
                        borderRadius: '2px',
                        bgcolor: alpha(theme.palette.primary.main, count === 0 ? 0.05 : Math.max(0.1, count / maxCount)),
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            ))}

            {/* Hour axis */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '32px repeat(24, 1fr)', gap: '2px', mt: 0.5 }}>
              <Box />
              {Array.from({ length: 24 }, (_, i) => (
                <Typography key={i} variant="caption" color="text.secondary"
                  sx={{ fontSize: 8, textAlign: 'center', lineHeight: 1 }}
                >
                  {HOUR_TICKS.includes(i) ? HOUR_LABELS[HOUR_TICKS.indexOf(i)] : ''}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}
```

- [ ] **Step 6.4 — Run tests to verify they pass**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.test.tsx
```

Expected: all 4 tests PASS

- [ ] **Step 6.5 — Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/
git commit -m "feat: add TimeOfDayGrid 7x24 heat matrix"
```

---

## Task 7 — Create `CauseRanking`

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.tsx`
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.test.tsx`

- [ ] **Step 7.1 — Write failing tests**

Create `src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'
import CauseRanking, { buildCauseRows } from './CauseRanking'
import type { Incident } from '../../../incidents/slices/incidentsSlice'

vi.mock('../../../../themeMode', () => ({
  useTranslation: () => ({
    t: (k: string) => {
      if (k === 'accident.cause.INATTENTION') return 'Inattention'
      if (k === 'accident.cause.FATIGUE')     return 'Fatigue'
      return k
    },
  }),
}))

const theme = createTheme()
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
const inc = (cause?: string): Incident => ({
  id: crypto.randomUUID(), location: 'X', severity: 'medium',
  status: 'active', time: '', vehicles: 1, injuries: 0, cause,
})

describe('buildCauseRows', () => {
  it('returns empty array for empty input', () => {
    expect(buildCauseRows([])).toHaveLength(0)
  })

  it('sorts by count descending', () => {
    const rows = buildCauseRows([inc('INATTENTION'), inc('INATTENTION'), inc('FATIGUE')])
    expect(rows[0].cause).toBe('INATTENTION')
    expect(rows[0].count).toBe(2)
  })

  it('groups undefined cause as OTHER', () => {
    const rows = buildCauseRows([inc(undefined), inc('FATIGUE')])
    expect(rows.find((r) => r.cause === 'OTHER')?.count).toBe(1)
  })

  it('caps at 8 rows', () => {
    const rows = buildCauseRows('ABCDEFGHIJ'.split('').map((c) => inc(c)))
    expect(rows.length).toBeLessThanOrEqual(8)
  })
})

describe('CauseRanking', () => {
  it('renders translated cause labels', () => {
    wrap(<CauseRanking incidents={[inc('INATTENTION'), inc('FATIGUE')]} />)
    expect(screen.getByText('Inattention')).toBeInTheDocument()
    expect(screen.getByText('Fatigue')).toBeInTheDocument()
  })

  it('shows empty state when all incidents have no cause', () => {
    wrap(<CauseRanking incidents={[inc()]} />)
    expect(screen.getByText(/Cause data not available/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7.2 — Run to verify failure**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.test.tsx
```

Expected: FAIL — "Cannot find module './CauseRanking'"

- [ ] **Step 7.3 — Create `CauseRanking.tsx`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.tsx`:

```typescript
import { useMemo } from 'react'
import { Box, Paper, Stack, Typography, alpha, useTheme } from '@mui/material'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

export interface CauseRow {
  cause: string
  count: number
  share: number
}

export function buildCauseRows(incidents: Incident[]): CauseRow[] {
  if (incidents.length === 0) return []
  const counts: Record<string, number> = {}
  for (const inc of incidents) {
    const key = inc.cause ?? 'OTHER'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const total = incidents.length
  return Object.entries(counts)
    .map(([cause, count]) => ({ cause, count, share: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export default function CauseRanking({ incidents }: { incidents: Incident[] }) {
  const theme = useTheme()
  const { t } = useTranslation()

  const rows     = useMemo(() => buildCauseRows(incidents), [incidents])
  const hasData  = useMemo(() => incidents.some((i) => i.cause !== undefined), [incidents])
  const maxCount = useMemo(() => Math.max(...rows.map((r) => r.count), 1), [rows])

  const label = (code: string) => {
    try { return (t as any)(`accident.cause.${code}`) || code }
    catch { return code }
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.25, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.7), bgcolor: alpha(theme.palette.background.paper, 0.96) }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{t('dashboard.cause_ranking')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('dashboard.cause_ranking_subtitle')}</Typography>
        </Box>

        {!hasData || rows.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('dashboard.no_cause_data')}</Typography>
          </Box>
        ) : (
          <Stack spacing={0.75}>
            {rows.map((row, idx) => (
              <Box key={row.cause} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.disabled" sx={{ width: 18, textAlign: 'right', fontWeight: 700, flexShrink: 0 }}>
                  {idx + 1}.
                </Typography>
                <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.divider, 0.3), borderRadius: 1, height: 10 }}>
                  <Box sx={{ width: `${(row.count / maxCount) * 100}%`, height: '100%', bgcolor: theme.palette.warning.main, borderRadius: 1, transition: 'width 0.4s ease' }} />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 700, width: 140, flexShrink: 0 }} noWrap>
                  {label(row.cause)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ width: 24, textAlign: 'right', flexShrink: 0 }}>
                  {row.count}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}
```

- [ ] **Step 7.4 — Run tests to verify they pass**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.test.tsx
```

Expected: all 6 tests PASS

- [ ] **Step 7.5 — Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/
git commit -m "feat: add CauseRanking component with top-8 horizontal bars"
```

---

## Task 8 — Create `IncidentHeatmapPanel`

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx`
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.test.tsx`

- [ ] **Step 8.1 — Write failing tests**

Create `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'

vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn((evt: string, cb: () => void) => { if (evt === 'load') cb() }),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
      flyTo: vi.fn(),
      addControl: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    accessToken: '',
  },
}))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))
vi.mock('../../../../utils/mapboxToken', () => ({
  getMapboxToken: () => 'fake-token',
  getMapboxTokenError: () => null,
}))
vi.mock('../../../../themeMode', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import IncidentHeatmapPanel from './IncidentHeatmapPanel'
import type { Incident } from '../../../incidents/slices/incidentsSlice'

const theme = createTheme()
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
const inc = (o: Partial<Incident> = {}): Incident => ({
  id: crypto.randomUUID(), location: 'Test', severity: 'medium',
  status: 'active', time: '', vehicles: 1, injuries: 0, ...o,
})

describe('IncidentHeatmapPanel', () => {
  it('renders the heatmap title key', () => {
    wrap(<IncidentHeatmapPanel incidents={[]} />)
    expect(screen.getByText('dashboard.heatmap_title')).toBeInTheDocument()
  })

  it('shows no-location message when no incidents have coordinates', () => {
    wrap(<IncidentHeatmapPanel incidents={[inc()]} />)
    expect(screen.getByText('dashboard.no_location_data')).toBeInTheDocument()
  })

  it('renders hotspot list items when incidents have coordinates', () => {
    const incidents = [
      inc({ location: 'Route GP1', latitude: 36.8, longitude: 10.1 }),
      inc({ location: 'Route GP1', latitude: 36.8, longitude: 10.1 }),
      inc({ location: 'Tunis Nord', latitude: 36.9, longitude: 10.2 }),
    ]
    wrap(<IncidentHeatmapPanel incidents={incidents} />)
    expect(screen.getByText('Route GP1')).toBeInTheDocument()
    expect(screen.getByText('Tunis Nord')).toBeInTheDocument()
  })
})
```

- [ ] **Step 8.2 — Run to verify failure**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.test.tsx
```

Expected: FAIL — "Cannot find module './IncidentHeatmapPanel'"

- [ ] **Step 8.3 — Create `IncidentHeatmapPanel.tsx`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Avatar, Box, Chip, List, ListItem, ListItemAvatar, ListItemText,
  Paper, Stack, Typography, alpha, useTheme,
} from '@mui/material'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { getMapboxToken } from '../../../../utils/mapboxToken'
import { useTranslation } from '../../../../themeMode'

interface HotspotRow {
  location: string
  count: number
  avgLat: number | null
  avgLng: number | null
}

function buildHotspots(incidents: Incident[]): HotspotRow[] {
  const acc: Record<string, { location: string; count: number; lats: number[]; lngs: number[] }> = {}
  for (const inc of incidents) {
    const key = inc.location.trim().toLowerCase()
    if (!acc[key]) acc[key] = { location: inc.location.trim(), count: 0, lats: [], lngs: [] }
    acc[key].count += 1
    if (inc.latitude != null && inc.longitude != null) {
      acc[key].lats.push(inc.latitude)
      acc[key].lngs.push(inc.longitude)
    }
  }
  return Object.values(acc)
    .map((v) => ({
      location: v.location,
      count: v.count,
      avgLat: v.lats.length ? v.lats.reduce((a, b) => a + b, 0) / v.lats.length : null,
      avgLng: v.lngs.length ? v.lngs.reduce((a, b) => a + b, 0) / v.lngs.length : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function buildGeoJson(incidents: Incident[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: incidents
      .filter((i) => i.latitude != null && i.longitude != null)
      .map((i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [i.longitude!, i.latitude!] },
        properties: { id: i.id },
      })),
  }
}

export default function IncidentHeatmapPanel({ incidents }: { incidents: Incident[] }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const sourceLoaded = useRef(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const hotspots = useMemo(() => buildHotspots(incidents), [incidents])
  const hasCoords = useMemo(() => incidents.some((i) => i.latitude != null && i.longitude != null), [incidents])

  useEffect(() => {
    const token = getMapboxToken()
    if (!token || !containerRef.current || mapRef.current) return
    mapboxgl.accessToken = token

    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [9.5615, 34.7678],
        zoom: 6,
      })
      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.on('load', () => {
        map.addSource('incidents-heat', { type: 'geojson', data: buildGeoJson(incidents) })
        map.addLayer({
          id: 'incidents-heat-layer',
          type: 'heatmap',
          source: 'incidents-heat',
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 2],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(29,78,216,0)', 0.2, 'rgba(29,78,216,0.6)',
              0.5, 'rgba(251,146,60,0.8)', 0.8, 'rgba(239,68,68,0.9)', 1, 'rgb(185,28,28)',
            ] as any,
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 18, 10, 35] as any,
            'heatmap-opacity': 0.85,
          },
        })
        sourceLoaded.current = true
      })
      map.on('error', () => setMapError('Map failed to load'))
      mapRef.current = map
    } catch {
      setMapError('Map initialization failed')
    }
    return () => { mapRef.current?.remove(); mapRef.current = null; sourceLoaded.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current || !sourceLoaded.current) return
    ;(mapRef.current.getSource('incidents-heat') as mapboxgl.GeoJSONSource | undefined)
      ?.setData(buildGeoJson(incidents))
  }, [incidents])

  const handleHotspotClick = (row: HotspotRow) => {
    if (!mapRef.current || row.avgLat == null || row.avgLng == null) return
    mapRef.current.flyTo({ center: [row.avgLng, row.avgLat], zoom: 10 })
  }

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.7), bgcolor: alpha(theme.palette.background.paper, 0.96), overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ px: 2.25, pt: 2.25, pb: 1 }}>
        <Typography sx={{ fontWeight: 800 }}>{t('dashboard.heatmap_title')}</Typography>
      </Box>

      <Box sx={{ position: 'relative', height: 320, flexShrink: 0 }}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
        {mapError && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.background.paper, 0.9) }}>
            <Typography variant="body2" color="text.secondary">{mapError}</Typography>
          </Box>
        )}
        {!hasCoords && !mapError && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.background.paper, 0.85) }}>
            <Typography variant="body2" color="text.secondary">{t('dashboard.no_location_data')}</Typography>
          </Box>
        )}
      </Box>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary">{t('dashboard.heatmap_low')}</Typography>
        <Box sx={{ flex: 1, height: 5, borderRadius: 1, background: 'linear-gradient(to right, rgba(29,78,216,0.6), rgba(251,146,60,0.8), rgb(185,28,28))' }} />
        <Typography variant="caption" color="text.secondary">{t('dashboard.heatmap_high')}</Typography>
      </Stack>

      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, fontWeight: 700 }}>
          {t('dashboard.top_10_black_spot_locations')}
        </Typography>
        <List disablePadding dense sx={{ maxHeight: 220, overflow: 'auto', mt: 0.5 }}>
          {hotspots.length === 0 ? (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">{t('dashboard.no_hotspot_data_yet')}</Typography>
            </Box>
          ) : hotspots.map((row, idx) => (
            <ListItem
              key={`${row.location}-${idx}`}
              onClick={() => handleHotspotClick(row)}
              sx={{ px: 1, py: 0.5, borderRadius: 2, cursor: 'pointer', mb: 0.25, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) } }}
            >
              <ListItemAvatar sx={{ minWidth: 32 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}>
                  {idx + 1}
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={<Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>{row.location}</Typography>} />
              <Chip size="small" label={row.count} sx={{ height: 18, fontSize: 10 }} />
            </ListItem>
          ))}
        </List>
      </Box>
    </Paper>
  )
}
```

- [ ] **Step 8.4 — Run tests to verify they pass**

```bash
npx vitest run src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.test.tsx
```

Expected: all 3 tests PASS

- [ ] **Step 8.5 — Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/
git commit -m "feat: add IncidentHeatmapPanel with Mapbox heatmap layer and hotspot list"
```

---

## Task 9 — Create `LegacyDashboardPanels`

This task migrates the three existing panels (7-day trend chart, severity donut, operational pulse) from `NationalKpiDashboard.tsx` verbatim — no redesign.

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/LegacyDashboardPanels.tsx`

- [ ] **Step 9.1 — Create `LegacyDashboardPanels.tsx`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/LegacyDashboardPanels.tsx` with this skeleton, then fill in by copying from `NationalKpiDashboard.tsx`:

```typescript
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  alpha, Avatar, Box, Button, Chip, Divider, List, ListItem,
  ListItemAvatar, ListItemText, Paper, Stack, Typography, useTheme,
} from '@mui/material'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'
import type { Alert } from '../../../alerts/slices/alertsSlice'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation, useThemeMode } from '../../../../themeMode'

// ── Copy these helper functions verbatim from NationalKpiDashboard.tsx ──
// Lines 47–52:   toDate()
// Lines 53–57:   startOfDay()
// Lines 59–62:   formatDayLabel()
// Lines 63–66:   formatDateLabel()
// Lines 67–69:   normalizeLocation()
// Lines 71–73:   clamp()
// Lines 75–101:  buildSeries()
// Lines 139–144: formatIncidentTime()
//
// ── Copy these type declarations ──
// Lines 33–38: type SeverityRow
// Lines 40–45: type HotspotRow

interface Props {
  incidents: Incident[]
  alerts: Alert[]
}

export default function LegacyDashboardPanels({ incidents, alerts }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const { locale } = useThemeMode()
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null)

  // ── Copy these useMemo blocks verbatim from NationalKpiDashboard.tsx ──
  // Lines 152–153: series
  // Lines 155–171: severityRows
  // Lines 173–179: derived scalars (totalIncidents, totalAlerts, openIncidents, etc.)
  // Lines 180–188: peakDay, activeHotspot, maxValue
  // Lines 191–204: donutGradient

  return (
    <>
      {/* 7-day trend panel — copy <Paper> block from lines 338–514 of NationalKpiDashboard.tsx */}
      {/* Severity donut panel — copy <Paper> block from lines 519–609 */}
      {/* Operational pulse panel — copy <Paper> block from lines 611–700 */}
      {/* Hotspot list panel — copy <Paper> block from lines 702–857 */}
    </>
  )
}
```

After filling in all copied content, verify TypeScript compiles cleanly:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9.2 — Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/LegacyDashboardPanels.tsx
git commit -m "refactor: extract legacy KPI panels into LegacyDashboardPanels"
```

---

## Task 10 — Compose orchestrator, wire up, and delete old component

**Files:**
- Create: `src/features/dashboard/components/EnhancedKpiDashboard/index.tsx`
- Modify: `src/features/dashboard/pages/DashboardPage.tsx`
- Modify: `src/features/dashboard/pages/DashboardPage.test.tsx`
- Delete: `src/features/dashboard/components/NationalKpiDashboard.tsx`

- [ ] **Step 10.1 — Create `EnhancedKpiDashboard/index.tsx`**

Create `src/features/dashboard/components/EnhancedKpiDashboard/index.tsx`:

```typescript
import { useRef } from 'react'
import { Box, Stack } from '@mui/material'
import type { Alert } from '../../../alerts/slices/alertsSlice'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useKpiFilters } from './useKpiFilters'
import KpiFilterBar from './KpiFilterBar'
import KpiSummaryCards from './KpiSummaryCards'
import LegacyDashboardPanels from './LegacyDashboardPanels'
import TimeOfDayGrid from './TimeOfDayGrid'
import CauseRanking from './CauseRanking'
import IncidentHeatmapPanel from './IncidentHeatmapPanel'

interface Props {
  incidents: Incident[]
  alerts: Alert[]
}

export default function EnhancedKpiDashboard({ incidents, alerts }: Props) {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const filters = useKpiFilters(incidents)

  return (
    <Stack spacing={2.5} ref={dashboardRef}>
      <KpiFilterBar filters={filters} exportRef={dashboardRef} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1fr 340px' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          <KpiSummaryCards filtered={filters.filteredIncidents} prev={filters.prevPeriodIncidents} />
          <LegacyDashboardPanels incidents={filters.filteredIncidents} alerts={alerts} />
          <TimeOfDayGrid incidents={filters.filteredIncidents} />
          <CauseRanking incidents={filters.filteredIncidents} />
        </Stack>

        <Box sx={{ position: { xl: 'sticky' }, top: { xl: 16 }, alignSelf: 'start' }}>
          <IncidentHeatmapPanel incidents={filters.filteredIncidents} />
        </Box>
      </Box>
    </Stack>
  )
}
```

- [ ] **Step 10.2 — Update `DashboardPage.tsx`**

In `src/features/dashboard/pages/DashboardPage.tsx`, replace the import:

```typescript
// Remove:
import NationalKpiDashboard from '../components/NationalKpiDashboard'

// Add:
import EnhancedKpiDashboard from '../components/EnhancedKpiDashboard'
```

Replace the usage (inside the JSX, around line 206):

```typescript
// Remove:
<NationalKpiDashboard incidents={incidents as Incident[]} alerts={alerts as Alert[]} />

// Add:
<EnhancedKpiDashboard incidents={incidents as Incident[]} alerts={alerts as Alert[]} />
```

- [ ] **Step 10.3 — Update `DashboardPage.test.tsx` to add the mapboxgl mock**

At the top of `src/features/dashboard/pages/DashboardPage.test.tsx`, before all imports, add:

```typescript
import { vi } from 'vitest'

vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn((evt: string, cb: () => void) => { if (evt === 'load') cb() }),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
      flyTo: vi.fn(),
      addControl: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    accessToken: '',
  },
}))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))
```

- [ ] **Step 10.4 — Delete `NationalKpiDashboard.tsx`**

```bash
git rm src/features/dashboard/components/NationalKpiDashboard.tsx
```

- [ ] **Step 10.5 — Verify full TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10.6 — Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass. If any test still references `NationalKpiDashboard` by name, update it to `EnhancedKpiDashboard`.

- [ ] **Step 10.7 — Add `.superpowers/` to `.gitignore`**

```bash
echo ".superpowers/" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore .superpowers brainstorm artifacts"
```

- [ ] **Step 10.8 — Final commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/index.tsx
git add src/features/dashboard/pages/DashboardPage.tsx
git add src/features/dashboard/pages/DashboardPage.test.tsx
git commit -m "feat: wire up EnhancedKpiDashboard and replace NationalKpiDashboard"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Add `cause` to Incident model | Task 1 |
| i18n keys for all new UI strings + accident causes | Task 2 |
| Filter bar — date presets + custom range | Task 5 |
| Filter bar — severity + status multi-select chips | Task 5 |
| PNG snapshot export via `html2canvas` | Task 5 |
| Automatic period comparison (previous equivalent window) | Task 3 |
| KPI cards with %-change delta badges | Task 4 |
| Time-of-day grid 7×24 heat matrix | Task 6 |
| Cause ranking top-8 horizontal bars | Task 7 |
| Mapbox dark-style heatmap native layer | Task 8 |
| Hotspot list with flyTo on click | Task 8 |
| Split layout: left analytics + right sticky heatmap | Task 10 |
| Migrate existing trend/donut/pulse panels | Task 9 |
| No backend changes required | ✅ confirmed — all data from existing `/incidents` response |
