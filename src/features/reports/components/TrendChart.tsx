import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Box, Typography, alpha, useTheme } from '@mui/material'
import {
  format, startOfDay, startOfWeek, startOfMonth,
  addDays, addWeeks, addMonths, isWithinInterval,
} from 'date-fns'
import type { Incident } from '../../incidents/slices/incidentsSlice'

type Period = 'day' | 'week' | 'month'

interface Props {
  incidents: Incident[]
  period: Period
}

function getBuckets(period: Period): { start: Date; label: string }[] {
  const now = new Date()
  if (period === 'day') {
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(startOfDay(now), -(13 - i))
      return { start: d, label: format(d, 'MMM d') }
    })
  }
  if (period === 'week') {
    return Array.from({ length: 8 }, (_, i) => {
      const d = addWeeks(startOfWeek(now), -(7 - i))
      return { start: d, label: format(d, 'MMM d') }
    })
  }
  return Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(startOfMonth(now), -(5 - i))
    return { start: d, label: format(d, 'MMM yyyy') }
  })
}

function countInBucket(
  incidents: Incident[],
  start: Date,
  end: Date,
  key: 'total' | 'critical' | 'resolved'
): number {
  return incidents.filter((inc) => {
    const d = inc.timestamp ? new Date(inc.timestamp) : new Date(inc.time)
    if (Number.isNaN(d.getTime())) return false
    if (!isWithinInterval(d, { start, end })) return false
    if (key === 'total') return true
    if (key === 'critical') return inc.severity === 'critical'
    return inc.status === 'resolved'
  }).length
}

export default function TrendChart({ incidents, period }: Props) {
  const theme = useTheme()
  const buckets = getBuckets(period)

  const data = useMemo(() => {
    return buckets.map((bucket, idx) => {
      const nextBucket = buckets[idx + 1]
      const end = nextBucket ? new Date(nextBucket.start.getTime() - 1) : new Date()
      return {
        label: bucket.label,
        total: countInBucket(incidents, bucket.start, end, 'total'),
        critical: countInBucket(incidents, bucket.start, end, 'critical'),
        resolved: countInBucket(incidents, bucket.start, end, 'resolved'),
      }
    })
  }, [incidents, period])

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Incident Trend
      </Typography>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} />
          <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.paper,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="total" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} name="Total" />
          <Line type="monotone" dataKey="critical" stroke={theme.palette.error.main} strokeWidth={2} dot={false} name="Critical" />
          <Line type="monotone" dataKey="resolved" stroke={theme.palette.success.main} strokeWidth={2} dot={false} name="Resolved" />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}
