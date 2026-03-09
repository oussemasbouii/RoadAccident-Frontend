import { useEffect, useState } from 'react'
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
  useTheme,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import AccessTimeFilledRoundedIcon from '@mui/icons-material/AccessTimeFilledRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents, fetchIncidentById, createIncident, updateIncident, clearError } from '../slices/incidentsSlice'
import type { Incident } from '../slices/incidentsSlice'
import Card from '../../../components/Common/Card'
import AddIncidentDrawer from '../components/AddIncidentDrawer'
import Badge from '../../../components/Common/Badge'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'
import IncidentsMap from '../../../components/Common/IncidentsMap'

export default function IncidentsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const { list: incidents, loading, stats, error: incidentsError } = useAppSelector((state) => state.incidents)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingIncident, setEditingIncident] = useState<any | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null)

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    setDrawerMode('create')
    setEditingIncident(null)
    dispatch(clearError())
  }

  const handleOpenCreateDrawer = () => {
    setDrawerMode('create')
    setEditingIncident(null)
    setDrawerOpen(true)
  }

  const handleOpenEditDrawer = async (id: string) => {
    try {
      setDrawerLoading(true)
      setEditingIncidentId(id)
      dispatch(clearError())
      const payload = await dispatch(fetchIncidentById(id) as any).unwrap()
      setEditingIncident(payload?.data ?? payload)
      setDrawerMode('edit')
      setDrawerOpen(true)
    } catch {
      // Error is already pushed into slice state via thunk rejectWithValue.
    } finally {
      setDrawerLoading(false)
      setEditingIncidentId(null)
    }
  }

  useEffect(() => {
    dispatch(fetchIncidents({ page: 1, limit: 20 }) as any)
  }, [dispatch])

  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'all',
    location: '',
    search: ''
  })

  const displayedIncidents = (incidents || []).filter((incident: Incident) => {
    const matchesSeverity = filters.severity === 'all' || incident.severity === filters.severity
    const matchesStatus = filters.status === 'all' || incident.status === filters.status
    const matchesLocation = !filters.location || incident.location.toLowerCase().includes(filters.location.toLowerCase())
    const matchesSearch = !filters.search || 
      incident.id.toString().includes(filters.search) ||
      incident.location.toLowerCase().includes(filters.search.toLowerCase())
    
    return matchesSeverity && matchesStatus && matchesLocation && matchesSearch
  })

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

  const activeIncidents = displayedIncidents.filter((i: Incident) => i.status !== 'resolved').length
  const totalVehicles = displayedIncidents.reduce((sum: number, i: Incident) => sum + (i.vehicles || 0), 0)
  const totalInjuries = displayedIncidents.reduce((sum: number, i: Incident) => sum + (i.injuries || 0), 0)

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

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Incident Map
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live geographic view of reported incidents
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <IncidentsMap incidents={displayedIncidents} height={420} />
        </Box>
      </Card>

      {/* Filtering controls */}
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, alignItems: 'end' }}>
          <TextField
            label="Search incidents"
            variant="outlined"
            size="small"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label="Location"
            variant="outlined"
            size="small"
            value={filters.location}
            onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
            sx={{ bgcolor: 'background.paper' }}
          />
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>Severity</InputLabel>
            <Select
              value={filters.severity}
              label="Severity"
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            >
              <MenuItem value="all">All Severities</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="responded">Responded</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Incidents table */}
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Incident Management Data</Typography>
              <Typography variant="body2" color="text.secondary">
                {displayedIncidents.length} report(s) in current view
              </Typography>
            </Box>
            <Button variant="primary" size="sm" onClick={handleOpenCreateDrawer} aria-label="File new incident report">
              + File New Report
            </Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead sx={{ bgcolor: alpha(theme.palette.action.active, 0.02) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, py: 2 }}>
                  Incident ID
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Location
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Severity
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Reported At
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }} align="right">
                  Actions
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }} align="right">
                  Metric Details
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedIncidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    {loading ? 'Fetching national incident data...' : 'No incident records found in current scope.'}
                  </TableCell>
                </TableRow>
              ) : displayedIncidents.map((incident: Incident) => (
                <TableRow
                  key={incident.id}
                  sx={{
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.045) },
                    transition: 'background-color 0.2s',
                  }}
                >
                  <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>
                    #{incident.id}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, maxWidth: 260 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={incident.location}
                    >
                      {incident.location}
                    </Typography>
                  </TableCell>
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
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {incident.time}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<EditRoundedIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleOpenEditDrawer(incident.id)}
                      loading={drawerLoading && editingIncidentId === incident.id}
                      disabled={drawerLoading && editingIncidentId !== incident.id}
                      aria-label={`Edit incident ${incident.id}`}
                    >
                      {drawerLoading && editingIncidentId === incident.id ? 'Opening...' : 'Edit'}
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Vehicles {incident.vehicles} <Box component="span" sx={{ mx: 0.5 }}>|</Box> Injuries {incident.injuries}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <AddIncidentDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        error={drawerOpen ? incidentsError : null}
        mode={drawerMode}
        initialData={editingIncident}
        onSubmit={async (payload) => {
          if (drawerMode === 'edit' && editingIncident?.id) {
            await dispatch(updateIncident({ id: String(editingIncident.id), payload }) as any).unwrap()
            return
          }
          await dispatch(createIncident(payload) as any).unwrap()
        }}
      />
    </Stack>
  )
}
