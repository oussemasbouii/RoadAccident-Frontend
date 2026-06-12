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
  InputLabel,
} from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { listParent, listChild, tableParent, tableRow, fadeIn } from '../../../utils/motion'
import { StatCardSkeleton, TableRowSkeleton } from '../../../components/Common/Skeletons'

const MotionBox = motion(Box)
const MotionTableBody = motion(TableBody)
const MotionTableRow = motion(TableRow)
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import AccessTimeFilledRoundedIcon from '@mui/icons-material/AccessTimeFilledRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents, fetchIncidentById, createIncident, updateIncident, clearError, generateIncidentReport } from '../slices/incidentsSlice'
import type { Incident } from '../slices/incidentsSlice'
import Card from '../../../components/Common/Card'
import AddIncidentDrawer from '../components/AddIncidentDrawer'
import Badge from '../../../components/Common/Badge'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'
import IncidentsMap from '../../../components/Common/IncidentsMap'
import { useTranslation, useThemeMode } from '../../../themeMode'

export default function IncidentsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const { t } = useTranslation()
  const { locale } = useThemeMode()
  const { list: incidents, loading, stats, error: incidentsError } = useAppSelector((state) => state.incidents)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingIncident, setEditingIncident] = useState<any | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null)
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null)

  const handleGenerateReport = async (id: string) => {
    try {
      setGeneratingReportId(id)
      const result = await dispatch(generateIncidentReport({ id, documentType: 'PDF' }) as any).unwrap()
      if (result?.url) window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch {
      // error handled by slice state
    } finally {
      setGeneratingReportId(null)
    }
  }

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

  const severityLabel: Record<string, string> = {
    critical: t('dashboard.critical'),
    high: t('dashboard.high'),
    medium: t('dashboard.medium'),
    low: t('dashboard.low'),
  }

  const statusColor: Record<'active' | 'responded' | 'resolved', 'danger' | 'warning' | 'success'> = {
    active: 'danger',
    responded: 'warning',
    resolved: 'success',
  }

  const statusLabel: Record<string, string> = {
    active: t('reports.active'),
    responded: t('reports.responded'),
    resolved: t('reports.resolved'),
  }

  function formatTime(raw: string | undefined): string {
    if (!raw) return ''
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw
    return d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
  }

  const activeIncidents = displayedIncidents.filter((i: Incident) => i.status !== 'resolved').length
  const totalVehicles = displayedIncidents.reduce((sum: number, i: Incident) => sum + (i.vehicles || 0), 0)
  const totalInjuries = displayedIncidents.reduce((sum: number, i: Incident) => sum + (i.injuries || 0), 0)

  return (
    <Stack spacing={4} sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>{t('incidents.title')}</Typography>
          <Typography color="text.secondary">{t('incidents.subtitle')}</Typography>
        </Box>
        <ExportButton
          data={displayedIncidents || []}
          filename="incidents"
          label={t('incidents.export_records')}
          title={t('incidents.incident_operations')}
          variant="incidents"
        />
      </Box>

      <AnimatePresence mode="wait">
        {loading && incidents.length === 0 ? (
          <MotionBox
            key="skeleton-stats"
            variants={listParent}
            initial="initial"
            animate="animate"
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}
          >
            {[0, 1, 2, 3].map((i) => (
              <motion.div key={i} variants={listChild}><StatCardSkeleton /></motion.div>
            ))}
          </MotionBox>
        ) : (
          <MotionBox
            key="live-stats"
            variants={listParent}
            initial="initial"
            animate="animate"
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}
          >
            <StatCard icon={<WarningRoundedIcon />} label={t('incidents.active_incidents')} value={activeIncidents} trend="neutral" trendValue={t('incidents.live_updates')} intent="danger" />
            <StatCard icon={<DirectionsCarRoundedIcon />} label={t('incidents.total_vehicles')} value={totalVehicles} trend="neutral" trendValue={t('incidents.current_records')} intent="info" />
            <StatCard icon={<LocalHospitalRoundedIcon />} label={t('incidents.reported_injuries')} value={totalInjuries} trend="neutral" trendValue={t('incidents.medical_response')} intent="warning" />
            <StatCard icon={<AccessTimeFilledRoundedIcon />} label={t('incidents.avg_response')} value={stats.avgResponseTime > 0 ? `${stats.avgResponseTime} min` : '12 min'} trend="down" trendValue={t('incidents.improved_by_4_percent')} intent="success" />
          </MotionBox>
        )}
      </AnimatePresence>

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('incidents.map_title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('incidents.map_subtitle')}</Typography>
        </Box>
        <IncidentsMap incidents={displayedIncidents} height="clamp(480px, 60vh, 640px)" />
      </Card>

      {/* Filtering controls */}
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, alignItems: 'end' }}>
          <TextField
            label={t('incidents.search_incidents')}
            variant="outlined"
            size="small"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label={t('incidents.location')}
            variant="outlined"
            size="small"
            value={filters.location}
            onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
            sx={{ bgcolor: 'background.paper' }}
          />
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>{t('incidents.severity')}</InputLabel>
            <Select
              value={filters.severity}
              label={t('incidents.severity')}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            >
              <MenuItem value="all">{t('incidents.all_severities')}</MenuItem>
              <MenuItem value="critical">{t('dashboard.critical')}</MenuItem>
              <MenuItem value="high">{t('dashboard.high')}</MenuItem>
              <MenuItem value="medium">{t('dashboard.medium')}</MenuItem>
              <MenuItem value="low">{t('dashboard.low')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>{t('incidents.status')}</InputLabel>
            <Select
              value={filters.status}
              label={t('incidents.status')}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <MenuItem value="all">{t('incidents.all_status')}</MenuItem>
              <MenuItem value="active">{t('reports.active')}</MenuItem>
              <MenuItem value="responded">{t('reports.responded')}</MenuItem>
              <MenuItem value="resolved">{t('reports.resolved')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Incidents table */}
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('incidents.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {displayedIncidents.length} {t('incidents.reports_in_view')}
              </Typography>
            </Box>
            <Button variant="primary" size="sm" onClick={handleOpenCreateDrawer} aria-label={t('incidents.file_new_report')}>
              {t('incidents.file_new_report')}
            </Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead sx={{ bgcolor: alpha(theme.palette.action.active, 0.02) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, py: 2 }}>
                  {t('incidents.incident_id')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {t('incidents.location')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {t('incidents.severity')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {t('incidents.status')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {t('incidents.reported_at')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }} align="right">
                  {t('incidents.actions')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }} align="right">
                  {t('incidents.metric_details')}
                </TableCell>
              </TableRow>
            </TableHead>
            <AnimatePresence mode="wait">
              {loading && incidents.length === 0 ? (
                // Show skeletons while loading initial data
                <TableBody key="skeleton">
                  {[0, 1, 2, 3, 4, 5].map((i) => <TableRowSkeleton key={i} index={i} />)}
                </TableBody>
              ) : displayedIncidents.length === 0 ? (
                <TableBody key="empty">
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                      {t('incidents.empty')}
                    </TableCell>
                  </TableRow>
                </TableBody>
              ) : (
                // Stagger rows on initial data load and filter changes
                <MotionTableBody
                  key={`rows-${loading ? 'l' : incidents.length}`}
                  variants={tableParent}
                  initial="initial"
                  animate="animate"
                >
                  {displayedIncidents.map((incident: Incident) => (
                    <MotionTableRow
                      key={incident.id}
                      variants={tableRow}
                      sx={{
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>
                        #{incident.id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, maxWidth: 260 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={incident.location}
                        >
                          {incident.location}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Badge
                          label={severityLabel[incident.severity] ?? incident.severity.toUpperCase()}
                          variant={severityColor[incident.severity as 'critical' | 'high' | 'medium' | 'low']}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          label={statusLabel[incident.status] ?? (incident.status.charAt(0).toUpperCase() + incident.status.slice(1))}
                          variant={statusColor[incident.status as 'active' | 'responded' | 'resolved']}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        {formatTime(incident.time)}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<EditRoundedIcon sx={{ fontSize: 16 }} />}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenEditDrawer(incident.id)
                            }}
                            loading={drawerLoading && editingIncidentId === incident.id}
                            disabled={drawerLoading && editingIncidentId !== incident.id}
                            aria-label={`${t('common.edit')} incident ${incident.id}`}
                          >
                            {drawerLoading && editingIncidentId === incident.id ? t('incidents.opening') : t('common.edit')}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<PictureAsPdfRoundedIcon sx={{ fontSize: 16 }} />}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleGenerateReport(incident.id)
                            }}
                            loading={generatingReportId === incident.id}
                            disabled={generatingReportId !== null && generatingReportId !== incident.id}
                            aria-label={`Generate PDF for incident ${incident.id}`}
                          >
                            {generatingReportId === incident.id ? t('incidents.generating_report') : t('incidents.generate_report')}
                          </Button>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          {t('incidents.vehicles')} {incident.vehicles} <Box component="span" sx={{ mx: 0.5 }}>|</Box> {t('incidents.injuries')} {incident.injuries}
                        </Typography>
                      </TableCell>
                    </MotionTableRow>
                  ))}
                </MotionTableBody>
              )}
            </AnimatePresence>
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
            const updated = await dispatch(updateIncident({ id: String(editingIncident.id), payload }) as any).unwrap()
            const updatedData = updated?.data ?? updated
            if (updatedData) {
              setEditingIncident(updatedData)
            }
            return updatedData
          }
          const created = await dispatch(createIncident(payload) as any).unwrap()
          const createdData = created?.data ?? created
          return createdData
        }}
      />

    </Stack>
  )
}
