import { useEffect, useMemo, useState } from 'react'
import { 
  Box, 
  Stack, 
  Typography, 
  alpha, 
  useTheme,
  TextField,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Divider
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

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents } from '../../incidents/slices/incidentsSlice'
import type { Incident } from '../../incidents/slices/incidentsSlice'
import { fetchAlerts } from '../../alerts/slices/alertsSlice'
import Card from '../../../components/Common/Card'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'
import { useTranslation, useThemeMode } from '../../../themeMode'
import IncidentHeatmapPanel from '../../dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel'
import CauseRanking from '../../dashboard/components/EnhancedKpiDashboard/CauseRanking'

const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const dayRangeMap: Record<string, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
}

interface Hotspot {
  location: string
  count: number
}

interface SeverityRow {
  label: string
  count: number
  color: string
}

function pct(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function parseDate(input: string | undefined): Date | null {
  if (!input) return null
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function ReportsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const { t } = useTranslation()
  const { locale } = useThemeMode()
  const rowDirection = theme.direction === 'rtl' ? 'row-reverse' : 'row'

  const severityLabel: Record<string, string> = {
    critical: t('dashboard.critical'),
    high: t('dashboard.high'),
    medium: t('dashboard.medium'),
    low: t('dashboard.low'),
  }

  const statusLabel: Record<string, string> = {
    active: t('reports.active'),
    responded: t('reports.responded'),
    resolved: t('reports.resolved'),
  }
  const [timeRange, setTimeRange] = useState('month')
  const { list: incidents, loading: incidentsLoading, error: incidentsError } = useAppSelector((state) => state.incidents)
  const { list: alerts, unreadCount, loading: alertsLoading, error: alertsError } = useAppSelector((state) => state.alerts)

  useEffect(() => {
    dispatch(fetchIncidents({ page: 1, limit: 20 }) as any)
    dispatch(fetchAlerts({ page: 1, limit: 20 }) as any)
  }, [dispatch])

  const cutoffDate = useMemo(() => {
    const days = dayRangeMap[timeRange] ?? 30
    const now = new Date()
    now.setDate(now.getDate() - days)
    return now
  }, [timeRange])

  const filteredIncidents = useMemo(
    () => incidents.filter((incident: any) => {
      const incidentDate = parseDate(incident.time)
      return incidentDate ? incidentDate >= cutoffDate : true
    }),
    [incidents, cutoffDate]
  )

  const filteredAlerts = useMemo(
    () => alerts.filter((alert: any) => {
      const alertDate = parseDate(alert.time)
      return alertDate ? alertDate >= cutoffDate : true
    }),
    [alerts, cutoffDate]
  )

  const totalIncidents = filteredIncidents.length
  const openIncidents = filteredIncidents.filter((i: any) => i.status !== 'resolved')
  const resolvedIncidents = filteredIncidents.filter((i: any) => i.status === 'resolved')
  const criticalOpen = openIncidents.filter((i: any) => i.severity === 'critical').length
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents.length / totalIncidents) * 100) : 0
  const totalInjuries = filteredIncidents.reduce((sum: number, incident: any) => sum + Number(incident.injuries || 0), 0)
  const avgInjuriesPerIncident = totalIncidents > 0 ? (totalInjuries / totalIncidents).toFixed(1) : '0.0'

  const severityCounts = filteredIncidents.reduce((acc: Record<string, number>, incident: any) => {
    const key = String(incident.severity || 'low').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const alertSeverityCounts = filteredAlerts.reduce((acc: Record<string, number>, alert: any) => {
    const key = String(alert.severity || 'medium').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const alertTypeCounts = filteredAlerts.reduce((acc: Record<string, number>, alert: any) => {
    const key = String(alert.type || 'system').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const hotspotMap = filteredIncidents.reduce((acc: Record<string, Hotspot>, incident: any) => {
      const location = String(incident.location || t('reports.no_location_data')).trim()
      const normalized = location.toLowerCase()
      if (!acc[normalized]) {
        acc[normalized] = { location, count: 0 }
      }
      acc[normalized].count += 1
      return acc
    }, {})

  const hotspots = (Object.values(hotspotMap) as Hotspot[]).sort((a, b) => b.count - a.count)

  const dominantHotspot: Hotspot | undefined = hotspots[0]
  const highPriorityAlerts = (alertSeverityCounts.critical || 0) + (alertSeverityCounts.high || 0)
  const alertPressure = filteredAlerts.length > 0
    ? Math.round((highPriorityAlerts / filteredAlerts.length) * 100)
    : 0

  const priorityIncidents = openIncidents
    .filter((incident: any) => severityRank[incident.severity] >= severityRank.high)
    .sort((a: any, b: any) => {
      const rankDelta = severityRank[b.severity] - severityRank[a.severity]
      if (rankDelta !== 0) return rankDelta
      return Number(b.injuries || 0) - Number(a.injuries || 0)
    })
    .slice(0, 8)

  const shiftBreakdown = [
    { label: t('reports.night_shift'), start: 0, end: 5, count: 0 },
    { label: t('reports.morning_shift'), start: 6, end: 11, count: 0 },
    { label: t('reports.afternoon_shift'), start: 12, end: 17, count: 0 },
    { label: t('reports.evening_shift'), start: 18, end: 23, count: 0 },
  ]

  filteredIncidents.forEach((incident: any) => {
    const date = parseDate(incident.time)
    if (!date) return
    const hour = date.getHours()
    const bucket = shiftBreakdown.find((shift) => hour >= shift.start && hour <= shift.end)
    if (bucket) bucket.count += 1
  })

  const peakShift = shiftBreakdown.reduce((best, current) => current.count > best.count ? current : best, shiftBreakdown[0])

  const hotspotRows = hotspots.slice(0, 6).map((spot) => {
    const normalized = spot.location.toLowerCase()
    const relatedAlerts = filteredAlerts.filter((alert: any) => {
      const haystack = `${alert.title} ${alert.description}`.toLowerCase()
      return haystack.includes(normalized)
    }).length
    const share = totalIncidents > 0 ? Math.round((spot.count / totalIncidents) * 100) : 0
    return { ...spot, relatedAlerts, share }
  })

  const incidentSeverityRows: SeverityRow[] = [
    { label: t('dashboard.critical'), count: severityCounts.critical || 0, color: theme.palette.error.main },
    { label: t('dashboard.high'), count: severityCounts.high || 0, color: theme.palette.warning.main },
    { label: t('dashboard.medium'), count: severityCounts.medium || 0, color: theme.palette.info.main },
    { label: t('dashboard.low'), count: severityCounts.low || 0, color: theme.palette.success.main },
  ]

  const alertSeverityRows: SeverityRow[] = [
    { label: t('dashboard.critical'), count: alertSeverityCounts.critical || 0, color: theme.palette.error.main },
    { label: t('dashboard.high'), count: alertSeverityCounts.high || 0, color: theme.palette.warning.main },
    { label: t('dashboard.medium'), count: alertSeverityCounts.medium || 0, color: theme.palette.info.main },
    { label: t('dashboard.low'), count: alertSeverityCounts.low || 0, color: theme.palette.success.main },
  ]

  const statusCounts = {
    active: filteredIncidents.filter((i: any) => i.status === 'active').length,
    responded: filteredIncidents.filter((i: any) => i.status === 'responded').length,
    resolved: filteredIncidents.filter((i: any) => i.status === 'resolved').length,
  }

  const incidentDonut = useMemo(() => {
    const total = incidentSeverityRows.reduce((sum, row) => sum + row.count, 0)
    if (total === 0) return `conic-gradient(${alpha(theme.palette.divider, 0.4)} 0% 100%)`
    let current = 0
    const segments = incidentSeverityRows.map((row) => {
      const start = current
      const delta = (row.count / total) * 100
      current += delta
      return `${row.color} ${start}% ${current}%`
    })
    return `conic-gradient(${segments.join(', ')})`
  }, [incidentSeverityRows, theme.palette.divider])

  const dailyTimeline = useMemo(() => {
    const days = timeRange === 'day' ? 1 : 7
    const labels: { day: string; incidents: number; alerts: number }[] = []
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - i)
      const dayKey = date.toISOString().slice(0, 10)
      const label = date.toLocaleDateString(locale, { weekday: 'short' })
      const incidentsCount = filteredIncidents.filter((incident: any) => {
        const parsed = parseDate(incident.time)
        return parsed ? parsed.toISOString().slice(0, 10) === dayKey : false
      }).length
      const alertsCount = filteredAlerts.filter((alert: any) => {
        const parsed = parseDate(alert.time)
        return parsed ? parsed.toISOString().slice(0, 10) === dayKey : false
      }).length
      labels.push({ day: label, incidents: incidentsCount, alerts: alertsCount })
    }
    return labels
  }, [filteredAlerts, filteredIncidents, timeRange, locale])

  const reportExportData = [{
    generatedAt: new Date().toISOString(),
    timeRange,
    summary: {
      totalIncidents,
      resolutionRate,
      openIncidents: openIncidents.length,
      criticalOpen,
      unreadAlerts: unreadCount,
      alertPressure,
    },
    incidentsBySeverity: severityCounts,
    alertsBySeverity: alertSeverityCounts,
    incidentsByStatus: statusCounts,
    alertsByType: alertTypeCounts,
    sevenDayActivity: dailyTimeline,
    hotspots: hotspotRows,
    priorityIncidents: priorityIncidents.map((incident: any) => ({
      id: incident.id,
      location: incident.location,
      severity: incident.severity,
      injuries: incident.injuries,
      status: incident.status,
      time: incident.time,
    })),
  }]

  const loading = incidentsLoading || alertsLoading
  const fetchError = incidentsError || alertsError

  return (
    <Stack spacing={4} sx={{ pb: 4 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>{t('reports.title')}</Typography>
          <Typography color="text.secondary">{t('reports.subtitle')}</Typography>
        </Box>
        <Stack direction={rowDirection} spacing={2}>
           <TextField
             select
             size="small"
             value={timeRange}
             onChange={(e) => setTimeRange(e.target.value)}
             InputProps={{
               startAdornment: <FilterListRoundedIcon fontSize="small" sx={{ marginInlineEnd: 1, color: 'text.secondary' }} />,
               sx: { borderRadius: '100px', bgcolor: 'background.paper', px: 1 }
             }}
           >
             <MenuItem value="day">{t('common.today')}</MenuItem>
             <MenuItem value="week">{t('common.week')}</MenuItem>
             <MenuItem value="month">{t('common.month')}</MenuItem>
             <MenuItem value="year">{t('common.year')}</MenuItem>
           </TextField>
          <ExportButton
            data={reportExportData}
            filename={`officer-briefing-${timeRange}`}
            label={t('common.view_all')}
            title={t('reports.officer_briefing')}
            variant="report"
          />
        </Stack>
      </Box>

      {/* Stats Grid */}
      {fetchError && (
        <Card sx={{ p: 2.5, border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`, bgcolor: alpha(theme.palette.error.main, 0.06) }}>
          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
            {t('reports.unable_to_load_complete_report_data')}: {fetchError}
          </Typography>
        </Card>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        <StatCard 
          icon={<InsightsRoundedIcon />} 
          label={t('incidents.title')} 
          value={totalIncidents} 
          trend={totalIncidents > 0 ? "neutral" : "down"} 
          trendValue={`${openIncidents.length} ${t('reports.currently_open')}`} 
          intent="info"
        />
        <StatCard 
          icon={<WarningRoundedIcon />} 
          label={t('reports.critical_open_cases')} 
          value={criticalOpen} 
          trend={criticalOpen > 0 ? "up" : "neutral"} 
          trendValue={criticalOpen > 0 ? t('reports.needs_immediate_dispatch') : t('reports.no_critical_backlog')} 
          intent="danger"
        />
        <StatCard 
          icon={<CheckCircleRoundedIcon />} 
          label={t('reports.resolution_rate')} 
          value={`${resolutionRate}%`} 
          trend={resolutionRate >= 60 ? "up" : "neutral"} 
          trendValue={`${resolvedIncidents.length} ${t('reports.resolved_in_selected_period')}`} 
          intent="success"
        />
        <StatCard 
          icon={<MedicalServicesRoundedIcon />} 
          label={t('reports.average_injuries')} 
          value={avgInjuriesPerIncident} 
          trend={Number(avgInjuriesPerIncident) > 0 ? "up" : "neutral"} 
          trendValue={`${totalInjuries} ${t('reports.total_injuries_recorded')}`} 
          intent="warning"
        />
        <StatCard 
          icon={<NotificationsActiveRoundedIcon />} 
          label={t('reports.alert_pressure')} 
          value={`${alertPressure}%`} 
          trend={alertPressure >= 50 ? "up" : "neutral"} 
          trendValue={`${highPriorityAlerts} ${t('reports.high_critical_alerts')}`} 
          intent="warning"
        />
        <StatCard 
          icon={<MapRoundedIcon />} 
          label={t('reports.primary_hotspot')} 
          value={dominantHotspot?.location || t('reports.no_location_data')} 
          trend="neutral" 
          trendValue={dominantHotspot ? `${dominantHotspot.count} ${t('reports.accidents')}` : t('reports.no_location_data')} 
          intent="danger"
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1.1fr 1fr 1fr' } }}>
        <Card sx={{ p: 3 }}>
          <Stack direction={rowDirection} spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <PieChartRoundedIcon color="primary" fontSize="small" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('reports.incident_severity_mix')}</Typography>
          </Stack>
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: incidentDonut,
                position: 'relative',
                flexShrink: 0
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 22,
                  borderRadius: '50%',
                  bgcolor: 'background.paper',
                  display: 'grid',
                  placeItems: 'center',
                  border: `1px solid ${theme.palette.divider}`
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{totalIncidents}</Typography>
              </Box>
            </Box>
            <Stack spacing={1} sx={{ flex: 1 }}>
              {incidentSeverityRows.map((row) => (
                <Box key={row.label}>
                  <Stack direction={rowDirection} justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{row.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.count} ({pct(row.count, totalIncidents)}%)</Typography>
                  </Stack>
                  <Box sx={{ height: 8, borderRadius: 999, bgcolor: alpha(row.color, 0.16), overflow: 'hidden' }}>
                    <Box sx={{ width: `${pct(row.count, totalIncidents)}%`, height: '100%', bgcolor: row.color }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Card>

        <Card sx={{ p: 3 }}>
          <Stack direction={rowDirection} spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <QueryStatsRoundedIcon color="primary" fontSize="small" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('reports.incident_status_flow')}</Typography>
          </Stack>
          <Stack spacing={1.5}>
            {[
              { label: t('reports.active'), value: statusCounts.active, color: theme.palette.error.main },
              { label: t('reports.responded'), value: statusCounts.responded, color: theme.palette.warning.main },
              { label: t('reports.resolved'), value: statusCounts.resolved, color: theme.palette.success.main },
            ].map((item) => (
              <Box key={item.label}>
                <Stack direction={rowDirection} justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.value}</Typography>
                </Stack>
                <Box sx={{ height: 10, borderRadius: 999, bgcolor: alpha(item.color, 0.14), overflow: 'hidden' }}>
                  <Box sx={{ width: `${pct(item.value, totalIncidents)}%`, height: '100%', bgcolor: item.color }} />
                </Box>
              </Box>
            ))}
          </Stack>
        </Card>

        <Card sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <NotificationsActiveRoundedIcon color="primary" fontSize="small" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('reports.alert_severity_mix')}</Typography>
          </Stack>
          <Stack spacing={1.25}>
            {alertSeverityRows.map((row) => (
              <Box key={row.label}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{row.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.count}</Typography>
                </Stack>
                <Box sx={{ height: 8, borderRadius: 999, bgcolor: alpha(row.color, 0.16), overflow: 'hidden' }}>
                  <Box sx={{ width: `${pct(row.count, Math.max(filteredAlerts.length, 1))}%`, height: '100%', bgcolor: row.color }} />
                </Box>
              </Box>
            ))}
          </Stack>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', xl: '1.5fr 1fr' } }}>
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 1.5, flexDirection: rowDirection }}>
             <Box sx={{ p: 1, borderRadius: 'var(--radius-m3-md, 12px)', bgcolor: alpha(theme.palette.error.main, 0.12), color: 'error.main', display: 'flex' }}>
                <ReportProblemRoundedIcon fontSize="small" />
             </Box>
             <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('reports.operational_priorities')}</Typography>
          </Box>
          {priorityIncidents.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
              {loading ? t('reports.analyzing_accident_activity') : t('reports.no_high_priority_unresolved_accidents')}
            </Box>
          ) : (
            <List disablePadding>
              {priorityIncidents.map((incident: any, idx: number) => (
                <Box key={incident.id || idx}>
                  <ListItem sx={{ px: 3, py: 2 }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        marginInlineEnd: 2,
                        bgcolor: incident.severity === 'critical'
                          ? alpha(theme.palette.error.main, 0.15)
                          : alpha(theme.palette.warning.main, 0.15),
                        color: incident.severity === 'critical' ? 'error.main' : 'warning.main'
                      }}
                    >
                      <WarningRoundedIcon fontSize="small" />
                    </Avatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {incident.location || t('reports.no_location_data')}
                          </Typography>
                          <Chip
                            size="small"
                            color={incident.severity === 'critical' ? 'error' : 'warning'}
                            label={severityLabel[String(incident.severity || 'high')] ?? String(incident.severity || 'high').toUpperCase()}
                            variant="outlined"
                          />
                        </Stack>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {incident.injuries || 0} {t('reports.accidents')} • {t('incidents.status')}: {statusLabel[incident.status] ?? incident.status} • {incident.time || t('comms.unknown_time')}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {idx < priorityIncidents.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </Card>

        <Stack spacing={3}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t('reports.shift_risk_breakdown')}</Typography>
            <Stack spacing={1.25}>
              {shiftBreakdown.map((shift) => (
                <Box key={shift.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{shift.label}</Typography>
                  <Chip size="small" color={shift.count === peakShift.count && shift.count > 0 ? 'error' : 'default'} label={`${shift.count} ${t('reports.accidents')}`} />
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              {t('reports.peak_window')}: {peakShift.label}
            </Typography>
          </Card>

          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t('reports.alert_composition')}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(alertTypeCounts).length === 0 ? (
                <Chip size="small" label={t('reports.no_alert_data')} />
              ) : (
                Object.entries(alertTypeCounts).map(([type, count]) => (
                  <Chip
                    key={type}
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${type.toUpperCase()}: ${count}`}
                  />
                ))
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('reports.unread_alerts_pending')}: {unreadCount}
            </Typography>
          </Card>
        </Stack>
      </Box>

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
           <Box sx={{ p: 1, borderRadius: 'var(--radius-m3-md, 12px)', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
              <TrendingUpRoundedIcon fontSize="small" />
           </Box>
           <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('reports.hotspot_and_alert_correlation')}</Typography>
        </Box>
        <Stack divider={<Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />}>
          {hotspotRows.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
              {loading ? t('reports.preparing_hotspot_briefing') : t('reports.no_hotspot_data')}
            </Box>
          ) : (
            hotspotRows.map((row, idx) => (
              <Box
                key={`${row.location}-${idx}`}
                sx={{
                  p: 3,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background-color 0.2s',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) }
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{row.location}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {row.count} {t('reports.accidents')} • {row.relatedAlerts} {t('reports.related_alerts')}
                  </Typography>
                </Box>
                <Chip label={`${row.share}% ${t('reports.of_incidents')}`} color="primary" variant="outlined" sx={{ fontWeight: 800, borderRadius: '8px', borderWidth: 2 }} />
              </Box>
            ))
          )}
        </Stack>
      </Card>

      {/* Geospatial heatmap + cause ranking */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', xl: '1fr 380px' }, alignItems: 'start' }}>
        <IncidentHeatmapPanel incidents={filteredIncidents as Incident[]} />
        <CauseRanking incidents={filteredIncidents as Incident[]} />
      </Box>
    </Stack>
  )
}
