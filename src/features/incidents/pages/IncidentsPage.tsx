import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  alpha,
  useTheme,
  useMediaQuery,
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
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents, fetchIncidentById, createIncident, updateIncident, clearError, softDeleteIncident } from '../slices/incidentsSlice'
import { apiService } from '../../../services/api'
import type { Incident } from '../slices/incidentsSlice'
import Card from '../../../components/Common/Card'
import AddIncidentDrawer from '../components/AddIncidentDrawer'
import Badge from '../../../components/Common/Badge'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'
import IncidentsMap from '../../../components/Common/IncidentsMap'
import { useTranslation, useThemeMode } from '../../../themeMode'

// ── Duplicate detection (shared with AddIncidentDrawer logic) ─────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
const DUP_RADIUS_M = 200
const DUP_TIME_MS = 4 * 60 * 60 * 1000 // 4 hours

export default function IncidentsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { t } = useTranslation()
  const { locale } = useThemeMode()
  const { list: incidents, loading, stats, error: incidentsError, deletingId } = useAppSelector((state) => state.incidents)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingIncident, setEditingIncident] = useState<any | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null)
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null)
  const [reportSnackbar, setReportSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteContext, setDeleteContext] = useState<'duplicate' | 'manual'>('manual')
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteSnackbar, setDeleteSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  const handleGenerateReport = async (id: string) => {
    try {
      setGeneratingReportId(id)
      const response = await apiService.incidents.generateReport(id, { documentType: 'arabic' })
      const result = response.data
      const url = result?.url || (result as any)?.data?.url
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
        setReportSnackbar({ open: true, message: 'PDF report ready — opening now.', severity: 'success' })
      } else {
        setReportSnackbar({ open: true, message: 'Report generated but server returned no download URL.', severity: 'error' })
      }
    } catch (err: any) {
      const status: number | undefined = err?.response?.status
      const serverMsg: string | undefined = err?.response?.data?.message || err?.response?.data?.error
      if (status === 404 || status === 501) {
        setReportSnackbar({ open: true, message: 'PDF generation is not yet available on this server.', severity: 'error' })
      } else if (serverMsg) {
        setReportSnackbar({ open: true, message: serverMsg, severity: 'error' })
      } else {
        setReportSnackbar({ open: true, message: `Failed to generate report (${status ?? 'network error'}).`, severity: 'error' })
      }
    } finally {
      setGeneratingReportId(null)
    }
  }

  const openDeleteDialog = (id: string, context: 'duplicate' | 'manual') => {
    setDeleteContext(context)
    setDeleteReason(context === 'duplicate' ? 'Duplicate accident' : '')
    setDeleteConfirmId(id)
  }

  const handleConfirmSoftDelete = async () => {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    const reason = deleteReason.trim() || undefined
    setDeleteConfirmId(null)
    setDeleteReason('')
    const result = await dispatch(softDeleteIncident({ id, reason }) as any)
    if (softDeleteIncident.fulfilled.match(result)) {
      setDeleteSnackbar({ open: true, message: 'Accident archived successfully.', severity: 'success' })
    } else {
      const errMsg = (result.payload as string) || 'Failed to archive accident.'
      setDeleteSnackbar({ open: true, message: errMsg, severity: 'error' })
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
    // Load a larger window so the advanced filters search across more than one page.
    dispatch(fetchIncidents({ page: 1, limit: 200 }) as any)
  }, [dispatch])

  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'all',
    location: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    minInjuries: '',
    minVehicles: '',
  })
  const [incPage, setIncPage] = useState(0)
  const [incRowsPerPage, setIncRowsPerPage] = useState(15)

  const clearFilters = () => setFilters({
    severity: 'all', status: 'all', location: '', search: '',
    dateFrom: '', dateTo: '', minInjuries: '', minVehicles: '',
  })

  const activeFilterCount = [
    filters.severity !== 'all',
    filters.status !== 'all',
    filters.location.trim() !== '',
    filters.search.trim() !== '',
    filters.dateFrom !== '',
    filters.dateTo !== '',
    filters.minInjuries !== '',
    filters.minVehicles !== '',
  ].filter(Boolean).length

  const displayedIncidents = (incidents || []).filter((incident: Incident) => {
    const matchesSeverity = filters.severity === 'all' || incident.severity === filters.severity
    const matchesStatus = filters.status === 'all' || incident.status === filters.status

    const loc = filters.location.trim().toLowerCase()
    const matchesLocation = !loc ||
      incident.location.toLowerCase().includes(loc) ||
      (incident.governorate?.toLowerCase().includes(loc) ?? false)

    const q = filters.search.trim().toLowerCase()
    const matchesSearch = !q ||
      incident.id.toLowerCase().includes(q) ||
      incident.location.toLowerCase().includes(q) ||
      (incident.description?.toLowerCase().includes(q) ?? false)

    // Date range — uses the incident timestamp (records without a date are excluded once a range is set)
    const ts = incident.timestamp ? new Date(incident.timestamp).getTime() : null
    const matchesDateFrom = !filters.dateFrom || (ts !== null && ts >= new Date(`${filters.dateFrom}T00:00:00`).getTime())
    const matchesDateTo   = !filters.dateTo   || (ts !== null && ts <= new Date(`${filters.dateTo}T23:59:59`).getTime())

    const matchesMinInjuries = !filters.minInjuries || incident.injuries >= Number(filters.minInjuries)
    const matchesMinVehicles = !filters.minVehicles || incident.vehicles >= Number(filters.minVehicles)

    return matchesSeverity && matchesStatus && matchesLocation && matchesSearch &&
      matchesDateFrom && matchesDateTo && matchesMinInjuries && matchesMinVehicles
  })

  // Reset to page 0 whenever filters change
  useEffect(() => { setIncPage(0) }, [filters])

  const paginatedIncidents = displayedIncidents.slice(
    incPage * incRowsPerPage,
    incPage * incRowsPerPage + incRowsPerPage
  )

  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false)
  const [dupPage, setDupPage] = useState(0)
  const DUP_PAGE_SIZE = 5

  // Detect potential duplicates already in the DB — catches offline-synced mobile accidents
  const duplicatePairs = useMemo(() => {
    const pairs: Array<{ a: Incident; b: Incident; distanceM: number; timeDiffMs: number }> = []
    const seen = new Set<string>()
    for (let i = 0; i < incidents.length; i++) {
      for (let j = i + 1; j < incidents.length; j++) {
        const a = incidents[i], b = incidents[j]
        if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) continue
        if (!Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) continue
        const d = haversineDistance(a.latitude!, a.longitude!, b.latitude!, b.longitude!)
        if (d >= DUP_RADIUS_M) continue
        if (!a.timestamp || !b.timestamp) continue
        const timeDiff = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        if (timeDiff >= DUP_TIME_MS) continue
        const key = [a.id, b.id].sort().join('|')
        if (!seen.has(key)) {
          seen.add(key)
          pairs.push({ a, b, distanceM: d, timeDiffMs: timeDiff })
        }
      }
    }
    return pairs
  }, [incidents])

  const duplicateIncidentIds = useMemo(
    () => new Set(duplicatePairs.flatMap((p) => [p.a.id, p.b.id])),
    [duplicatePairs],
  )

  const criticalDupCount = useMemo(
    () => duplicatePairs.filter((p) => p.a.severity === 'critical' || p.b.severity === 'critical').length,
    [duplicatePairs],
  )

  const dupSeverityChipColor = (sev: string): 'error' | 'warning' | 'info' | 'success' =>
    sev === 'critical' ? 'error' : sev === 'high' ? 'warning' : sev === 'medium' ? 'info' : 'success'

  const pairRiskLevel = (distanceM: number, timeDiffMs: number): { label: string; color: 'error' | 'warning' } => {
    if (distanceM < 5 && timeDiffMs < 5 * 60_000) return { label: 'Exact duplicate', color: 'error' }
    if (distanceM < 50 && timeDiffMs < 30 * 60_000) return { label: 'Very likely duplicate', color: 'error' }
    return { label: 'Possible duplicate', color: 'warning' }
  }

  const [dismissedPairKeys, setDismissedPairKeys] = useState<Set<string>>(new Set())
  const dismissPair = (a: string, b: string) =>
    setDismissedPairKeys((prev) => new Set([...prev, [a, b].sort().join('|')]))

  const visiblePairs = useMemo(
    () => duplicatePairs.filter((p) => !dismissedPairKeys.has([p.a.id, p.b.id].sort().join('|'))),
    [duplicatePairs, dismissedPairKeys],
  )

  useEffect(() => { setDupPage(0) }, [visiblePairs.length])

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

      {/* ── Duplicate accident panel ──────────────────────────────────────────── */}
      {visiblePairs.length > 0 && (
        <Box
          sx={{
            borderRadius: 3, overflow: 'hidden',
            border: `1.5px solid ${alpha(theme.palette.warning.main, 0.3)}`,
            bgcolor: 'background.paper',
            boxShadow: `0 2px 16px ${alpha(theme.palette.warning.main, 0.08)}`,
          }}
        >
          {/* ─ Header ─ */}
          <Box
            sx={{
              px: 2.5, py: 1.75,
              bgcolor: alpha(theme.palette.warning.main, 0.055),
              borderBottom: showDuplicateDetails ? `1px solid ${alpha(theme.palette.warning.main, 0.18)}` : 'none',
              display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setShowDuplicateDetails((p) => !p)}
          >
            <Box
              sx={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                bgcolor: alpha(theme.palette.warning.main, 0.15),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <WarningRoundedIcon sx={{ fontSize: 19, color: 'warning.main' }} />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="subtitle2" fontWeight={800} color="warning.dark">
                  {visiblePairs.length} potential duplicate{visiblePairs.length > 1 ? 's' : ''} detected
                </Typography>
                {criticalDupCount > 0 && (
                  <Chip
                    label={`${criticalDupCount} critical`}
                    size="small"
                    color="error"
                    sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                  />
                )}
                {dismissedPairKeys.size > 0 && (
                  <Typography variant="caption" color="text.disabled">
                    ({dismissedPairKeys.size} dismissed)
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Pairs within 200 m &amp; 4 h — likely offline mobile sync. Open each to review and delete the duplicate.
              </Typography>
            </Box>

            <Chip
              label={showDuplicateDetails ? 'Hide' : `Review ${visiblePairs.length}`}
              size="small"
              color="warning"
              variant={showDuplicateDetails ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); setShowDuplicateDetails((p) => !p) }}
            />
          </Box>

          {/* ─ Pairs list ─ */}
          <Collapse in={showDuplicateDetails}>
            <Stack divider={<Divider sx={{ borderColor: alpha(theme.palette.warning.main, 0.12) }} />}>
              {visiblePairs
                .slice(dupPage * DUP_PAGE_SIZE, (dupPage + 1) * DUP_PAGE_SIZE)
                .map((pair, idx) => {
                  const risk = pairRiskLevel(pair.distanceM, pair.timeDiffMs)
                  const globalIdx = dupPage * DUP_PAGE_SIZE + idx + 1
                  return (
                    <Box key={`${pair.a.id}-${pair.b.id}`} sx={{ px: 2.5, pt: 1.75, pb: 1.5 }}>
                      {/* ── Risk badge row ── */}
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                        <Chip
                          size="small"
                          label={risk.label}
                          color={risk.color}
                          sx={{ height: 20, fontSize: 10, fontWeight: 800, letterSpacing: 0.2 }}
                        />
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <MyLocationRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.disabled" fontWeight={700}>
                            {Math.round(pair.distanceM)} m apart
                          </Typography>
                        </Stack>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }} />
                        <Typography variant="caption" color="text.disabled">
                          {Math.round(pair.timeDiffMs / 60_000)} min apart
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5 }}>
                          {globalIdx} / {visiblePairs.length}
                        </Typography>
                        <Tooltip title="Dismiss this pair (does not delete)">
                          <IconButton
                            size="small"
                            onClick={() => dismissPair(pair.a.id, pair.b.id)}
                            sx={{ width: 22, height: 22, color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
                          >
                            <CloseRoundedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      {/* ── Two incidents stacked ── */}
                      <Stack spacing={0.75}>
                        {[pair.a, pair.b].map((inc, side) => {
                          const incColor = inc.severity === 'critical' ? theme.palette.error.main : theme.palette.warning.main
                          return (
                            <Box
                              key={inc.id}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                px: 1.5, py: 1.25, borderRadius: 2,
                                bgcolor: alpha(incColor, 0.04),
                                border: `1px solid ${alpha(incColor, 0.2)}`,
                                minWidth: 0,
                              }}
                            >
                              {/* Side label */}
                              <Typography
                                variant="caption"
                                fontWeight={900}
                                sx={{
                                  width: 16, flexShrink: 0, textAlign: 'center',
                                  color: alpha(incColor, 0.7), fontSize: 11,
                                }}
                              >
                                {side === 0 ? 'A' : 'B'}
                              </Typography>

                              {/* Severity chip */}
                              <Chip
                                size="small"
                                label={inc.severity}
                                color={dupSeverityChipColor(inc.severity)}
                                sx={{ height: 18, fontSize: 10, fontWeight: 700, textTransform: 'capitalize', flexShrink: 0 }}
                              />

                              {/* Location + time */}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                  noWrap
                                  title={inc.location}
                                  sx={{ lineHeight: 1.3 }}
                                >
                                  {inc.location}
                                </Typography>
                                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                                  #{inc.id.slice(0, 8)}… · {formatTime(inc.time)}
                                </Typography>
                              </Box>

                              {/* Open button */}
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<EditRoundedIcon sx={{ fontSize: 13 }} />}
                                onClick={() => handleOpenEditDrawer(inc.id)}
                                loading={drawerLoading && editingIncidentId === inc.id}
                                disabled={(drawerLoading && editingIncidentId !== inc.id) || deletingId !== null}
                              >
                                Open
                              </Button>

                              {/* Archive (soft-delete) button — auto-fills "Duplicate accident" as reason */}
                              <Tooltip title="Archive as duplicate — soft delete, recoverable by admin">
                                <span>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    icon={<ArchiveRoundedIcon sx={{ fontSize: 13 }} />}
                                    onClick={() => openDeleteDialog(inc.id, 'duplicate')}
                                    loading={deletingId === inc.id}
                                    disabled={deletingId !== null && deletingId !== inc.id}
                                  >
                                    Archive
                                  </Button>
                                </span>
                              </Tooltip>
                            </Box>
                          )
                        })}
                      </Stack>
                    </Box>
                  )
                })}
            </Stack>

            {/* ─ Pagination ─ */}
            {visiblePairs.length > DUP_PAGE_SIZE && (
              <Box
                sx={{
                  px: 2.5, py: 1.25,
                  borderTop: `1px solid ${alpha(theme.palette.warning.main, 0.12)}`,
                  bgcolor: alpha(theme.palette.warning.main, 0.025),
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {dupPage * DUP_PAGE_SIZE + 1}–{Math.min((dupPage + 1) * DUP_PAGE_SIZE, visiblePairs.length)} of {visiblePairs.length} pairs
                </Typography>
                <Stack direction="row" spacing={0.75}>
                  <Chip
                    label="← Prev"
                    size="small"
                    color="warning"
                    variant="outlined"
                    disabled={dupPage === 0}
                    onClick={() => setDupPage((p) => Math.max(0, p - 1))}
                    sx={{ fontWeight: 700, cursor: dupPage === 0 ? 'default' : 'pointer' }}
                  />
                  <Chip
                    label="Next →"
                    size="small"
                    color="warning"
                    variant="outlined"
                    disabled={(dupPage + 1) * DUP_PAGE_SIZE >= visiblePairs.length}
                    onClick={() => setDupPage((p) => p + 1)}
                    sx={{ fontWeight: 700, cursor: (dupPage + 1) * DUP_PAGE_SIZE >= visiblePairs.length ? 'default' : 'pointer' }}
                  />
                </Stack>
              </Box>
            )}
          </Collapse>
        </Box>
      )}

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('incidents.map_title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('incidents.map_subtitle')}</Typography>
        </Box>
        <IncidentsMap incidents={displayedIncidents} height="clamp(480px, 60vh, 640px)" />
      </Card>

      {/* Advanced multi-field search */}
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Advanced search</Typography>
            {activeFilterCount > 0 && (
              <Chip size="small" color="primary" label={`${activeFilterCount} active`} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
            )}
          </Stack>
          {activeFilterCount > 0 && (
            <Button variant="secondary" size="sm" onClick={clearFilters}>Clear all</Button>
          )}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, alignItems: 'end' }}>
          <TextField
            label={t('incidents.search_incidents')}
            variant="outlined"
            size="small"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder="ID, location, description"
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
          <TextField
            label="Date from"
            type="date"
            variant="outlined"
            size="small"
            value={filters.dateFrom}
            onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: filters.dateTo || undefined }}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label="Date to"
            type="date"
            variant="outlined"
            size="small"
            value={filters.dateTo}
            onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: filters.dateFrom || undefined }}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label="Min injuries"
            type="number"
            variant="outlined"
            size="small"
            value={filters.minInjuries}
            onChange={(e) => setFilters(prev => ({ ...prev, minInjuries: e.target.value }))}
            inputProps={{ min: 0 }}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label="Min vehicles"
            type="number"
            variant="outlined"
            size="small"
            value={filters.minVehicles}
            onChange={(e) => setFilters(prev => ({ ...prev, minVehicles: e.target.value }))}
            inputProps={{ min: 0 }}
            sx={{ bgcolor: 'background.paper' }}
          />
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
        {isMobile ? (
          /* ── Mobile / tablet: card layout (no horizontal scroll) ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
            {loading && incidents.length === 0 ? (
              [0, 1, 2, 3].map((i) => (
                <Box key={i} sx={{ height: 150, borderRadius: 2, bgcolor: alpha(theme.palette.action.active, 0.05) }} />
              ))
            ) : displayedIncidents.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>{t('incidents.empty')}</Box>
            ) : (
              paginatedIncidents.map((incident: Incident) => {
                const isDuplicate = duplicateIncidentIds.has(incident.id)
                return (
                  <Box
                    key={incident.id}
                    sx={{
                      borderRadius: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      p: 1.75,
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      ...(isDuplicate && {
                        borderColor: alpha(theme.palette.warning.main, 0.5),
                        bgcolor: alpha(theme.palette.warning.main, 0.03),
                      }),
                    }}
                  >
                    {/* ID + severity/status badges */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, color: 'primary.main', fontSize: 14 }}>#{incident.id}</Typography>
                        {isDuplicate && (
                          <Tooltip title="Possible duplicate — see review panel above" placement="top" arrow>
                            <Chip
                              label="dup"
                              size="small"
                              color="warning"
                              variant="outlined"
                              icon={<WarningRoundedIcon style={{ fontSize: 10 }} />}
                              sx={{ fontSize: 10, height: 18, fontWeight: 700, pl: 0.25, cursor: 'help' }}
                            />
                          </Tooltip>
                        )}
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                        <Badge
                          label={severityLabel[incident.severity] ?? incident.severity.toUpperCase()}
                          variant={severityColor[incident.severity as 'critical' | 'high' | 'medium' | 'low']}
                          size="sm"
                        />
                        <Badge
                          label={statusLabel[incident.status] ?? (incident.status.charAt(0).toUpperCase() + incident.status.slice(1))}
                          variant={statusColor[incident.status as 'active' | 'responded' | 'resolved']}
                          size="sm"
                        />
                      </Stack>
                    </Stack>

                    {/* Location */}
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.35 }} title={incident.location}>
                      {incident.location}
                    </Typography>

                    {/* Time + metrics */}
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5, rowGap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>{formatTime(incident.time)}</Typography>
                      <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {t('incidents.vehicles')} {incident.vehicles} · {t('incidents.injuries')} {incident.injuries}
                      </Typography>
                    </Stack>

                    {/* Actions */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<EditRoundedIcon sx={{ fontSize: 16 }} />}
                        onClick={(event) => { event.stopPropagation(); handleOpenEditDrawer(incident.id) }}
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
                        onClick={(event) => { event.stopPropagation(); handleGenerateReport(incident.id) }}
                        loading={generatingReportId === incident.id}
                        disabled={generatingReportId !== null && generatingReportId !== incident.id}
                        aria-label={`Generate PDF for incident ${incident.id}`}
                      >
                        {generatingReportId === incident.id ? t('incidents.generating_report') : t('incidents.generate_report')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<ArchiveRoundedIcon sx={{ fontSize: 16 }} />}
                        onClick={(event) => { event.stopPropagation(); openDeleteDialog(incident.id, 'manual') }}
                        loading={deletingId === incident.id}
                        disabled={deletingId !== null && deletingId !== incident.id}
                        aria-label={`Archive incident ${incident.id}`}
                      >
                        {deletingId === incident.id ? 'Archiving…' : 'Archive'}
                      </Button>
                    </Stack>
                  </Box>
                )
              })
            )}
          </Box>
        ) : (
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
                  {t('incidents.metric_details')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }} align="right">
                  {t('incidents.actions')}
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
                  key={`rows-${loading ? 'l' : incidents.length}-p${incPage}`}
                  variants={tableParent}
                  initial="initial"
                  animate="animate"
                >
                  {paginatedIncidents.map((incident: Incident) => {
                    const isDuplicate = duplicateIncidentIds.has(incident.id)
                    return (
                    <MotionTableRow
                      key={incident.id}
                      variants={tableRow}
                      sx={{
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        transition: 'background-color 0.15s ease',
                        ...(isDuplicate && {
                          borderLeft: `3px solid ${theme.palette.warning.main}`,
                          bgcolor: alpha(theme.palette.warning.main, 0.03),
                        }),
                      }}
                    >
                      <TableCell sx={{ fontWeight: 800, color: 'primary.main', py: 2.5 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Tooltip title={incident.id} placement="top" arrow>
                            <Box component="span" sx={{ fontFamily: 'monospace', cursor: 'help' }}>#{incident.id.slice(0, 8)}…</Box>
                          </Tooltip>
                          {isDuplicate && (
                            <Tooltip title="Possible duplicate — see review panel above" placement="top" arrow>
                              <Chip
                                label="dup"
                                size="small"
                                color="warning"
                                variant="outlined"
                                icon={<WarningRoundedIcon style={{ fontSize: 10 }} />}
                                sx={{ fontSize: 10, height: 18, fontWeight: 700, pl: 0.25, cursor: 'help' }}
                              />
                            </Tooltip>
                          )}
                        </Stack>
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
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {t('incidents.vehicles')} {incident.vehicles} <Box component="span" sx={{ mx: 0.5 }}>|</Box> {t('incidents.injuries')} {incident.injuries}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={t('common.edit')} arrow>
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(event) => { event.stopPropagation(); handleOpenEditDrawer(incident.id) }}
                                disabled={drawerLoading && editingIncidentId !== incident.id}
                                aria-label={`${t('common.edit')} incident ${incident.id}`}
                                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                              >
                                {drawerLoading && editingIncidentId === incident.id
                                  ? <CircularProgress size={16} color="inherit" />
                                  : <EditRoundedIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t('incidents.generate_report')} arrow>
                            <span>
                              <IconButton
                                size="small"
                                onClick={(event) => { event.stopPropagation(); handleGenerateReport(incident.id) }}
                                disabled={generatingReportId !== null && generatingReportId !== incident.id}
                                aria-label={`Generate PDF for incident ${incident.id}`}
                                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                              >
                                {generatingReportId === incident.id
                                  ? <CircularProgress size={16} color="inherit" />
                                  : <PictureAsPdfRoundedIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Archive" arrow>
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(event) => { event.stopPropagation(); openDeleteDialog(incident.id, 'manual') }}
                                disabled={deletingId !== null && deletingId !== incident.id}
                                aria-label={`Archive incident ${incident.id}`}
                                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                              >
                                {deletingId === incident.id
                                  ? <CircularProgress size={16} color="inherit" />
                                  : <ArchiveRoundedIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </MotionTableRow>
                  )})}
                </MotionTableBody>
              )}
            </AnimatePresence>
          </Table>
        </Box>
        )}
        <TablePagination
          component="div"
          count={displayedIncidents.length}
          page={incPage}
          onPageChange={(_, newPage) => setIncPage(newPage)}
          rowsPerPage={incRowsPerPage}
          onRowsPerPageChange={(e) => { setIncRowsPerPage(parseInt(e.target.value, 10)); setIncPage(0) }}
          rowsPerPageOptions={[10, 15, 25, 50]}
          sx={{ borderTop: `1px solid`, borderColor: 'divider' }}
        />
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

      <Snackbar
        open={reportSnackbar.open}
        autoHideDuration={5000}
        onClose={() => setReportSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={reportSnackbar.severity}
          onClose={() => setReportSnackbar((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 3 }}
        >
          {reportSnackbar.message}
        </Alert>
      </Snackbar>

      {/* ── Soft-delete confirmation dialog ─────────────────────────────────── */}
      {(() => {
        const inc = deleteConfirmId ? incidents.find((i: Incident) => i.id === deleteConfirmId) : null
        const isDuplicate = deleteContext === 'duplicate'
        return (
          <Dialog
            open={Boolean(deleteConfirmId)}
            onClose={() => { setDeleteConfirmId(null); setDeleteReason('') }}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>
              {isDuplicate ? 'Archive duplicate accident?' : 'Archive this accident?'}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {/* Incident preview */}
                {inc && (
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: alpha(isDuplicate ? theme.palette.warning.main : theme.palette.error.main, 0.06),
                    border: `1px solid ${alpha(isDuplicate ? theme.palette.warning.main : theme.palette.error.main, 0.2)}`,
                  }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={inc.severity}
                        color={inc.severity === 'critical' ? 'error' : inc.severity === 'high' ? 'warning' : 'default'}
                        sx={{ fontWeight: 700, fontSize: 11 }}
                      />
                      <Typography variant="body2" fontWeight={700} noWrap flex={1}>{inc.location}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      #{inc.id.slice(0, 8)}… · {inc.time}
                    </Typography>
                  </Box>
                )}

                <Typography variant="body2" color="text.secondary">
                  {isDuplicate
                    ? 'This accident was flagged as a potential duplicate. It will be soft-deleted — an admin can restore it from Archived Accidents if needed.'
                    : 'The accident will be soft-deleted and moved to the archive. An admin can restore it later from the Archived Accidents page.'}
                </Typography>

                {/* Reason field */}
                <Box>
                  <TextField
                    label="Reason for archiving"
                    placeholder={isDuplicate ? '' : 'Enter a reason (optional)…'}
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    helperText={isDuplicate
                      ? 'Auto-filled because this was flagged as a duplicate — you can edit it.'
                      : 'Optional — helps admins understand why this record was archived.'}
                    sx={{ '& .MuiFormHelperText-root': { fontSize: 11 } }}
                  />
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setDeleteConfirmId(null); setDeleteReason('') }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<ArchiveRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={handleConfirmSoftDelete}
              >
                Archive
              </Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* ── Delete feedback snackbar ─────────────────────────────────────────── */}
      <Snackbar
        open={deleteSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setDeleteSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={deleteSnackbar.severity}
          onClose={() => setDeleteSnackbar((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 3 }}
        >
          {deleteSnackbar.message}
        </Alert>
      </Snackbar>

    </Stack>
  )
}
