# Enhanced KPI Dashboard — Design Spec

**Date:** 2026-05-26  
**Feature:** Enhanced KPI Dashboard with filters, time-of-day grid, cause ranking, period comparison, Mapbox heatmap, and PNG snapshot export  
**Branch:** taha

---

## Overview

Replace `NationalKpiDashboard` with a new `EnhancedKpiDashboard` component that adds six capabilities to the existing KPI panels:

1. **Filter bar** — date range (presets + custom) · severity multi-select · status multi-select
2. **Period comparison badges** — automatic %-change vs the previous equivalent window on every KPI card
3. **Time-of-day grid** — 7 × 24 heat matrix showing incident density by day-of-week and hour
4. **Cause ranking** — horizontal bar list of top-8 accident causes from filtered incidents
5. **Mapbox heatmap panel** — native heatmap layer on a persistent right-column map, with hotspot list below
6. **PNG snapshot export** — `html2canvas` capture of the full dashboard

No backend changes are required. All features derive from data already in the existing `/incidents` API response.

---

## Layout

**Split layout (Option C):** two-column grid inside `EnhancedKpiDashboard`.

- **Left column** (flex, `1fr`): filter bar → KPI summary cards → existing 7-day trend + severity donut (unchanged) → time-of-day grid → cause ranking
- **Right column** (fixed `340px`, `position: sticky; top: 0`): Mapbox heatmap panel (fills available height) → hotspot list below map

The filter bar spans the full width above the two-column split.

---

## Data Model Change

Add `cause?: string` to the `Incident` interface in `incidentsSlice.ts`:

```ts
export interface Incident {
  // ...existing fields...
  cause?: string  // from raw.damagesReport.accidentCauseId
}
```

In `toUiIncident`, extract:
```ts
cause: raw?.damagesReport?.accidentCauseId ?? undefined,
```

This is a pure frontend extraction — the field already exists in the API response.

---

## Component Structure

```
src/features/dashboard/components/EnhancedKpiDashboard/
  index.tsx                 orchestrator — composes all sub-components
  useKpiFilters.ts          filter state + derived data + period comparison
  KpiFilterBar.tsx          date presets, custom picker, severity/status chips, PNG export
  KpiSummaryCards.tsx       4 KPI cards with %-change badges
  TimeOfDayGrid.tsx         7×24 heat matrix
  CauseRanking.tsx          top-8 cause horizontal bars
  IncidentHeatmapPanel.tsx  Mapbox heatmap layer + hotspot list
```

`NationalKpiDashboard.tsx` is deleted. `DashboardPage` imports `EnhancedKpiDashboard` in its place.

---

## `useKpiFilters` Hook

### State shape
```ts
type Preset = 'today' | '7d' | '30d' | '90d' | '1y' | 'custom'

interface KpiFilters {
  preset: Preset
  customFrom: string   // ISO date string 'YYYY-MM-DD', only used when preset === 'custom'
  customTo: string
  severities: Incident['severity'][]  // empty = all
  statuses: Incident['status'][]      // empty = all
}
```

### Derived outputs
- **`dateRange: { from: Date; to: Date }`** — resolved window for the current preset or custom range
- **`filteredIncidents: Incident[]`** — incidents inside `dateRange` matching severity and status filters
- **`prevPeriodIncidents: Incident[]`** — incidents in the previous window of equal duration (`from - duration` → `from`), same severity/status filters applied; used only for %-change calculation, not for rendering charts

### Period comparison logic
```
duration = dateRange.to - dateRange.from  (milliseconds)
prevFrom = dateRange.from - duration
prevTo   = dateRange.from
```
`prevPeriodIncidents` is filtered by this window with the same severity/status filters.

### Default state
`preset: '30d'`, all severities selected, all statuses selected.

---

## `KpiFilterBar`

### Date range
- Five preset chips: **Today · 7 days · 30 days · 90 days · 1 year** — MUI `Chip` with `variant="filled"` on the active one
- A **Custom…** chip that, when clicked, expands two MUI `TextField type="date"` inputs (From / To) with an **Apply** button inline
- When `preset === 'custom'` and dates are valid, `dateRange` resolves to the custom range

