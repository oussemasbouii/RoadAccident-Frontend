import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Avatar,
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'
import type { Alert } from '../../alerts/slices/alertsSlice'
import type { Incident } from '../../incidents/slices/incidentsSlice'
import { useTranslation, useThemeMode } from '../../../themeMode'

type Props = {
  incidents: Incident[]
  alerts: Alert[]
}

type SeverityRow = {
  label: string
  count: number
  color: string
  key: string
}

type HotspotRow = {
  location: string
  count: number
  share: number
  incidents: Incident[]
}

function toDate(value?: string) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatDayLabel(date: Date, locale: string) {
  return date.toLocaleDateString(locale, { weekday: 'short' })
}

function formatDateLabel(date: Date, locale: string) {
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function normalizeLocation(location: string) {
  return location.trim().toLowerCase()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildSeries(incidents: Incident[], alerts: Alert[], locale: string) {
  const days = Array.from({ length: 7 }, (_, idx) => {
    const date = startOfDay(new Date())
    date.setDate(date.getDate() - (6 - idx))
    return date
  })

  return days.map((day) => {
    const dayKey = day.toISOString().slice(0, 10)
    const incidentCount = incidents.filter((item) => {
      const parsed = toDate(item.timestamp || item.time)
      return parsed ? parsed.toISOString().slice(0, 10) === dayKey : false
    }).length
    const alertCount = alerts.filter((item) => {
      const parsed = toDate(item.timestamp || item.time)
      return parsed ? parsed.toISOString().slice(0, 10) === dayKey : false
    }).length

    return {
      day,
      label: formatDayLabel(day, locale),
      caption: formatDateLabel(day, locale),
      incidents: incidentCount,
      alerts: alertCount,
    }
  })
}

function buildHotspots(incidents: Incident[]): HotspotRow[] {
  const map = incidents.reduce((acc: Record<string, HotspotRow>, incident) => {
    const location = incident.location?.trim() || 'Unknown location'
    const key = normalizeLocation(location)
    if (!acc[key]) {
      acc[key] = {
        location,
        count: 0,
        share: 0,
        incidents: [],
      }
    }
    acc[key].count += 1
    acc[key].incidents.push(incident)
    return acc
  }, {})

  const rows = Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10)
  const total = incidents.length || 1

  return rows.map((row) => ({
    ...row,
    share: Math.round((row.count / total) * 100),
    incidents: row.incidents
      .slice()
      .sort((a, b) => {
        const aRank = ['critical', 'high', 'medium', 'low'].indexOf(String(a.severity))
        const bRank = ['critical', 'high', 'medium', 'low'].indexOf(String(b.severity))
        if (aRank !== bRank) return aRank - bRank
        const aDate = toDate(a.timestamp || a.time)?.getTime() || 0
        const bDate = toDate(b.timestamp || b.time)?.getTime() || 0
        return bDate - aDate
      }),
  }))
}

function formatIncidentTime(time: string | undefined, locale: string): string {
  if (!time) return ''
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return time
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
}

export default function NationalKpiDashboard({ incidents, alerts }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const { locale } = useThemeMode()
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null)

  const series = useMemo(() => buildSeries(incidents, alerts, locale), [incidents, alerts, locale])
  const hotspots = useMemo(() => buildHotspots(incidents), [incidents])

  const severityRows: SeverityRow[] = useMemo(() => {
    const counts = incidents.reduce(
      (acc: Record<string, number>, item) => {
        const key = String(item.severity || 'low').toLowerCase()
        acc[key] = (acc[key] || 0) + 1
        return acc
      },
      {}
    )

    return [
      { label: t('dashboard.critical'), key: 'critical', count: counts.critical || 0, color: theme.palette.error.main },
      { label: t('dashboard.high'), key: 'high', count: counts.high || 0, color: theme.palette.warning.main },
      { label: t('dashboard.medium'), key: 'medium', count: counts.medium || 0, color: theme.palette.info.main },
      { label: t('dashboard.low'), key: 'low', count: counts.low || 0, color: theme.palette.success.main },
    ]
  }, [incidents, t, theme.palette.error.main, theme.palette.info.main, theme.palette.success.main, theme.palette.warning.main])

  const totalIncidents = incidents.length
  const totalAlerts = alerts.length
  const openIncidents = incidents.filter((incident) => String(incident.status || '').toLowerCase() !== 'resolved').length
  const criticalIncidents = incidents.filter((incident) => String(incident.severity || '').toLowerCase() === 'critical').length
  const highIncidents = incidents.filter((incident) => String(incident.severity || '').toLowerCase() === 'high').length
  const avgIncidentsPerDay = (totalIncidents / 7).toFixed(1)
  const totalSeverity = severityRows.reduce((sum, row) => sum + row.count, 0)
  const peakDay = series.reduce(
    (best, current) => {
      const currentTotal = current.incidents + current.alerts
      const bestTotal = best.incidents + best.alerts
      return currentTotal > bestTotal ? current : best
    },
    series[0]
  )
  const activeHotspot = hotspots.find((item) => item.location === selectedHotspot) || hotspots[0] || null
  const maxValue = Math.max(...series.map((item) => item.incidents + item.alerts), 1)

  const donutGradient =
    totalSeverity === 0
      ? `conic-gradient(${alpha(theme.palette.divider, 0.4)} 0% 100%)`
      : (() => {
          let cursor = 0
          const segments = severityRows
            .filter((row) => row.count > 0)
            .map((row) => {
              const start = cursor
              cursor += (row.count / totalSeverity) * 100
              return `${row.color} ${start}% ${cursor}%`
            })
          return `conic-gradient(${segments.join(', ')})`
        })()

  const summaryCards = [
    {
      label: t('dashboard.incidents'),
      value: totalIncidents,
      hint: peakDay ? `${t('dashboard.peak_day')}: ${peakDay.label}` : t('dashboard.no_incident_data'),
      icon: <TimelineRoundedIcon fontSize="small" />,
      tint: alpha(theme.palette.primary.main, 0.08),
      color: theme.palette.primary.main,
    },
    {
      label: t('dashboard.alerts'),
      value: totalAlerts,
      hint: totalAlerts > 0 ? t('dashboard.included_in_timeline') : t('dashboard.no_alert_data'),
      icon: <DonutLargeRoundedIcon fontSize="small" />,
      tint: alpha(theme.palette.warning.main, 0.1),
      color: theme.palette.warning.main,
    },
    {
      label: t('dashboard.hotspots'),
      value: hotspots.length,
      hint: hotspots.length > 0 ? t('dashboard.top_locations_by_volume') : t('dashboard.no_hotspot_data_yet'),
      icon: <PlaceRoundedIcon fontSize="small" />,
      tint: alpha(theme.palette.info.main, 0.1),
      color: theme.palette.info.main,
    },
    {
      label: t('reports.alert_severity_mix'),
      value: totalSeverity,
      hint: totalSeverity > 0 ? t('dashboard.critical_to_low_distribution') : t('dashboard.no_severity_data'),
      icon: <FiberManualRecordRoundedIcon fontSize="small" />,
      tint: alpha(theme.palette.success.main, 0.08),
      color: theme.palette.success.main,
    },
  ]

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 850, letterSpacing: -0.4 }}>
            {t('dashboard.national_kpi_dashboard')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.clear_view_of_accident_volume_severity_and_recurring_risk_locations')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            icon={<TimelineRoundedIcon />}
            label={`${totalIncidents} ${t('dashboard.incidents')}`}
            variant="outlined"
            sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}
          />
          <Chip
            icon={<DonutLargeRoundedIcon />}
            label={`${totalAlerts} ${t('dashboard.alerts')}`}
            variant="outlined"
            sx={{ bgcolor: alpha(theme.palette.warning.main, 0.05) }}
          />
          <Chip
            icon={<PlaceRoundedIcon />}
            label={`${hotspots.length} ${t('dashboard.hotspots')}`}
            variant="outlined"
            sx={{ bgcolor: alpha(theme.palette.info.main, 0.05) }}
          />
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {summaryCards.map((item) => (
          <Paper
            key={item.label}
            variant="outlined"
            sx={{
              p: 2.25,
              borderRadius: 3,
              borderColor: alpha(theme.palette.divider, 0.7),
              bgcolor: alpha(theme.palette.background.paper, 0.96),
            }}
          >
            <Stack spacing={1.25}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: item.tint,
                  color: item.color,
                }}
              >
                {item.icon}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -0.5, lineHeight: 1.05 }}>
                  {item.value}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                {item.hint}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.3fr) minmax(360px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Paper
          sx={{
            p: { xs: 2, md: 2.25 },
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.96),
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{t('dashboard.seven_day_trend')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.incidents_and_alerts_by_day')}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={t('dashboard.incidents')} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }} />
                <Chip size="small" label={t('dashboard.alerts')} sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12) }} />
              </Stack>
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                borderColor: alpha(theme.palette.divider, 0.68),
                bgcolor: alpha(theme.palette.action.active, 0.02),
              }}
            >
              <Box
                sx={{
                  height: 360,
                  position: 'relative',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                  border: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                  bgcolor: alpha(theme.palette.background.paper, 0.85),
                  px: 1.5,
                  pt: 2.25,
                  pb: 1.5,
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `linear-gradient(to top, ${alpha(theme.palette.divider, 0.52)} 1px, transparent 1px)`,
                    backgroundSize: '100% 20%',
                    pointerEvents: 'none',
                    opacity: 0.5,
                  }}
                />
                <Box
                  sx={{
                    position: 'relative',
                    height: '100%',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
                    alignItems: 'end',
                    gap: 1.25,
                  }}
                >
                  {series.map((point) => {
                    const total = point.incidents + point.alerts
                    const incidentsHeight = total ? clamp((point.incidents / maxValue) * 100, 10, 100) : 10
                    const alertsHeight = total ? clamp((point.alerts / maxValue) * 100, 10, 100) : 10

                    return (
                      <Box
                        key={point.day.toISOString()}
                        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, height: '100%' }}
                      >
                        <Box
                          sx={{
                            flex: 1,
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'end',
                            gap: 1,
                            minHeight: 250,
                            pb: 0.5,
                          }}
                        >
                          <Box
                            title={`${point.label}: ${point.incidents} incidents`}
                            sx={{
                              width: 16,
                              height: `${incidentsHeight}%`,
                              minHeight: 14,
                              borderRadius: 999,
                              bgcolor: theme.palette.primary.main,
                              boxShadow: `0 8px 18px ${alpha(theme.palette.primary.main, 0.2)}`,
                            }}
                          />
                          <Box
                            title={`${point.label}: ${point.alerts} alerts`}
                            sx={{
                              width: 16,
                              height: `${alertsHeight}%`,
                              minHeight: 14,
                              borderRadius: 999,
                              bgcolor: theme.palette.warning.main,
                              boxShadow: `0 8px 18px ${alpha(theme.palette.warning.main, 0.2)}`,
                            }}
                          />
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>
                            {point.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {point.incidents + point.alerts}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>

              <Stack direction="row" spacing={1} sx={{ mt: 1.75, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${t('dashboard.peak_day')}: ${peakDay?.label || 'N/A'}`} />
                <Chip size="small" label={`${t('dashboard.incidents')}: ${totalIncidents}`} />
                <Chip size="small" label={`${t('dashboard.alerts')}: ${totalAlerts}`} />
              </Stack>

              <Box
                sx={{
                  mt: 1.5,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1,
                }}
              >
                {[
                  {
                    label: t('dashboard.busiest_day'),
                    value: peakDay?.label || 'N/A',
                    hint: peakDay ? t('dashboard.total_events', { n: peakDay.incidents + peakDay.alerts }) : t('dashboard.no_events'),
                  },
                  {
                    label: t('dashboard.average_per_day'),
                    value: avgIncidentsPerDay,
                    hint: t('dashboard.based_on_the_last_7_days'),
                  },
                  {
                    label: t('dashboard.open_incidents'),
                    value: openIncidents,
                    hint: t('dashboard.still_unresolved_now'),
                  },
                ].map((item) => (
                  <Box
                    key={item.label}
                    sx={{
                      p: 1.25,
                      borderRadius: 2.25,
                      bgcolor: alpha(theme.palette.background.paper, 0.7),
                      border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.35 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                      {item.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>
                      {item.hint}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Stack>
        </Paper>

        <Stack spacing={2.25}>
          <Paper
            variant="outlined"
            sx={{
              p: 2.25,
              borderRadius: 3,
              borderColor: alpha(theme.palette.divider, 0.7),
              bgcolor: alpha(theme.palette.background.paper, 0.96),
            }}
          >
            <Stack spacing={1.75}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{t('dashboard.severity_distribution')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.mix_of_accident_severities_in_the_current_dataset')}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 2.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.success.main, 0.08),
                    color: 'success.main',
                  }}
                >
                  <DonutLargeRoundedIcon fontSize="small" />
                </Box>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 154,
                    height: 154,
                    mx: 'auto',
                    borderRadius: '50%',
                    background: donutGradient,
                    position: 'relative',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                  }}
                >
                  <Box
                    sx={{
                      width: 90,
                      height: 90,
                      borderRadius: '50%',
                      bgcolor: 'background.paper',
                      display: 'grid',
                      placeItems: 'center',
                      textAlign: 'center',
                      boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.divider, 0.6)}`,
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 850, lineHeight: 1 }}>
                      {totalSeverity}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('dashboard.total')}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gap: 1 }}>
                  {severityRows.map((row) => (
                    <Stack key={row.key} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FiberManualRecordRoundedIcon sx={{ color: row.color, fontSize: 12 }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.label}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                        {row.count}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              </Box>
            </Stack>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              borderColor: alpha(theme.palette.divider, 0.68),
              bgcolor: alpha(theme.palette.background.paper, 0.9),
            }}
          >
            <Stack spacing={1.5}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{t('dashboard.operational_pulse')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.a_quick_read_on_the_current_week_before_drilling_into_the_records')}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.25,
                }}
              >
                {[
                  {
                    label: t('dashboard.open_incidents'),
                    value: openIncidents,
                    hint: t('dashboard.still_unresolved_now'),
                    color: theme.palette.error.main,
                  },
                  {
                    label: t('dashboard.critical_cases'),
                    value: criticalIncidents,
                    hint: t('dashboard.highest_urgency'),
                    color: theme.palette.warning.main,
                  },
                  {
                    label: t('dashboard.high_severity'),
                    value: highIncidents,
                    hint: t('dashboard.below_critical'),
                    color: theme.palette.info.main,
                  },
                  {
                    label: t('dashboard.average_per_day'),
                    value: avgIncidentsPerDay,
                    hint: t('dashboard.based_on_the_last_7_days'),
                    color: theme.palette.success.main,
                  },
                ].map((item) => (
                  <Box
                    key={item.label}
                    sx={{
                      p: 1.5,
                      borderRadius: 2.25,
                      bgcolor: alpha(item.color, 0.06),
                      border: `1px solid ${alpha(item.color, 0.14)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.4 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 850, letterSpacing: -0.3, lineHeight: 1 }}>
                      {item.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.35 }}>
                      {item.hint}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                  pt: 0.5,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {activeHotspot ? `${t('dashboard.most_active_location')}: ${activeHotspot.location}` : t('dashboard.no_hotspot_selected_yet')}
                </Typography>
                <Chip size="small" label={`${t('dashboard.peak_day')}: ${peakDay?.label || 'N/A'}`} />
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: 2.25,
          borderRadius: 3,
          borderColor: alpha(theme.palette.divider, 0.7),
          bgcolor: alpha(theme.palette.background.paper, 0.96),
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} sx={{ mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 800 }}>{t('dashboard.top_10_black_spot_locations')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.select_a_location_to_inspect_its_linked_incidents')}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: 'primary.main',
            }}
          >
            <PlaceRoundedIcon fontSize="small" />
          </Box>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.05fr) minmax(360px, 0.95fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <List disablePadding sx={{ maxHeight: 360, overflow: 'auto', paddingInlineEnd: 4 }}>
            {hotspots.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.no_hotspot_data_yet')}
                </Typography>
              </Box>
            ) : (
              hotspots.map((row, index) => (
                <ListItem
                  key={`${row.location}-${index}`}
                  onClick={() => setSelectedHotspot(row.location)}
                  sx={{
                    px: 1.25,
                    py: 1,
                    mb: 0.75,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    border: `1px solid ${
                      selectedHotspot === row.location ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.divider, 0.55)
                    }`,
                    bgcolor: selectedHotspot === row.location ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.045) },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        color: 'primary.main',
                        width: 34,
                        height: 34,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={row.location}>
                          {row.location}
                        </Typography>
                        <Chip size="small" label={`${row.count}`} />
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.share_of_incidents', { share: row.share })}
                      </Typography>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>

          <Box sx={{ p: 1.75, borderRadius: 2.5, bgcolor: alpha(theme.palette.action.active, 0.03) }}>
            {activeHotspot ? (
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.25}>
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>{activeHotspot.location}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('dashboard.incidents_linked', { count: activeHotspot.count })}
                    </Typography>
                  </Box>
                  <Button component={RouterLink} to="/incidents" size="small" endIcon={<ArrowForwardRoundedIcon />}>
                    {t('dashboard.open_incidents_link')}
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip size="small" label={t('dashboard.share_label', { share: activeHotspot.share })} />
                  <Chip size="small" label={t('dashboard.severity_mix_label')} />
                </Stack>

                <List disablePadding sx={{ maxHeight: 290, overflow: 'auto' }}>
                  {activeHotspot.incidents.slice(0, 5).map((incident) => (
                    <ListItem key={incident.id} sx={{ px: 0, py: 0.75 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.text.secondary, 0.08), width: 30, height: 30 }}>
                          <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: theme.palette.text.secondary }} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                              {formatIncidentTime(incident.time, locale)}
                            </Typography>
                            <Chip size="small" label={t(`dashboard.${String(incident.severity).toLowerCase()}` as any) || String(incident.severity)} variant="outlined" />
                          </Stack>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.incident_detail', { status: incident.status, injuries: incident.injuries, vehicles: incident.vehicles })}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Stack>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.select_hotspot_hint')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Paper>
    </Stack>
  )
}
