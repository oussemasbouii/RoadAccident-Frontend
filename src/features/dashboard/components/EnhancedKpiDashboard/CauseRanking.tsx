import { useMemo } from 'react'
import { Box, Paper, Stack, Typography, alpha, useTheme } from '@mui/material'
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
        p: 2.25, borderRadius: 3,
        borderColor: alpha(theme.palette.divider, 0.7),
        bgcolor: alpha(theme.palette.background.paper, 0.96),
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{t('dashboard.cause_ranking')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('dashboard.cause_ranking_subtitle')}</Typography>
        </Box>

        {!hasData || rows.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('dashboard.no_cause_data')}</Typography>
          </Box>
        ) : (
          <Stack spacing={0.75}>
            {rows.map((row, idx) => (
              <Box key={row.cause} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ width: 18, textAlign: 'right', fontWeight: 700, flexShrink: 0 }}
                >
                  {idx + 1}.
                </Typography>
                <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.divider, 0.3), borderRadius: 1, height: 10 }}>
                  <Box
                    sx={{
                      width: `${(row.count / maxCount) * 100}%`,
                      height: '100%',
                      bgcolor: theme.palette.warning.main,
                      borderRadius: 1,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, width: 140, flexShrink: 0 }}
                  noWrap
                >
                  {label(row.cause)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ width: 24, textAlign: 'right', flexShrink: 0 }}
                >
                  {row.count}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}
