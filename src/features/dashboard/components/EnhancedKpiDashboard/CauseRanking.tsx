import { useMemo } from 'react'
import { Box, Paper, Stack, Typography, alpha, useTheme } from '@mui/material'
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

export interface CauseRow {
  cause: string
  count: number
  share: number
}

export function buildCauseRows(incidents: Incident[]): CauseRow[] {
  if (incidents.length === 0) return []
  const counts: Record<string, number> = {}
  for (const inc of incidents) {
    const key = inc.cause ?? 'OTHER'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const total = incidents.length
  return Object.entries(counts)
    .map(([cause, count]) => ({ cause, count, share: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export default function CauseRanking({ incidents }: { incidents: Incident[] }) {
  const theme = useTheme()
  const { t } = useTranslation()

  const rows     = useMemo(() => buildCauseRows(incidents), [incidents])
  const hasData  = useMemo(() => incidents.some((i) => i.cause !== undefined), [incidents])
  const maxCount = useMemo(() => Math.max(...rows.map((r) => r.count), 1), [rows])

  const PALETTE = [
    theme.palette.error.main,
    theme.palette.warning.main,
    '#F59E0B',
    theme.palette.info.main,
    theme.palette.success.main,
    '#7C3AED',
    '#0891B2',
    '#DB2777',
  ]

  const label = (code: string) => {
    try {
      const key = `accident.cause.${code}` as any
      const result = t(key)
      return result && result !== key ? result : code
    } catch {
      return code
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: alpha(theme.palette.divider, 0.7),
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5, py: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.06)} 0%, transparent 60%)`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ p: 0.875, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.main', display: 'flex' }}>
            <BarChartRoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{t('dashboard.cause_ranking')}</Typography>
            <Typography variant="caption" color="text.secondary">{t('dashboard.cause_ranking_subtitle')}</Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ p: 2.25 }}>
        {!hasData || rows.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('dashboard.no_cause_data')}</Typography>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            {rows.map((row, idx) => {
              const color = PALETTE[idx] ?? theme.palette.primary.main
              const barPct = (row.count / maxCount) * 100
              return (
                <Box key={row.cause} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {/* Rank badge */}
                  <Box
                    sx={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      bgcolor: idx < 3 ? alpha(color, 0.15) : alpha(theme.palette.divider, 0.35),
                      border: `1.5px solid ${alpha(color, idx < 3 ? 0.4 : 0.12)}`,
                    }}
                  >
                    <Typography sx={{ fontSize: 9, fontWeight: 900, color: idx < 3 ? color : 'text.disabled', lineHeight: 1 }}>
                      {idx + 1}
                    </Typography>
                  </Box>

                  {/* Label + bar */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
                        {label(row.cause)}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, ml: 0.75, fontSize: 10 }}>
                        {row.share}%
                      </Typography>
                    </Stack>
                    <Box sx={{ height: 9, borderRadius: 999, bgcolor: alpha(color, 0.1), overflow: 'hidden' }}>
                      <Box
                        sx={{
                          width: `${barPct}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${alpha(color, 0.7)}, ${color})`,
                          boxShadow: `0 0 6px ${alpha(color, 0.3)}`,
                          transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Count */}
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 900, color: color, width: 22, textAlign: 'right', flexShrink: 0 }}
                  >
                    {row.count}
                  </Typography>
                </Box>
              )
            })}
          </Stack>
        )}
      </Box>
    </Paper>
  )
}
