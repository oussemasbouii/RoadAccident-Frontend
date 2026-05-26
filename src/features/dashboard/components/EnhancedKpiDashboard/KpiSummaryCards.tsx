import { useMemo } from 'react'
import { Box, Paper, Stack, Typography, alpha, useTheme } from '@mui/material'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

interface Props {
  filtered: Incident[]
  prev: Incident[]
}

interface DeltaProps {
  current: number
  previous: number
  'data-testid'?: string
}

function DeltaBadge({ current, previous, 'data-testid': testId }: DeltaProps) {
  const theme = useTheme()
  const pct = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100)
  if (pct === 0) {
    return (
      <Typography variant="caption" data-testid={testId} sx={{ color: 'text.disabled', fontWeight: 700 }}>
        → 0%
      </Typography>
    )
  }
  return (
    <Typography
      variant="caption"
      data-testid={testId}
      sx={{ fontWeight: 700, color: pct > 0 ? theme.palette.warning.main : theme.palette.success.main }}
    >
      {pct > 0 ? `↑ +${pct}%` : `↓ ${pct}%`}
    </Typography>
  )
}

export default function KpiSummaryCards({ filtered, prev }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()

  const cards = useMemo(() => {
    const curOpen      = filtered.filter((i) => i.status !== 'resolved').length
    const prevOpen     = prev.filter((i) => i.status !== 'resolved').length
    const curInjuries  = filtered.reduce((s, i) => s + i.injuries, 0)
    const prevInjuries = prev.reduce((s, i) => s + i.injuries, 0)
    const curCritical  = filtered.filter((i) => i.severity === 'critical').length
    const prevCritical = prev.filter((i) => i.severity === 'critical').length

    return [
      {
        label: t('dashboard.incidents'),
        value: filtered.length, prevValue: prev.length,
        icon: <TimelineRoundedIcon fontSize="small" />,
        tint: alpha(theme.palette.primary.main, 0.08),
        color: theme.palette.primary.main,
        testId: 'delta-total',
      },
      {
        label: t('dashboard.open_incidents'),
        value: curOpen, prevValue: prevOpen,
        icon: <WarningRoundedIcon fontSize="small" />,
        tint: alpha(theme.palette.error.main, 0.08),
        color: theme.palette.error.main,
        testId: 'delta-open',
      },
      {
        label: t('dashboard.injuries'),
        value: curInjuries, prevValue: prevInjuries,
        icon: <LocalHospitalRoundedIcon fontSize="small" />,
        tint: alpha(theme.palette.warning.main, 0.08),
        color: theme.palette.warning.main,
        testId: 'delta-injuries',
      },
      {
        label: t('dashboard.critical_cases'),
        value: curCritical, prevValue: prevCritical,
        icon: <ErrorRoundedIcon fontSize="small" />,
        tint: alpha(theme.palette.error.main, 0.06),
        color: theme.palette.error.main,
        testId: 'delta-critical',
      },
    ]
  }, [filtered, prev, t, theme.palette])

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
      {cards.map((c) => (
        <Paper
          key={c.label}
          role="article"
          variant="outlined"
          sx={{
            p: 2, borderRadius: 3,
            borderColor: alpha(theme.palette.divider, 0.7),
            bgcolor: alpha(theme.palette.background.paper, 0.96),
          }}
        >
          <Stack spacing={1}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: c.tint, color: c.color }}>
              {c.icon}
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{c.label}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -0.5, lineHeight: 1.05 }}>{c.value}</Typography>
            </Box>
            <DeltaBadge current={c.value} previous={c.prevValue} data-testid={c.testId} />
          </Stack>
        </Paper>
      ))}
    </Box>
  )
}
