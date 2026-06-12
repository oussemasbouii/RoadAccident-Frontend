import { useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  Box, Button as MuiButton, Card, Chip, Divider, FormControl,
  InputLabel, List, ListItem, MenuItem, Paper,
  Select, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup,
  Typography, alpha, useTheme,
} from '@mui/material'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import MapRoundedIcon from '@mui/icons-material/MapRounded'
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded'
import NightlightRoundedIcon from '@mui/icons-material/NightlightRounded'
import Brightness5RoundedIcon from '@mui/icons-material/Brightness5Rounded'
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded'

import { AnimatePresence, motion } from 'framer-motion'
import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents } from '../../incidents/slices/incidentsSlice'
import type { Incident } from '../../incidents/slices/incidentsSlice'
import { fetchAlerts } from '../../alerts/slices/alertsSlice'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'
import { useTranslation, useThemeMode } from '../../../themeMode'
import IncidentHeatmapPanel from '../../dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel'
import CauseRanking from '../../dashboard/components/EnhancedKpiDashboard/CauseRanking'
import { listParent } from '../../../utils/motion'
import TrendChart from '../components/TrendChart'

const MotionBox = motion(Box)

// ── Constants ──────────────────────────────────────────────────────────────────
const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
const dayRangeMap: Record<string, number>  = { day: 1, week: 7, month: 30, year: 365 }
const RANK_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32']

interface Hotspot   { location: string; count: number }
interface SeverityRow { label: string; count: number; color: string }

