import { useEffect } from 'react'
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents } from '../slices/incidentsSlice'
import Card from '../../../components/Common/Card'
import Badge from '../../../components/Common/Badge'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'

export default function IncidentsPage() {
  const dispatch = useAppDispatch()
  const { list: incidents, loading, stats } = useAppSelector((state) => state.incidents)

  useEffect(() => {
    dispatch(fetchIncidents({ page: 1, limit: 20 }) as any)
  }, [dispatch])

  const severityColor: Record<'critical' | 'high' | 'medium' | 'low', 'danger' | 'warning' | 'info' | 'success'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'success',
  }

  const statusColor: Record<'active' | 'responded' | 'resolved', 'danger' | 'warning' | 'success'> = {
    active: 'danger',
    responded: 'warning',
    resolved: 'success',
  }

  const displayedIncidents = incidents || []
  const activeIncidents = displayedIncidents.filter((i: any) => i.status !== 'resolved').length
  const totalVehicles = displayedIncidents.reduce((sum: number, i: any) => sum + (i.vehicles || 0), 0)
  const totalInjuries = displayedIncidents.reduce((sum: number, i: any) => sum + (i.injuries || 0), 0)

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>Road Accidents</Typography>
          <Typography color="text.secondary">Monitor and manage active incidents in real-time</Typography>
        </Box>
        <ExportButton
          data={displayedIncidents || []}
          filename="incidents"
          label="Export Incidents"
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatCard icon="🚨" label="Active Incidents" value={activeIncidents} trend="neutral" trendValue="From backend" />
        <StatCard icon="🚗" label="Total Vehicles" value={totalVehicles} trend="neutral" trendValue="From backend" />
        <StatCard icon="🏥" label="Reported Injuries" value={totalInjuries} trend="neutral" trendValue="From backend" />
        <StatCard icon="⏱️" label="Avg Response" value={stats.avgResponseTime > 0 ? `${stats.avgResponseTime} min` : 'N/A'} trend="neutral" trendValue="From accidents data" />
      </Box>

      {/* Incidents table */}
      <Card>
        <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Recent Incidents</Typography>
            <Button variant="primary" size="sm">
              + New Report
            </Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedIncidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {loading ? 'Loading incidents...' : 'No incidents returned from backend yet.'}
                  </TableCell>
                </TableRow>
              ) : displayedIncidents.map((incident: any) => (
                <TableRow
                  key={incident.id}
                >
                  <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {incident.id}
                  </TableCell>
                  <TableCell>{incident.location}</TableCell>
                  <TableCell>
                    <Badge
                      label={incident.severity.toUpperCase()}
                      variant={severityColor[incident.severity as 'critical' | 'high' | 'medium' | 'low']}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      label={incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                      variant={statusColor[incident.status as 'active' | 'responded' | 'resolved']}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{incident.time}</TableCell>
                  <TableCell>
                    <Typography variant="caption">🚗 {incident.vehicles} • 🏥 {incident.injuries}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Stack>
  )
}
