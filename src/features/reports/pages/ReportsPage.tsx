import { useEffect, useMemo, useState } from 'react'
import {
  Box, Chip, Divider, List, ListItem, Paper,
  Stack, Typography, alpha, useTheme,
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

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents } from '../../incidents/slices/incidentsSlice'
import type { Incident } from '../../incidents/slices/incidentsSlice'
import { fetchAlerts } from '../../alerts/slices/alertsSlice'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'
import { useTranslation, useThemeMode } from '../../../themeMode'
import IncidentHeatmapPanel from '../../dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel'
import CauseRanking from '../../dashboard/components/EnhancedKpiDashboard/CauseRanking'
import { motion } from 'framer-motion'
import { listParent, listChild } from '../../../utils/motion'

const MotionBox = motion(Box)

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
const dayRangeMap: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }
const RANK_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32']

interface Hotspot { location: string; count: number }
interface SeverityRow { label: string; count: number; color: string }

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}
function parseDate(input: string | undefined): Date | null {
  if (!input) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

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

export default function ReportsPage() {
  const dispatch = useAppDispatch()
  const theme    = useTheme()
  const { t }    = useTranslation()
  const { locale } = useThemeMode()
  const rowDir   = theme.direction === 'rtl' ? 'row-reverse' : 'row'

  const severityLabel: Record<string, string> = {
    critical: t('dashboard.critical'), high: t('dashboard.high'),
    medium: t('dashboard.medium'),     low: t('dashboard.low'),
  }
  const statusLabel: Record<string, string> = {
    active: t('reports.active'), responded: t('reports.responded'), resolved: t('reports.resolved'),
  }

  const [timeRange, setTimeRange] = useState('month')
  const { list: incidents, loading: incidentsLoading, error: incidentsError } = useAppSelector((s) => s.incidents)
  const { list: alerts, unreadCount, loading: alertsLoading, error: alertsError } = useAppSelector((s) => s.alerts)

  useEffect(() => {
    dispatch(fetchIncidents({ page: 1, limit: 50 }) as any)
    dispatch(fetchAlerts({ page: 1, limit: 50 }) as any)
  }, [dispatch])

  const cutoffDate = useMemo(() => {
    const now = new Date()
    now.setDate(now.getDate() - (dayRangeMap[timeRange] ?? 30))
    return now
  }, [timeRange])

  const filteredIncidents = useMemo(
    () => incidents.filter((i: any) => { const d = parseDate(i.timestamp || i.time); return d ? d >= cutoffDate : true }),
    [incidents, cutoffDate]
  )
  const filteredAlerts = useMemo(
    () => alerts.filter((a: any) => { const d = parseDate((a as any).timestamp || a.time); return d ? d >= cutoffDate : true }),
    [alerts, cutoffDate]
  )

  const totalIncidents     = filteredIncidents.length
  const openIncidents      = filteredIncidents.filter((i: any) => i.status !== 'resolved')
  const resolvedIncidents  = filteredIncidents.filter((i: any) => i.status === 'resolved')
  const criticalOpen       = openIncidents.filter((i: any) => i.severity === 'critical').length
  const resolutionRate     = totalIncidents > 0 ? Math.round((resolvedIncidents.length / totalIncidents) * 100) : 0
  const totalInjuries      = filteredIncidents.reduce((s: number, i: any) => s + Number(i.injuries || 0), 0)
  const avgInjuries        = totalIncidents > 0 ? (totalInjuries / totalIncidents).toFixed(1) : '0.0'

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
  const hotspots = (Object.values(hotspotMap) as Hotspot[]).sort((a, b) => b.count - a.count)
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
    { label: t('reports.night_shift'),     icon: <NightlightRoundedIcon sx={{ fontSize: 14 }} />,    start: 0,  end: 5,  count: 0 },
    { label: t('reports.morning_shift'),   icon: <WbSunnyRoundedIcon sx={{ fontSize: 14 }} />,       start: 6,  end: 11, count: 0 },
    { label: t('reports.afternoon_shift'), icon: <Brightness5RoundedIcon sx={{ fontSize: 14 }} />,   start: 12, end: 17, count: 0 },
    { label: t('reports.evening_shift'),   icon: <Brightness4RoundedIcon sx={{ fontSize: 14 }} />,   start: 18, end: 23, count: 0 },
  ]
  filteredIncidents.forEach((i: any) => {
    const d = parseDate(i.time); if (!d) return
    const h = d.getHours()
    const b = shiftBreakdown.find((s) => h >= s.start && h <= s.end)
    if (b) b.count += 1
  })
  const maxShiftCount = Math.max(...shiftBreakdown.map((s) => s.count), 1)
  const peakShift = shiftBreakdown.reduce((b, c) => (c.count > b.count ? c : b), shiftBreakdown[0])

  const hotspotRows = hotspots.slice(0, 6).map((spot) => {
    const norm = spot.location.toLowerCase()
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
    const segs = incidentSeverityRows.map((r) => {
      const start = cur; cur += (r.count / total) * 100
      return `${r.color} ${start}% ${cur}%`
    })
    return `conic-gradient(${segs.join(', ')})`
  }, [incidentSeverityRows, theme.palette.divider])

  const dailyTimeline = useMemo(() => {
    const days = timeRange === 'day' ? 1 : 7
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (days - 1 - i))
      const dayKey = date.toISOString().slice(0, 10)
      const label = date.toLocaleDateString(locale, { weekday: 'short' })
      return {
        day: label,
        incidents: filteredIncidents.filter((x: any) => parseDate(x.time)?.toISOString().slice(0, 10) === dayKey).length,
        alerts:    filteredAlerts.filter((x: any) => parseDate(x.time)?.toISOString().slice(0, 10) === dayKey).length,
      }
    })
  }, [filteredAlerts, filteredIncidents, timeRange, locale])

  const reportExportData = [{
    generatedAt: new Date().toISOString(), timeRange,
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

  const TIME_PRESETS = [
    { value: 'day',   label: t('common.today') },
    { value: 'week',  label: t('common.week') },
    { value: 'month', label: t('common.month') },
    { value: 'year',  label: t('common.year') },
  ]

  return (
    <Stack spacing={3.5} sx={{ pb: 5, maxWidth: 1600, mx: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.4 }}>
            {t('reports.title')}
          </Typography>
          <Typography color="text.secondary">{t('reports.subtitle')}</Typography>
        </Box>
        <Stack direction={rowDir} spacing={1.25} alignItems="center" flexWrap="wrap">
          <Stack direction="row" spacing={0.5}>
            {TIME_PRESETS.map((p) => (
              <Chip
                key={p.value}
                size="small"
                label={p.label}
                onClick={() => setTimeRange(p.value)}
                variant={timeRange === p.value ? 'filled' : 'outlined'}
                color={timeRange === p.value ? 'primary' : 'default'}
                icon={<FilterListRoundedIcon sx={{ fontSize: '14px !important' }} />}
                sx={{ fontWeight: 600, '& .MuiChip-icon': { ml: 0.75 } }}
              />
            ))}
          </Stack>
          <ExportButton
            data={reportExportData}
            filename={`officer-briefing-${timeRange}`}
            label={t('common.view_all')}
            title={t('reports.officer_briefing')}
            variant="report"
          />
        </Stack>
      </Box>

      {/* ── Error banner ──────────────────────────────────────── */}
      {fetchError && (
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2.5, borderColor: alpha(theme.palette.error.main, 0.3), bgcolor: alpha(theme.palette.error.main, 0.05) }}
        >
          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
            {t('reports.unable_to_load_complete_report_data')}: {fetchError}
          </Typography>
        </Paper>
      )}

      {/* ── KPI Scorecard ─────────────────────────────────────── */}
      <MotionBox variants={listParent} initial="initial" animate="animate"
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' } }}
      >
        <StatCard icon={<InsightsRoundedIcon />}            label={t('incidents.title')}            value={totalIncidents}       trend={totalIncidents > 0 ? 'neutral' : 'down'} trendValue={`${openIncidents.length} ${t('reports.currently_open')}`}              intent="info"    />
        <StatCard icon={<WarningRoundedIcon />}             label={t('reports.critical_open_cases')} value={criticalOpen}         trend={criticalOpen > 0 ? 'up' : 'neutral'}    trendValue={criticalOpen > 0 ? t('reports.needs_immediate_dispatch') : t('reports.no_critical_backlog')}  intent="danger"  />
        <StatCard icon={<CheckCircleRoundedIcon />}         label={t('reports.resolution_rate')}    value={`${resolutionRate}%`} trend={resolutionRate >= 60 ? 'up' : 'neutral'} trendValue={`${resolvedIncidents.length} ${t('reports.resolved_in_selected_period')}`}  intent="success" />
        <StatCard icon={<MedicalServicesRoundedIcon />}     label={t('reports.average_injuries')}   value={avgInjuries}          trend={Number(avgInjuries) > 0 ? 'up' : 'neutral'}  trendValue={`${totalInjuries} ${t('reports.total_injuries_recorded')}`}  intent="warning" />
        <StatCard icon={<NotificationsActiveRoundedIcon />} label={t('reports.alert_pressure')}     value={`${alertPressure}%`}  trend={alertPressure >= 50 ? 'up' : 'neutral'} trendValue={`${highPriorityAlerts} ${t('reports.high_critical_alerts')}`}    intent="warning" />
        <StatCard icon={<MapRoundedIcon />}                 label={t('reports.primary_hotspot')}    value={dominantHotspot?.location || '—'} trend="neutral"  trendValue={dominantHotspot ? `${dominantHotspot.count} ${t('reports.accidents')}` : t('reports.no_location_data')} intent="danger" />
      </MotionBox>

      {/* ── Analytics Triptych ────────────────────────────────── */}
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
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{row.label}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {row.count} <Box component="span" sx={{ opacity: 0.6 }}>({pct(row.count, totalIncidents)}%)</Box>
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 7, borderRadius: 999, bgcolor: alpha(row.color, 0.12), overflow: 'hidden' }}>
                    <Box sx={{ width: `${pct(row.count, totalIncidents)}%`, height: '100%', bgcolor: row.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
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
              <Box
                key={item.label}
                sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(item.color, 0.05), border: `1px solid ${alpha(item.color, 0.14)}` }}
              >
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
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
            {Object.entries(alertTypeCounts).length === 0 ? (
              <Typography variant="caption" color="text.disabled">{t('reports.no_alert_data')}</Typography>
            ) : (
              Object.entries(alertTypeCounts).map(([type, count]) => (
                <Chip key={type} size="small" variant="outlined" color="warning"
                  label={`${type.toUpperCase()} · ${count}`}
                  sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                />
              ))
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            {t('reports.unread_alerts_pending')}: <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>{unreadCount}</Box>
          </Typography>
        </Paper>
      </Box>

      {/* ── Operations Row ────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', xl: '1.6fr 1fr' } }}>

        {/* Priority Incidents */}
        <Paper variant="outlined" sx={{ borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65), overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`, background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.06)} 0%, transparent 50%)` }}>
            <SectionHeader icon={<ReportProblemRoundedIcon fontSize="small" />} title={t('reports.operational_priorities')} accent={theme.palette.error.main} mb={0} />
          </Box>
          {priorityIncidents.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">{loading ? t('reports.analyzing_accident_activity') : t('reports.no_high_priority_unresolved_accidents')}</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {priorityIncidents.map((incident: any, idx: number) => {
                const isCritical = incident.severity === 'critical'
                const borderColor = isCritical ? theme.palette.error.main : theme.palette.warning.main
                return (
                  <Box key={incident.id || idx}>
                    <ListItem
                      sx={{
                        px: 2.5, py: 1.75,
                        borderLeft: `3px solid ${borderColor}`,
                        '&:hover': { bgcolor: alpha(borderColor, 0.04) },
                        transition: 'background-color 0.15s',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction={rowDir} spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                            {incident.location || t('reports.no_location_data')}
                          </Typography>
                          <Chip
                            size="small"
                            color={isCritical ? 'error' : 'warning'}
                            label={severityLabel[String(incident.severity || 'high')] ?? incident.severity}
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                          />
                          <Chip
                            size="small"
                            label={statusLabel[incident.status] ?? incident.status}
                            variant="outlined"
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {incident.injuries || 0} {t('reports.accidents')} &nbsp;·&nbsp; {incident.time || t('comms.unknown_time')}
                        </Typography>
                      </Box>
                    </ListItem>
                    {idx < priorityIncidents.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
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
              const barW     = `${(shift.count / maxShiftCount) * 100}%`
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
                    <Box sx={{ width: barW, height: '100%', bgcolor: barColor, borderRadius: 999, transition: 'width 0.5s ease', opacity: isPeak ? 1 : 0.55 }} />
                  </Box>
                </Box>
              )
            })}
          </Stack>
          <Box sx={{ mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.06), border: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
            <Typography variant="caption" color="text.secondary">{t('reports.peak_window')}</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'error.main' }}>{peakShift.label}</Typography>
          </Box>
        </Paper>
      </Box>

      {/* ── Hotspot Table ─────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.65), overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%)` }}>
          <SectionHeader icon={<TrendingUpRoundedIcon fontSize="small" />} title={t('reports.hotspot_and_alert_correlation')} accent={theme.palette.primary.main} mb={0} />
        </Box>
        {hotspotRows.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">{loading ? t('reports.preparing_hotspot_briefing') : t('reports.no_hotspot_data')}</Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <Stack spacing={0.75}>
              {hotspotRows.map((row, idx) => {
                const rankColor = RANK_COLORS[idx] ?? theme.palette.divider
                const isTop3 = idx < 3
                return (
                  <Box
                    key={`${row.location}-${idx}`}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.75,
                      p: 1.5, borderRadius: 2.5,
                      bgcolor: isTop3 ? alpha(rankColor, 0.04) : 'transparent',
                      border: `1px solid ${alpha(isTop3 ? rankColor : theme.palette.divider, isTop3 ? 0.2 : 0.5)}`,
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: alpha(isTop3 ? rankColor : theme.palette.primary.main, 0.06) },
                    }}
                  >
                    <Box sx={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: isTop3 ? alpha(rankColor, 0.15) : alpha(theme.palette.divider, 0.3), border: `1.5px solid ${alpha(rankColor, isTop3 ? 0.4 : 0.1)}` }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 900, color: isTop3 ? rankColor : 'text.disabled', lineHeight: 1 }}>{idx + 1}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction={rowDir} justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>{row.location}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, flexShrink: 0, ml: 1 }}>
                          {row.share}%
                        </Typography>
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

      {/* ── Geospatial + Cause Ranking ────────────────────────── */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', xl: '1fr 400px' }, alignItems: 'start' }}>
        <IncidentHeatmapPanel incidents={filteredIncidents as Incident[]} />
        <CauseRanking incidents={filteredIncidents as Incident[]} />
      </Box>

    </Stack>
  )
}
