import { useEffect } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchAnalytics, fetchStats, fetchIncidentsByLocation } from '../slices/reportsSlice'
import Card from '../../../components/Common/Card'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'

export default function ReportsPage() {
  const dispatch = useAppDispatch()
  const { analytics, stats, incidentsByLocation, loading } = useAppSelector((state) => state.reports)

  useEffect(() => {
    dispatch(fetchAnalytics() as any)
    dispatch(fetchStats() as any)
    dispatch(fetchIncidentsByLocation() as any)
  }, [dispatch])

  const statsData = (stats as any)?.data || stats || {}

  const reportData = {
    totalIncidents: Number(statsData.totalIncidents ?? statsData.total ?? 0),
    resolvedToday: Number(statsData.resolvedToday ?? statsData.resolved ?? 0),
    avgResponseTime: Number(statsData.avgResponseTime ?? 0),
    injuryRate: Number(statsData.injuryRate ?? 0),
    weeklyTrend: statsData.weeklyTrend || 'No trend data',
    satisfactionScore: Number(statsData.satisfactionScore ?? 0),
  }

  const locationRows = Array.isArray(incidentsByLocation)
    ? incidentsByLocation
    : (incidentsByLocation as any)?.data || []

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>Reports & Analytics</Typography>
          <Typography color="text.secondary">View detailed statistics and performance metrics</Typography>
        </Box>
        <ExportButton
          data={incidentsByLocation || []}
          filename="reports-incidents-by-location"
          label="Export Report"
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        <StatCard icon="📈" label="Total Incidents (This Month)" value={reportData.totalIncidents} trend="up" trendValue={reportData.weeklyTrend} />
        <StatCard icon="✅" label="Resolved Today" value={reportData.resolvedToday} trend="neutral" trendValue="From backend" />
        <StatCard icon="⏱️" label="Avg Response Time" value={reportData.avgResponseTime > 0 ? `${reportData.avgResponseTime}m` : 'N/A'} trend="neutral" trendValue="From backend" />
        <StatCard icon="🏥" label="Injury Rate" value={`${(reportData.injuryRate * 100).toFixed(1)}%`} trend="neutral" trendValue="From backend" />
        <StatCard icon="⭐" label="Satisfaction Score" value={reportData.satisfactionScore} trend="neutral" trendValue="From backend" />
        <StatCard icon="👥" label="Weekly Trend" value={reportData.weeklyTrend} trend="neutral" trendValue="From backend" />
      </Box>

      {/* Recent incidents summary */}
      <Card>
        <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h6">Top Incident Locations</Typography></Box>
        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
          {locationRows.length === 0 ? (
            <Box sx={{ p: 2.5, color: 'text.secondary' }}>
              {loading ? 'Loading locations...' : 'No location data available from backend.'}
            </Box>
          ) : (
            locationRows.map((item: any, idx: number) => {
              const location = item.location || item.name || `Location ${idx + 1}`
              const count = Number(item.count ?? item.incidents ?? item.total ?? 0)
              const percentage = Number(item.percentage ?? item.percent ?? 0)

              return (
                <Box key={`${location}-${idx}`} sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box><Typography sx={{ fontWeight: 700 }}>{location}</Typography><Typography variant="body2" color="text.secondary">{count} incidents</Typography></Box>
                  <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>{percentage}%</Typography>
                </Box>
              )
            })
          )}
        </Stack>
      </Card>
    </Stack>
  )
}
