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
          <KpiSummaryCards
            filtered={filters.filteredIncidents}
            prev={filters.prevPeriodIncidents}
          />
          <LegacyDashboardPanels
            incidents={filters.filteredIncidents}
            alerts={alerts}
          />
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
