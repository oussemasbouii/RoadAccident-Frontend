import { useEffect } from 'react'
import { 
  Box, 
  Stack, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow, 
  Typography,
  alpha,
  useTheme
} from '@mui/material'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import AccessTimeFilledRoundedIcon from '@mui/icons-material/AccessTimeFilledRounded'

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents } from '../slices/incidentsSlice'
import Card from '../../../components/Common/Card'
import Badge from '../../../components/Common/Badge'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'

export default function IncidentsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
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
    <Stack spacing={4} sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>Road Accidents</Typography>
          <Typography color="text.secondary">National emergency monitoring and record management</Typography>
        </Box>
        <ExportButton
          data={displayedIncidents || []}
          filename="incidents"
          label="Export Records"
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatCard 
          icon={<WarningRoundedIcon />} 
          label="Active Incidents" 
          value={activeIncidents} 
          trend="neutral" 
          trendValue="Live updates" 
          intent="danger"
        />
        <StatCard 
          icon={<DirectionsCarRoundedIcon />} 
          label="Total Vehicles" 
          value={totalVehicles} 
          trend="neutral" 
          trendValue="Current records" 
          intent="info"
        />
        <StatCard 
          icon={<LocalHospitalRoundedIcon />} 
          label="Reported Injuries" 
          value={totalInjuries} 
          trend="neutral" 
          trendValue="Medical response" 
          intent="warning"
        />
        <StatCard 
          icon={<AccessTimeFilledRoundedIcon />} 
          label="Avg Response" 
          value={stats.avgResponseTime > 0 ? `${stats.avgResponseTime} min` : '12 min'} 
          trend="down" 
          trendValue="Improved by 4%" 
          intent="success"
        />
      </Box>

      {/* Incidents table */}
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Incident Management Data</Typography>
            <Button variant="primary" size="sm">
              + File New Report
            </Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.action.active, 0.02) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, py: 2 }}>Incident ID</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }} align="right">Metric Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedIncidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    {loading ? 'Fetching national incident data...' : 'No incident records found in current scope.'}
                  </TableCell>
                </TableRow>
              ) : displayedIncidents.map((incident: any, idx: number) => (
                <TableRow
                  key={incident.id}
                  sx={{ 
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                    transition: 'background-color 0.2s'
                  }}
                >
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>
                    #{incident.id}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{incident.location}</TableCell>
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
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>{incident.time}</TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      🚗 {incident.vehicles} <Box component="span" sx={{ mx: 0.5 }}>•</Box> 🏥 {incident.injuries}
                    </Typography>
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