### Severity chips
Multi-select MUI `Chip` row: Critical · High · Medium · Low. Each chip uses its severity color when selected. Empty selection = all included.

### Status chips
Multi-select MUI `Chip` row: Active · Responded · Resolved. Empty selection = all included.

### Export button
MUI `Button` with a camera icon. On click: calls `html2canvas(dashboardRootRef.current)` then triggers a PNG download named `kpi-snapshot-{ISO-date}.png`. The ref is passed down from `index.tsx` via prop.

### Layout
Full-width `Paper` above the two-column grid. Internally two rows: top row = period chips + export button; bottom row = severity + status chips. On small screens, wraps into a single column stack.

---

## `KpiSummaryCards`

Four cards in a `grid-template-columns: repeat(4, 1fr)` grid:

| Card | Value | Delta |
|------|-------|-------|
| Total Incidents | `filteredIncidents.length` | vs `prevPeriodIncidents.length` |
| Open | `filteredIncidents.filter(status !== 'resolved').length` | vs prev open |
| Injuries | `sum(filteredIncidents.injuries)` | vs prev injuries |
| Critical | `filteredIncidents.filter(severity === 'critical').length` | vs prev critical |

**Delta badge logic:**
```
pct = ((current - prev) / (prev || 1)) * 100
pct > 0  → ↑ +{pct}%  orange/red  (more incidents = worse)
pct < 0  → ↓ {pct}%   green       (fewer incidents = better)
pct === 0 → → 0%      muted
```
All four metrics follow the same direction rule — on a road accident dashboard, any increase is a warning signal.

Each card shows: metric label · large number · delta badge · small "vs prev {N}d" caption.

---

## `TimeOfDayGrid`

### Data
For each `filteredIncident` with a valid `timestamp`:
- extract `dayOfWeek` (0 = Sunday … 6 = Saturday, remapped to Mon–Sun display order)
- extract `hourOfDay` (0–23)
- accumulate into a `counts[7][24]` matrix

### Rendering
- 7 rows (Mon → Sun) × 24 columns (00h → 23h)
- Each cell is a `Box` with `bgcolor` set to `alpha(theme.palette.primary.main, opacity)` where `opacity = count / maxCount` (min 0.05 for empty cells to keep them visible)
- Row labels on the left (3-letter day abbreviations, i18n-aware)
- Hour labels at the bottom: 00 · 06 · 12 · 18 · 23
- `Tooltip` on each cell: `"{day} {hour}:00 — {count} incidents"`
- Cell size: `min(100% / 24, 22px)` wide, `18px` tall; scales down on small screens

### Empty state
If `filteredIncidents` has no valid timestamps, show a centered "No time data available" message.

---

## `CauseRanking`

### Data
Group `filteredIncidents` by `incident.cause` (the new field). Count per cause. Sort descending. Take top 8. Incidents with `cause === undefined` are grouped under an `OTHER` bucket.

### Rendering
Horizontal bar list. Each row:
- Rank number (muted)
- `AccidentCauseCode` label via i18n key `accident.cause.{code}` (new i18n keys to add)
- Proportional fill bar using `theme.palette.warning.main`
- Count on the right

If all `filteredIncidents` have `cause === undefined`, show "Cause data not available for this period" empty state.

---

## `IncidentHeatmapPanel`

### Map setup
- `mapboxgl.Map` instance in a `useEffect` (same pattern as `IncidentsMap.tsx`)
- Style: `mapbox://styles/mapbox/dark-v11` (dark works better for heatmaps)
- Default center: `[9.5615, 34.7678]` (Tunisia), zoom 6
- Navigation controls only (no geocoder, no fullscreen)

### Heatmap layer
GeoJSON source `id: 'incidents-heat'` with a `FeatureCollection` of `Point` features — one per `filteredIncident` with valid `latitude` and `longitude`.