function pct(v: number, t: number) { return t ? Math.round((v / t) * 100) : 0 }
function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// ── Shared sub-components ──────────────────────────────────────────────────────
function SectionHeader({
  icon, title, subtitle, accent, mb = 2.25,
}: { icon: React.ReactNode; title: string; subtitle?: string; accent: string; mb?: number }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb }}>
      <Box sx={{ p: 0.875, borderRadius: 2, bgcolor: alpha(accent, 0.12), color: accent, display: 'flex' }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </Box>
    </Stack>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const dispatch   = useAppDispatch()
  const theme      = useTheme()
  const { t }      = useTranslation()
  const { locale } = useThemeMode()
  const rowDir     = theme.direction === 'rtl' ? 'row-reverse' : 'row'

  const severityLabel: Record<string, string> = {
    critical: t('dashboard.critical'), high: t('dashboard.high'),
    medium: t('dashboard.medium'),     low: t('dashboard.low'),
  }
  const statusLabel: Record<string, string> = {
    active: t('reports.active'), responded: t('reports.responded'), resolved: t('reports.resolved'),
  }

  const [filters, setFilters] = useState({
    dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
    wilaya: 'all' as string,
    period: 'month' as 'day' | 'week' | 'month',
    viewMode: 'pins' as 'pins' | 'heatmap',
  })
  const [activeTab, setActiveTab] = useState(0)

  const { list: incidents, loading: incidentsLoading, error: incidentsError } = useAppSelector((s) => s.incidents)
  const { list: alerts, unreadCount, loading: alertsLoading, error: alertsError } = useAppSelector((s) => s.alerts)

  useEffect(() => {
    dispatch(fetchIncidents({ page: 1, limit: 50 }) as any)
    dispatch(fetchAlerts({ page: 1, limit: 50 }) as any)
  }, [dispatch])

  const availableWilayas = useMemo(() => {
    const s = new Set<string>()
    for (const inc of incidents) {
      if (inc.governorate) s.add(inc.governorate)
    }
    return Array.from(s).sort()
  }, [incidents])

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc: any) => {
      const d = parseDate(inc.timestamp || inc.time)
      if (d) {
        if (filters.dateFrom) {
          const from = new Date(filters.dateFrom)
          if (d < from) return false
        }
        if (filters.dateTo) {
          const to = new Date(filters.dateTo)
          to.setHours(23, 59, 59, 999)
          if (d > to) return false
        }
      }
      if (filters.wilaya !== 'all') {
        if ((inc.governorate || '') !== filters.wilaya) return false
      }
      return true
    })
  }, [incidents, filters])

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a: any) => {
      const d = parseDate((a as any).timestamp || a.time)
      if (d) {
        if (filters.dateFrom && d < new Date(filters.dateFrom)) return false
        if (filters.dateTo) {
          const to = new Date(filters.dateTo); to.setHours(23, 59, 59, 999)
          if (d > to) return false
        }
      }
      return true
    })
  }, [alerts, filters])

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const totalIncidents    = filteredIncidents.length
  const openIncidents     = filteredIncidents.filter((i: any) => i.status !== 'resolved')
  const resolvedIncidents = filteredIncidents.filter((i: any) => i.status === 'resolved')
  const criticalOpen      = openIncidents.filter((i: any) => i.severity === 'critical').length
  const resolutionRate    = totalIncidents > 0 ? Math.round((resolvedIncidents.length / totalIncidents) * 100) : 0
  const totalInjuries     = filteredIncidents.reduce((s: number, i: any) => s + Number(i.injuries || 0), 0)
  const avgInjuries       = totalIncidents > 0 ? (totalInjuries / totalIncidents).toFixed(1) : '0.0'

  const severityCounts = filteredIncidents.reduce((acc: Record<string, number>, i: any) => {
    const k = String(i.severity || 'low').toLowerCase(); acc[k] = (acc[k] || 0) + 1; return acc
  }, {})
  const alertSeverityCounts = filteredAlerts.reduce((acc: Record<string, number>, a: any) => {
    const k = String(a.severity || 'medium').toLowerCase(); acc[k] = (acc[k] || 0) + 1; return acc
  }, {})
  const alertTypeCounts = filteredAlerts.reduce((acc: Record<string, number>, a: any) => {
    const k = String(a.type || 'system').toLowerCase(); acc[k] = (acc[k] || 0) + 1; return acc
  }, {})

  const hotspotMap = filteredIncidents.reduce((acc: Record<string, Hotspot>, i: any) => {
    const loc = String(i.location || t('reports.no_location_data')).trim()
    const key = loc.toLowerCase()
    if (!acc[key]) acc[key] = { location: loc, count: 0 }
    acc[key].count += 1
    return acc
  }, {})
  const hotspots       = (Object.values(hotspotMap) as Hotspot[]).sort((a, b) => b.count - a.count)
  const dominantHotspot = hotspots[0]

  const highPriorityAlerts = (alertSeverityCounts.critical || 0) + (alertSeverityCounts.high || 0)
  const alertPressure = filteredAlerts.length > 0 ? Math.round((highPriorityAlerts / filteredAlerts.length) * 100) : 0

  const priorityIncidents = openIncidents
    .filter((i: any) => severityRank[i.severity] >= severityRank.high)
    .sort((a: any, b: any) => {
      const d = severityRank[b.severity] - severityRank[a.severity]
      return d !== 0 ? d : Number(b.injuries || 0) - Number(a.injuries || 0)
    })
    .slice(0, 8)

  const shiftBreakdown = [
    { label: t('reports.night_shift'),     icon: <NightlightRoundedIcon sx={{ fontSize: 14 }} />,   start: 0,  end: 5,  count: 0 },
    { label: t('reports.morning_shift'),   icon: <WbSunnyRoundedIcon sx={{ fontSize: 14 }} />,      start: 6,  end: 11, count: 0 },
    { label: t('reports.afternoon_shift'), icon: <Brightness5RoundedIcon sx={{ fontSize: 14 }} />,  start: 12, end: 17, count: 0 },
    { label: t('reports.evening_shift'),   icon: <Brightness4RoundedIcon sx={{ fontSize: 14 }} />,  start: 18, end: 23, count: 0 },
  ]
  filteredIncidents.forEach((i: any) => {
    const d = parseDate(i.timestamp || i.time); if (!d) return
    const h = d.getHours()
    const b = shiftBreakdown.find((s) => h >= s.start && h <= s.end)
    if (b) b.count += 1
  })
  const maxShiftCount = Math.max(...shiftBreakdown.map((s) => s.count), 1)
  const peakShift     = shiftBreakdown.reduce((b, c) => (c.count > b.count ? c : b), shiftBreakdown[0])

  const hotspotRows = hotspots.slice(0, 6).map((spot) => {
    const norm         = spot.location.toLowerCase()
    const relatedAlerts = filteredAlerts.filter((a: any) =>
      `${a.title} ${a.description}`.toLowerCase().includes(norm)
    ).length
    return { ...spot, relatedAlerts, share: pct(spot.count, totalIncidents) }
  })

  const incidentSeverityRows: SeverityRow[] = [
    { label: t('dashboard.critical'), count: severityCounts.critical || 0, color: theme.palette.error.main },
    { label: t('dashboard.high'),     count: severityCounts.high     || 0, color: theme.palette.warning.main },
    { label: t('dashboard.medium'),   count: severityCounts.medium   || 0, color: theme.palette.info.main },
    { label: t('dashboard.low'),      count: severityCounts.low      || 0, color: theme.palette.success.main },
  ]
  const alertSeverityRows: SeverityRow[] = [
    { label: t('dashboard.critical'), count: alertSeverityCounts.critical || 0, color: theme.palette.error.main },
    { label: t('dashboard.high'),     count: alertSeverityCounts.high     || 0, color: theme.palette.warning.main },
    { label: t('dashboard.medium'),   count: alertSeverityCounts.medium   || 0, color: theme.palette.info.main },
    { label: t('dashboard.low'),      count: alertSeverityCounts.low      || 0, color: theme.palette.success.main },
  ]
  const statusCounts = {
    active:    filteredIncidents.filter((i: any) => i.status === 'active').length,
    responded: filteredIncidents.filter((i: any) => i.status === 'responded').length,
    resolved:  filteredIncidents.filter((i: any) => i.status === 'resolved').length,
  }

  const incidentDonut = useMemo(() => {
    const total = incidentSeverityRows.reduce((s, r) => s + r.count, 0)
    if (total === 0) return `conic-gradient(${alpha(theme.palette.divider, 0.4)} 0% 100%)`
    let cur = 0
    return `conic-gradient(${incidentSeverityRows.map((r) => {
      const start = cur; cur += (r.count / total) * 100
      return `${r.color} ${start}% ${cur}%`
    }).join(', ')})`
  }, [incidentSeverityRows, theme.palette.divider])

  const dailyTimeline = useMemo(() => {
    const days = filters.period === 'day' ? 1 : 7
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (days - 1 - i))
      const dayKey = date.toISOString().slice(0, 10)
      return {
        day: date.toLocaleDateString(locale, { weekday: 'short' }),
        incidents: filteredIncidents.filter((x: any) => parseDate(x.timestamp || x.time)?.toISOString().slice(0, 10) === dayKey).length,
        alerts:    filteredAlerts.filter((x: any) => parseDate((x as any).timestamp || x.time)?.toISOString().slice(0, 10) === dayKey).length,
      }
    })
  }, [filteredAlerts, filteredIncidents, filters.period, locale])

  const trendPeriod = filters.period

  const reportExportData = [{
    generatedAt: new Date().toISOString(), timeRange: filters.period,
    summary: { totalIncidents, resolutionRate, openIncidents: openIncidents.length, criticalOpen, unreadAlerts: unreadCount, alertPressure },
    incidentsBySeverity: severityCounts, alertsBySeverity: alertSeverityCounts,
    incidentsByStatus: statusCounts, alertsByType: alertTypeCounts,
    sevenDayActivity: dailyTimeline, hotspots: hotspotRows,
    priorityIncidents: priorityIncidents.map((i: any) => ({
      id: i.id, location: i.location, severity: i.severity, injuries: i.injuries, status: i.status, time: i.time,
    })),
  }]

  const loading    = incidentsLoading || alertsLoading
  const fetchError = incidentsError || alertsError

  const TAB_DEFS = [
    { label: 'Overview',    icon: <InsightsRoundedIcon fontSize="small" /> },
    { label: 'Operations',  icon: <ReportProblemRoundedIcon fontSize="small" /> },
    { label: 'Geographic',  icon: <MapRoundedIcon fontSize="small" /> },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={0} sx={{ pb: 5, maxWidth: 1600, mx: 'auto' }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          gap: 2, flexWrap: 'wrap', mb: 2.5,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.4 }}>
            {t('reports.title')}
          </Typography>
          <Typography color="text.secondary">{t('reports.subtitle')}</Typography>
        </Box>
        <ExportButton
          data={reportExportData}
          filename={`officer-briefing-${filters.period}`}
          label={t('common.view_all')}
          title={t('reports.officer_briefing')}
          variant="report"
        />
      </Box>

      {/* ── Error banner ──────────────────────────────────────────── */}
      {fetchError && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2.5, borderColor: alpha(theme.palette.error.main, 0.3), bgcolor: alpha(theme.palette.error.main, 0.05) }}>
          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
            {t('reports.unable_to_load_complete_report_data')}: {fetchError}
          </Typography>
        </Paper>
      )}

      {/* ── Global filter bar ─────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 2, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.6) }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 1.5,
            alignItems: 'end',
          }}
        >
          <TextField
            label="From"
            type="date"
            size="small"
            value={filters.dateFrom}
            onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={filters.dateTo}
            onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl size="small">
            <InputLabel>Wilaya</InputLabel>
            <Select
              value={filters.wilaya}
              label="Wilaya"
              onChange={(e) => setFilters((p) => ({ ...p, wilaya: e.target.value }))}
            >
              <MenuItem value="all">All Wilayas</MenuItem>
              {availableWilayas.map((w) => (
                <MenuItem key={w} value={w}>{w}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Period
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filters.period}
              onChange={(_, v) => v && setFilters((p) => ({ ...p, period: v }))}
            >
              <ToggleButton value="day" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Day</ToggleButton>
              <ToggleButton value="week" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Week</ToggleButton>
              <ToggleButton value="month" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Month</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-end">
            {activeTab === 2 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                  View
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={filters.viewMode}
                  onChange={(_, v) => v && setFilters((p) => ({ ...p, viewMode: v }))}
                >
                  <ToggleButton value="pins" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Pins</ToggleButton>
                  <ToggleButton value="heatmap" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Heatmap</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
            <MuiButton
              size="small"
              variant="outlined"
              onClick={() => setFilters({
                dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                dateTo: format(new Date(), 'yyyy-MM-dd'),
                wilaya: 'all',
                period: 'month',
                viewMode: 'pins',
              })}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Reset
            </MuiButton>
          </Stack>
        </Box>
      </Paper>

      {/* ── Tab bar ───────────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          mb: 2.5, p: 0.5, borderRadius: 3,
          borderColor: alpha(theme.palette.divider, 0.6),
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          display: 'inline-flex', alignSelf: 'flex-start',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          TabIndicatorProps={{ style: { display: 'none' } }}
          sx={{
            minHeight: 38,
            '& .MuiTab-root': {
              minHeight: 36, borderRadius: 2.5,
              fontWeight: 600, fontSize: '0.8125rem',
              textTransform: 'none',
              color: 'text.secondary',
              px: 2, py: 0.75,
              gap: 0.75,
              transition: 'all 0.18s ease',
              '&.Mui-selected': {
                color: '#fff',
                bgcolor: theme.palette.primary.main,
                fontWeight: 700,
                boxShadow: `0 2px 10px ${alpha(theme.palette.primary.main, 0.35)}`,
              },
            },
          }}
        >
          {TAB_DEFS.map((tab, idx) => (
            <Tab key={idx} label={tab.label} icon={tab.icon} iconPosition="start" />
          ))}
        </Tabs>
      </Paper>

      {/* ── Tab panels ────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        >

          {/* ════════════ TAB 0 — OVERVIEW ════════════ */}
          {activeTab === 0 && (
            <Stack spacing={2.5}>

              {/* KPI strip */}
              <MotionBox
                variants={listParent} initial="initial" animate="animate"
                sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' } }}
              >
                <StatCard icon={<InsightsRoundedIcon />}            label={t('incidents.title')}             value={totalIncidents}       trend={totalIncidents > 0 ? 'neutral' : 'down'} trendValue={`${openIncidents.length} ${t('reports.currently_open')}`}             intent="info"    />
                <StatCard icon={<WarningRoundedIcon />}             label={t('reports.critical_open_cases')} value={criticalOpen}         trend={criticalOpen > 0 ? 'up' : 'neutral'}    trendValue={criticalOpen > 0 ? t('reports.needs_immediate_dispatch') : t('reports.no_critical_backlog')} intent="danger"  />
                <StatCard icon={<CheckCircleRoundedIcon />}         label={t('reports.resolution_rate')}     value={`${resolutionRate}%`} trend={resolutionRate >= 60 ? 'up' : 'neutral'} trendValue={`${resolvedIncidents.length} ${t('reports.resolved_in_selected_period')}`} intent="success" />
                <StatCard icon={<MedicalServicesRoundedIcon />}     label={t('reports.average_injuries')}    value={avgInjuries}          trend={Number(avgInjuries) > 0 ? 'up' : 'neutral'}  trendValue={`${totalInjuries} ${t('reports.total_injuries_recorded')}`} intent="warning" />
                <StatCard icon={<NotificationsActiveRoundedIcon />} label={t('reports.alert_pressure')}      value={`${alertPressure}%`}  trend={alertPressure >= 50 ? 'up' : 'neutral'} trendValue={`${highPriorityAlerts} ${t('reports.high_critical_alerts')}`}   intent="warning" />
                <StatCard icon={<MapRoundedIcon />}                 label={t('reports.primary_hotspot')}     value={dominantHotspot?.location || '—'} trend="neutral" trendValue={dominantHotspot ? `${dominantHotspot.count} ${t('reports.accidents')}` : t('reports.no_location_data')} intent="danger" />
              </MotionBox>

              {/* Trend Chart */}
              <Card sx={{ p: 3, mt: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Incident Trend</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {filters.dateFrom} – {filters.dateTo}
                    </Typography>
                  </Box>
                </Stack>
                <TrendChart incidents={filteredIncidents} period={trendPeriod} />
              </Card>

              {/* Analytics triptych */}
              <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr 1fr' } }}>

                {/* Severity Donut */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65), overflow: 'hidden', position: 'relative' }}>
                  <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${theme.palette.error.main}, ${theme.palette.warning.main}, ${theme.palette.info.main}, ${theme.palette.success.main})` }} />
                  <SectionHeader icon={<PieChartRoundedIcon fontSize="small" />} title={t('reports.incident_severity_mix')} accent={theme.palette.primary.main} />
                  <Stack direction={rowDir} spacing={2.5} alignItems="center">
                    <Box sx={{ flexShrink: 0, position: 'relative' }}>
                      <Box sx={{ width: 150, height: 150, borderRadius: '50%', background: incidentDonut, boxShadow: `0 8px 28px ${alpha(theme.palette.common.black, 0.12)}` }}>
                        <Box sx={{ position: 'absolute', inset: 26, borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', textAlign: 'center', border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                          <Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>{totalIncidents}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('dashboard.total')}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                    <Stack spacing={1.25} sx={{ flex: 1 }}>
                      {incidentSeverityRows.map((row) => (
                        <Box key={row.label}>
                          <Stack direction={rowDir} justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: row.color }} />
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>{row.label}</Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              {row.count} <Box component="span" sx={{ opacity: 0.55 }}>({pct(row.count, totalIncidents)}%)</Box>
                            </Typography>
                          </Stack>
                          <Box sx={{ height: 7, borderRadius: 999, bgcolor: alpha(row.color, 0.12), overflow: 'hidden' }}>
                            <Box sx={{ width: `${pct(row.count, totalIncidents)}%`, height: '100%', bgcolor: row.color, borderRadius: 999, transition: 'width 0.5s ease' }} />
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>

                {/* Status Funnel */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65) }}>
                  <SectionHeader icon={<QueryStatsRoundedIcon fontSize="small" />} title={t('reports.incident_status_flow')} accent={theme.palette.info.main} />
                  <Stack spacing={1.25}>
                    {[
                      { label: t('reports.active'),    value: statusCounts.active,    color: theme.palette.error.main },
                      { label: t('reports.responded'), value: statusCounts.responded, color: theme.palette.warning.main },
                      { label: t('reports.resolved'),  value: statusCounts.resolved,  color: theme.palette.success.main },
                    ].map((item) => (
                      <Box key={item.label} sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(item.color, 0.05), border: `1px solid ${alpha(item.color, 0.14)}` }}>
                        <Stack direction={rowDir} justifyContent="space-between" alignItems="flex-end" sx={{ mb: 0.75 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 10 }}>
                            {item.label}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 900, color: item.color, lineHeight: 1, letterSpacing: -0.5 }}>
                            {item.value}
                          </Typography>
                        </Stack>
                        <Box sx={{ height: 5, borderRadius: 999, bgcolor: alpha(item.color, 0.15), overflow: 'hidden' }}>
                          <Box sx={{ width: `${pct(item.value, totalIncidents)}%`, height: '100%', bgcolor: item.color, borderRadius: 999, transition: 'width 0.5s ease' }} />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>

                {/* Alert Intelligence */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65) }}>
                  <SectionHeader icon={<NotificationsActiveRoundedIcon fontSize="small" />} title={t('reports.alert_severity_mix')} accent={theme.palette.warning.main} />
                  <Stack spacing={1}>
                    {alertSeverityRows.map((row) => (
                      <Box key={row.label}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: row.color }} />
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{row.label}</Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: row.color }}>{row.count}</Typography>
                        </Stack>
                        <Box sx={{ height: 7, borderRadius: 999, bgcolor: alpha(row.color, 0.12), overflow: 'hidden' }}>
                          <Box sx={{ width: `${pct(row.count, Math.max(filteredAlerts.length, 1))}%`, height: '100%', bgcolor: row.color, borderRadius: 999, transition: 'width 0.5s ease' }} />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                  <Divider sx={{ my: 2, opacity: 0.5 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                    {t('reports.alert_composition')}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
                    {Object.entries(alertTypeCounts).length === 0
                      ? <Typography variant="caption" color="text.disabled">{t('reports.no_alert_data')}</Typography>
                      : Object.entries(alertTypeCounts).map(([type, count]) => (
                          <Chip key={type} size="small" variant="outlined" color="warning" label={`${type.toUpperCase()} · ${count}`} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                        ))
                    }
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    {t('reports.unread_alerts_pending')}: <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>{unreadCount}</Box>
                  </Typography>
                </Paper>
              </Box>
            </Stack>
          )}

          {/* ════════════ TAB 1 — OPERATIONS ════════════ */}
          {activeTab === 1 && (
            <Stack spacing={2.5}>

              {/* Priority + Shift */}
              <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', xl: '1.6fr 1fr' } }}>

                {/* Priority Incidents */}
                <Paper variant="outlined" sx={{ borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65), overflow: 'hidden' }}>
                  <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`, background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.06)} 0%, transparent 50%)` }}>
                    <SectionHeader icon={<ReportProblemRoundedIcon fontSize="small" />} title={t('reports.operational_priorities')} accent={theme.palette.error.main} mb={0} />
                  </Box>
                  {priorityIncidents.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {loading ? t('reports.analyzing_accident_activity') : t('reports.no_high_priority_unresolved_accidents')}
                      </Typography>
                    </Box>
                  ) : (
                    <List disablePadding>
                      {priorityIncidents.map((incident: any, idx: number) => {
                        const isCrit    = incident.severity === 'critical'
                        const borderClr = isCrit ? theme.palette.error.main : theme.palette.warning.main
                        return (
                          <Box key={incident.id || idx}>
                            <ListItem
                              sx={{
                                px: 2.5, py: 1.75,
                                borderLeft: `3px solid ${borderClr}`,
                                '&:hover': { bgcolor: alpha(borderClr, 0.04) },
                                transition: 'background-color 0.15s',
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction={rowDir} spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                                    {incident.location || t('reports.no_location_data')}
                                  </Typography>
                                  <Chip size="small" color={isCrit ? 'error' : 'warning'} label={severityLabel[String(incident.severity || 'high')] ?? incident.severity} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                                  <Chip size="small" label={statusLabel[incident.status] ?? incident.status} variant="outlined" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {incident.injuries || 0} {t('reports.accidents')} &nbsp;·&nbsp; {incident.time || t('comms.unknown_time')}
                                </Typography>
                              </Box>
                            </ListItem>
                            {idx < priorityIncidents.length - 1 && <Divider sx={{ opacity: 0.4 }} />}
                          </Box>
                        )
                      })}
                    </List>
                  )}
                </Paper>

                {/* Shift Risk */}
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65) }}>
                  <SectionHeader icon={<QueryStatsRoundedIcon fontSize="small" />} title={t('reports.shift_risk_breakdown')} accent={theme.palette.primary.main} />
                  <Stack spacing={1.25}>
                    {shiftBreakdown.map((shift) => {
                      const isPeak   = shift.count === peakShift.count && shift.count > 0
                      const barColor = isPeak ? theme.palette.error.main : theme.palette.primary.main
                      return (
                        <Box key={shift.label}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ color: isPeak ? 'error.main' : 'text.disabled' }}>{shift.icon}</Box>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>{shift.label}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              {isPeak && <Chip size="small" label="Peak" color="error" sx={{ height: 16, fontSize: 9, fontWeight: 800 }} />}
                              <Typography variant="caption" sx={{ fontWeight: 800, color: isPeak ? 'error.main' : 'text.secondary', minWidth: 20, textAlign: 'right' }}>
                                {shift.count}
                              </Typography>
                            </Stack>
                          </Stack>
                          <Box sx={{ height: 10, borderRadius: 999, bgcolor: alpha(barColor, 0.1), overflow: 'hidden' }}>
                            <Box sx={{ width: `${(shift.count / maxShiftCount) * 100}%`, height: '100%', bgcolor: barColor, borderRadius: 999, transition: 'width 0.5s ease', opacity: isPeak ? 1 : 0.5 }} />
                          </Box>
                        </Box>
                      )
                    })}
                  </Stack>
                  <Box sx={{ mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.06), border: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
                    <Typography variant="caption" color="text.secondary">{t('reports.peak_window')}</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'error.main' }}>{peakShift.label}</Typography>
                  </Box>

                  <Divider sx={{ my: 2.5, opacity: 0.5 }} />

                  {/* Alert composition */}
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>{t('reports.alert_composition')}</Typography>
                  <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 0.5, mb: 1.5 }}>
                    {Object.entries(alertTypeCounts).length === 0
                      ? <Typography variant="caption" color="text.disabled">{t('reports.no_alert_data')}</Typography>
                      : Object.entries(alertTypeCounts).map(([type, count]) => (
                          <Chip key={type} size="small" variant="outlined" color="warning" label={`${type.toUpperCase()} · ${count}`} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                        ))
                    }
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('reports.unread_alerts_pending')}: <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>{unreadCount}</Box>
                  </Typography>
                </Paper>
              </Box>

              {/* Hotspot correlation table */}
              <Paper variant="outlined" sx={{ borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65), overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%)` }}>
                  <SectionHeader icon={<TrendingUpRoundedIcon fontSize="small" />} title={t('reports.hotspot_and_alert_correlation')} accent={theme.palette.primary.main} mb={0} />
                </Box>
                {hotspotRows.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {loading ? t('reports.preparing_hotspot_briefing') : t('reports.no_hotspot_data')}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: 2 }}>
                    <Stack spacing={0.75}>
                      {hotspotRows.map((row, idx) => {
                        const rankColor = RANK_COLORS[idx] ?? theme.palette.divider
                        const isTop3    = idx < 3
                        return (
                          <Box
                            key={`${row.location}-${idx}`}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1.75,
                              p: 1.5, borderRadius: 2.5,
                              bgcolor: isTop3 ? alpha(rankColor, 0.04) : 'transparent',
                              border: `1px solid ${alpha(isTop3 ? rankColor : theme.palette.divider, isTop3 ? 0.2 : 0.5)}`,
                              '&:hover': { bgcolor: alpha(isTop3 ? rankColor : theme.palette.primary.main, 0.06) },
                              transition: 'background-color 0.15s',
                            }}
                          >
                            <Box sx={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: isTop3 ? alpha(rankColor, 0.15) : alpha(theme.palette.divider, 0.3), border: `1.5px solid ${alpha(rankColor, isTop3 ? 0.4 : 0.1)}` }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 900, color: isTop3 ? rankColor : 'text.disabled', lineHeight: 1 }}>{idx + 1}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction={rowDir} justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>{row.location}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, flexShrink: 0, ml: 1 }}>{row.share}%</Typography>
                              </Stack>
                              <Box sx={{ height: 6, borderRadius: 999, bgcolor: alpha(isTop3 ? rankColor : theme.palette.primary.main, 0.12), overflow: 'hidden' }}>
                                <Box sx={{ width: `${row.share}%`, height: '100%', bgcolor: isTop3 ? rankColor : theme.palette.primary.main, borderRadius: 999, transition: 'width 0.5s ease' }} />
                              </Box>
                            </Box>
                            <Stack direction="row" spacing={0.75} flexShrink={0}>
                              <Chip size="small" label={`${row.count} inc.`} sx={{ height: 22, fontSize: 10, fontWeight: 700, bgcolor: alpha(isTop3 ? rankColor : theme.palette.primary.main, 0.1), color: isTop3 ? rankColor : 'primary.main', border: 'none' }} />
                              {row.relatedAlerts > 0 && (
                                <Chip size="small" label={`${row.relatedAlerts} alerts`} color="warning" variant="outlined" sx={{ height: 22, fontSize: 10, fontWeight: 700 }} />
                              )}
                            </Stack>
                          </Box>
                        )
                      })}
                    </Stack>
                  </Box>
                )}
              </Paper>
            </Stack>
          )}

          {/* ════════════ TAB 2 — GEOGRAPHIC ════════════ */}
          {activeTab === 2 && (
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', xl: '1fr 400px' }, alignItems: 'start' }}>
              <IncidentHeatmapPanel
                incidents={filteredIncidents as Incident[]}
                viewMode={filters.viewMode}
                onViewModeChange={(v) => setFilters((p) => ({ ...p, viewMode: v }))}
              />
              <CauseRanking incidents={filteredIncidents as Incident[]} />
            </Box>
          )}

        </motion.div>
      </AnimatePresence>
    </Stack>
  )
}
