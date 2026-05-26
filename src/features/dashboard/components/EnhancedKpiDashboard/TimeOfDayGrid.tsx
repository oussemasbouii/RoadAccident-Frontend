import { useMemo } from 'react'
import { Box, Paper, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_TICKS  = [0, 6, 12, 18, 23]
const HOUR_LABELS = ['00', '06', '12', '18', '23']

export function buildMatrix(incidents: Incident[]): number[][] {
  const m: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const inc of incidents) {
    if (!inc.timestamp) continue
    const d = new Date(inc.timestamp)
    if (Number.isNaN(d.getTime())) continue
    const dayIdx = (d.getDay() + 6) % 7  // Sun(0)→Mon=0
    m[dayIdx][d.getHours()] += 1
  }
  return m
}

export default function TimeOfDayGrid({ incidents }: { incidents: Incident[] }) {
  const theme = useTheme()
  const { t } = useTranslation()

  const matrix   = useMemo(() => buildMatrix(incidents), [incidents])
  const maxCount = useMemo(() => Math.max(...matrix.flat(), 1), [matrix])
  const hasData  = useMemo(() => matrix.flat().some((v) => v > 0), [matrix])

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
          <Typography sx={{ fontWeight: 800 }}>{t('dashboard.time_of_day_grid')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('dashboard.time_of_day_subtitle')}</Typography>
        </Box>

        {!hasData ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{t('dashboard.no_time_data')}</Typography>
          </Box>
        ) : (
          <Box>
            {matrix.map((row, dayIdx) => (
              <Box
                key={DAY_LABELS[dayIdx]}
                sx={{ display: 'grid', gridTemplateColumns: '32px repeat(24, 1fr)', gap: '2px', mb: '2px' }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 700, fontSize: 10, alignSelf: 'center', lineHeight: '14px' }}
                >
                  {DAY_LABELS[dayIdx]}
                </Typography>
                {row.map((count, hourIdx) => (
                  <Tooltip
                    key={hourIdx}
                    title={`${DAY_LABELS[dayIdx]} ${String(hourIdx).padStart(2, '0')}:00 — ${count} incident${count !== 1 ? 's' : ''}`}
                    placement="top"
                  >
                    <Box
                      sx={{
                        height: 14,
                        borderRadius: '2px',
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          count === 0 ? 0.05 : Math.max(0.1, count / maxCount)
                        ),
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            ))}

            <Box sx={{ display: 'grid', gridTemplateColumns: '32px repeat(24, 1fr)', gap: '2px', mt: 0.5 }}>
              <Box />
              {Array.from({ length: 24 }, (_, i) => (
                <Typography
                  key={i}
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: 8, textAlign: 'center', lineHeight: 1 }}
                >
                  {HOUR_TICKS.includes(i) ? HOUR_LABELS[HOUR_TICKS.indexOf(i)] : ''}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}