Layer spec:
```js
{
  id: 'incidents-heat-layer',
  type: 'heatmap',
  source: 'incidents-heat',
  paint: {
    'heatmap-weight': 1,
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 2],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0,   'rgba(29,78,216,0)',
      0.2, 'rgba(29,78,216,0.6)',
      0.5, 'rgba(251,146,60,0.8)',
      0.8, 'rgba(239,68,68,0.9)',
      1,   'rgb(185,28,28)'
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 18, 10, 35],
    'heatmap-opacity': 0.85,
  }
}
```

When `filteredIncidents` changes, update the source data via `map.getSource('incidents-heat').setData(newGeoJson)` — no layer recreation.

### Density legend
A small horizontal gradient bar below the map: "Low density" → "High density" using the same colour stops as the heatmap.

### Hotspot list
Reuses the existing hotspot-building logic (`buildHotspots` function, moved from `NationalKpiDashboard`). Shows top-5 locations in a compact scrollable list below the map. Clicking a hotspot flies the map to that location: compute the average `latitude` and average `longitude` of all incidents in the hotspot bucket that have valid coordinates, then call `map.flyTo({ center: [avgLng, avgLat], zoom: 10 })`. If no incident in the bucket has coordinates, the click is a no-op.

### Empty state
If no `filteredIncidents` have coordinates, show "No location data — coordinates missing for this period" over a dimmed map placeholder.

---

## `index.tsx` (Orchestrator)

```tsx
export default function EnhancedKpiDashboard({ incidents, alerts }: Props) {
  const dashboardRef = useRef<HTMLDivElement>(null)
  const filters = useKpiFilters(incidents)

  return (
    <Stack spacing={2.5} ref={dashboardRef}>
      <KpiFilterBar filters={filters} exportRef={dashboardRef} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 340px' }, gap: 2 }}>
        <Stack spacing={2}>
          <KpiSummaryCards filtered={filters.filteredIncidents} prev={filters.prevPeriodIncidents} />
          {/* existing 7-day trend + severity donut + operational pulse — migrated from NationalKpiDashboard */}
          <ExistingTrendAndSeverityPanels incidents={filters.filteredIncidents} alerts={alerts} />
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

The three existing panels (7-day trend, severity donut, operational pulse) are extracted into a private `ExistingTrendAndSeverityPanels` component inside `index.tsx` — their markup is moved verbatim, no redesign.

---

## i18n Keys to Add

New keys needed in `en.ts` / `fr.ts` / `ar.ts`:

```ts
dashboard: {
  // existing keys unchanged...
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
  no_cause_data: 'Cause data not available for this period',
  heatmap_title: 'Incident Heatmap',
  heatmap_low: 'Low density',
  heatmap_high: 'High density',
  no_location_data: 'No location data for this period',
}

// New top-level section:
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
  }
}
```

---

## Backend Requirements

**None.** All features are derived from the existing `GET /incidents` response. The `damagesReport.accidentCauseId` field already returns in every incident payload — it was simply never mapped into the UI model.

---

## Files Changed / Created

| File | Action |
|------|--------|
| `src/features/incidents/slices/incidentsSlice.ts` | Add `cause?: string` to `Incident`; extract in `toUiIncident` |
| `src/features/dashboard/components/EnhancedKpiDashboard/index.tsx` | Create |
| `src/features/dashboard/components/EnhancedKpiDashboard/useKpiFilters.ts` | Create |
| `src/features/dashboard/components/EnhancedKpiDashboard/KpiFilterBar.tsx` | Create |
| `src/features/dashboard/components/EnhancedKpiDashboard/KpiSummaryCards.tsx` | Create |
| `src/features/dashboard/components/EnhancedKpiDashboard/TimeOfDayGrid.tsx` | Create |
| `src/features/dashboard/components/EnhancedKpiDashboard/CauseRanking.tsx` | Create |
| `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx` | Create |
| `src/features/dashboard/pages/DashboardPage.tsx` | Swap import |
| `src/features/dashboard/components/NationalKpiDashboard.tsx` | Delete |
| `src/locales/en.ts` | Add i18n keys |
| `src/locales/fr.ts` | Add i18n keys |
| `src/locales/ar.ts` | Add i18n keys |
| `src/i18n.types.ts` | Extend `TranslationMessages` type |
