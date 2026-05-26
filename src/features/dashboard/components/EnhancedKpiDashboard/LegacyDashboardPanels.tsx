import { useMemo } from 'react'
import {
  alpha, Box, Chip, Divider, Paper, Stack, Typography, useTheme,
} from '@mui/material'
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'
import type { Alert } from '../../../alerts/slices/alertsSlice'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation, useThemeMode } from '../../../../themeMode'

interface Props {
  incidents: Incident[]
  alerts: Alert[]
}

type SeverityRow = {
  label: string
  count: number
  color: string
  key: string
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
      const parsed = toDate((item as any).timestamp || (item as any).time)
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

export default function LegacyDashboardPanels({ incidents, alerts }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const { locale } = useThemeMode()

  const series = useMemo(() => buildSeries(incidents, alerts, locale), [incidents, alerts, locale])

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
      { label: t('dashboard.high'),     key: 'high',     count: counts.high     || 0, color: theme.palette.warning.main },
      { label: t('dashboard.medium'),   key: 'medium',   count: counts.medium   || 0, color: theme.palette.info.main },
      { label: t('dashboard.low'),      key: 'low',      count: counts.low      || 0, color: theme.palette.success.main },
    ]
  }, [incidents, t, theme.palette])

  const totalIncidents    = incidents.length
  const totalAlerts       = alerts.length
  const openIncidents     = incidents.filter((i) => String(i.status || '').toLowerCase() !== 'resolved').length
  const criticalIncidents = incidents.filter((i) => String(i.severity || '').toLowerCase() === 'critical').length
  const highIncidents     = incidents.filter((i) => String(i.severity || '').toLowerCase() === 'high').length
  const avgIncidentsPerDay = (totalIncidents / 7).toFixed(1)
  const totalSeverity     = severityRows.reduce((s, r) => s + r.count, 0)
  const maxValue          = Math.max(...series.map((p) => p.incidents + p.alerts), 1)
  const peakDay           = series.reduce(
    (best, cur) => (cur.incidents + cur.alerts > best.incidents + best.alerts ? cur : best),
    series[0]
  )

  const donutGradient =
    totalSeverity === 0
      ? `conic-gradient(${alpha(theme.palette.divider, 0.4)} 0% 100%)`
      : (() => {
          let cursor = 0
          const segments = severityRows
            .filter((r) => r.count > 0)
            .map((r) => {
              const start = cursor
              cursor += (r.count / totalSeverity) * 100
              return `${r.color} ${start}% ${cursor}%`
            })
          return `conic-gradient(${segments.join(', ')})`
        })()

  return (
    <>
      {/* 7-day trend */}
      <Paper
        sx={{
          p: { xs: 2, md: 2.25 }, borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.96),
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
            <Box>
              <Typography sx={{ fontWeight: 800 }}>{t('dashboard.seven_day_trend')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('dashboard.incidents_and_alerts_by_day')}</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={t('dashboard.incidents')} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }} />
              <Chip size="small" label={t('dashboard.alerts')}    sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12) }} />
            </Stack>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 2, borderRadius: 3,
              borderColor: alpha(theme.palette.divider, 0.68),
              bgcolor: alpha(theme.palette.action.active, 0.02),
            }}
          >
            <Box
              sx={{
                height: 360, position: 'relative', borderRadius: 2.5, overflow: 'hidden',
                border: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.85), px: 1.5, pt: 2.25, pb: 1.5,
              }}
            >
              <Box
                sx={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `linear-gradient(to top, ${alpha(theme.palette.divider, 0.52)} 1px, transparent 1px)`,
                  backgroundSize: '100% 20%', pointerEvents: 'none', opacity: 0.5,
                }}
              />
              <Box
                sx={{
                  position: 'relative', height: '100%',
                  display: 'grid', gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
                  alignItems: 'end', gap: 1.25,
                }}
              >
                {series.map((point) => {
                  const total = point.incidents + point.alerts
                  const incH = total ? clamp((point.incidents / maxValue) * 100, 10, 100) : 10
                  const altH = total ? clamp((point.alerts / maxValue) * 100, 10, 100) : 10
                  return (
                    <Box
                      key={point.day.toISOString()}
                      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, height: '100%' }}
                    >
                      <Box sx={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'end', gap: 1, minHeight: 250, pb: 0.5 }}>
                        <Box title={`${point.label}: ${point.incidents} incidents`}
                          sx={{ width: 16, height: `${incH}%`, minHeight: 14, borderRadius: 999, bgcolor: theme.palette.primary.main, boxShadow: `0 8px 18px ${alpha(theme.palette.primary.main, 0.2)}` }}
                        />
                        <Box title={`${point.label}: ${point.alerts} alerts`}
                          sx={{ width: 16, height: `${altH}%`, minHeight: 14, borderRadius: 999, bgcolor: theme.palette.warning.main, boxShadow: `0 8px 18px ${alpha(theme.palette.warning.main, 0.2)}` }}
                        />
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>{point.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{point.incidents + point.alerts}</Typography>
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

            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
              {[
                { label: t('dashboard.busiest_day'), value: peakDay?.label || 'N/A', hint: peakDay ? t('dashboard.total_events', { n: peakDay.incidents + peakDay.alerts }) : t('dashboard.no_events') },
                { label: t('dashboard.average_per_day'), value: avgIncidentsPerDay, hint: t('dashboard.based_on_the_last_7_days') },
                { label: t('dashboard.open_incidents'), value: openIncidents, hint: t('dashboard.still_unresolved_now') },
              ].map((item) => (
                <Box key={item.label} sx={{ p: 1.25, borderRadius: 2.25, bgcolor: alpha(theme.palette.background.paper, 0.7), border: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.35 }}>{item.label}</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.15 }}>{item.value}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>{item.hint}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Stack>
      </Paper>

      {/* Severity donut + operational pulse */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.3fr) minmax(360px, 0.85fr)' }, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.7), bgcolor: alpha(theme.palette.background.paper, 0.96) }}>
          <Stack spacing={1.75}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{t('dashboard.severity_distribution')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('dashboard.mix_of_accident_severities_in_the_current_dataset')}</Typography>
              </Box>
              <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.success.main, 0.08), color: 'success.main' }}>
                <DonutLargeRoundedIcon fontSize="small" />
              </Box>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, gap: 2, alignItems: 'center' }}>
              <Box sx={{ width: 154, height: 154, mx: 'auto', borderRadius: '50%', background: donutGradient, position: 'relative', display: 'grid', placeItems: 'center', boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}` }}>
                <Box sx={{ width: 90, height: 90, borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', textAlign: 'center', boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.divider, 0.6)}` }}>
                  <Typography variant="h5" sx={{ fontWeight: 850, lineHeight: 1 }}>{totalSeverity}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('dashboard.total')}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gap: 1 }}>
                {severityRows.map((row) => (
                  <Stack key={row.key} direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FiberManualRecordRoundedIcon sx={{ color: row.color, fontSize: 12 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.label}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>{row.count}</Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.68), bgcolor: alpha(theme.palette.background.paper, 0.9) }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>{t('dashboard.operational_pulse')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('dashboard.a_quick_read_on_the_current_week_before_drilling_into_the_records')}</Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
              {[
                { label: t('dashboard.open_incidents'),   value: openIncidents,      hint: t('dashboard.still_unresolved_now'),    color: theme.palette.error.main },
                { label: t('dashboard.critical_cases'),   value: criticalIncidents,  hint: t('dashboard.highest_urgency'),         color: theme.palette.warning.main },
                { label: t('dashboard.high_severity'),    value: highIncidents,      hint: t('dashboard.below_critical'),          color: theme.palette.info.main },
                { label: t('dashboard.average_per_day'),  value: avgIncidentsPerDay, hint: t('dashboard.based_on_the_last_7_days'), color: theme.palette.success.main },
              ].map((item) => (
                <Box key={item.label} sx={{ p: 1.5, borderRadius: 2.25, bgcolor: alpha(item.color, 0.06), border: `1px solid ${alpha(item.color, 0.14)}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.4 }}>{item.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 850, letterSpacing: -0.3, lineHeight: 1 }}>{item.value}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.35 }}>{item.hint}</Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ opacity: 0.5 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.peak_day')}: {peakDay?.label || 'N/A'}
              </Typography>
              <Chip size="small" label={`${t('dashboard.total_events', { n: totalIncidents + totalAlerts })}`} />
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </>
  )
}
