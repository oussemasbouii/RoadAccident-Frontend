import { useMemo, useState } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Box, Typography, alpha, useTheme } from '@mui/material'
import {
  format, startOfDay, endOfDay, startOfWeek, startOfMonth,
  addDays, addWeeks, addMonths, isWithinInterval,
  differenceInCalendarDays, differenceInCalendarWeeks, differenceInCalendarMonths,
} from 'date-fns'
import type { Incident } from '../../incidents/slices/incidentsSlice'

type Period = 'day' | 'week' | 'month'
type SeriesKey = 'total' | 'critical' | 'resolved'

interface Props {
  incidents: Incident[]
  period: Period
  /** Selected filter range (yyyy-MM-dd). When provided, the x-axis spans exactly this
   *  range so the chart matches the filtered data instead of a fixed rolling window. */
  from?: string
  to?: string
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

function safeDate(value?: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// Buckets span the selected range (from → to) at the chosen granularity. Falls back to a
// rolling window when no range is given. Counts are bounded to keep the axis readable.
function getBuckets(period: Period, from?: string, to?: string): { start: Date; label: string }[] {
  const toDate = safeDate(to) ?? new Date()
  const fromDate = safeDate(from)

  if (period === 'day') {
    const start = startOfDay(fromDate ?? addDays(startOfDay(toDate), -13))
    const count = clamp(differenceInCalendarDays(toDate, start) + 1, 1, 120)
    return Array.from({ length: count }, (_, i) => {
      const d = addDays(start, i)
      return { start: d, label: format(d, 'MMM d') }
    })
  }
  if (period === 'week') {
    const start = startOfWeek(fromDate ?? addWeeks(startOfWeek(toDate), -7))
    const count = clamp(differenceInCalendarWeeks(toDate, start) + 1, 1, 60)
    return Array.from({ length: count }, (_, i) => {
      const d = addWeeks(start, i)
      return { start: d, label: format(d, 'MMM d') }
    })
  }
  const start = startOfMonth(fromDate ?? addMonths(startOfMonth(toDate), -5))
  const count = clamp(differenceInCalendarMonths(toDate, start) + 1, 1, 36)
  return Array.from({ length: count }, (_, i) => {
    const d = addMonths(start, i)
    return { start: d, label: format(d, 'MMM yyyy') }
  })
}

function countInBucket(incidents: Incident[], start: Date, end: Date, key: SeriesKey): number {
  return incidents.filter((inc) => {
    const d = inc.timestamp ? new Date(inc.timestamp) : new Date(inc.time)
    if (Number.isNaN(d.getTime())) return false
    if (!isWithinInterval(d, { start, end })) return false
    if (key === 'total') return true
    if (key === 'critical') return inc.severity === 'critical'
    return inc.status === 'resolved'
  }).length
}

export default function TrendChart({ incidents, period, from, to }: Props) {
  const theme = useTheme()
  const [hidden, setHidden] = useState<Record<SeriesKey, boolean>>({
    total: false, critical: false, resolved: false,
  })

  const buckets = useMemo(() => getBuckets(period, from, to), [period, from, to])
  const rangeEnd = useMemo(() => {
    const t = safeDate(to)
    return t ? endOfDay(t) : new Date()
  }, [to])

  const data = useMemo(() => {
    return buckets.map((bucket, idx) => {
      const nextBucket = buckets[idx + 1]
      const end = nextBucket ? new Date(nextBucket.start.getTime() - 1) : rangeEnd
      return {
        label: bucket.label,
        total: countInBucket(incidents, bucket.start, end, 'total'),
        critical: countInBucket(incidents, bucket.start, end, 'critical'),
        resolved: countInBucket(incidents, bucket.start, end, 'resolved'),
      }
    })
  }, [incidents, buckets, rangeEnd])

  const hasData = incidents.length > 0 && data.some((d) => d.total > 0)

  const toggle = (key?: string | number) => {
    if (key !== 'total' && key !== 'critical' && key !== 'resolved') return
    setHidden((p) => ({ ...p, [key]: !p[key as SeriesKey] }))
  }

  if (!hasData) {
    return (
      <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No incidents in the selected range.
        </Typography>
      </Box>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} minTickGap={16} />
        <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${theme.palette.divider}`,
            background: theme.palette.background.paper,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
          onClick={(o) => toggle(o.dataKey as string)}
        />
        {/* Total drawn as a filled area so it reads as the envelope; Critical/Resolved
            are subsets shown as lines on top. Click a legend item to show/hide it. */}
        <Area
          type="monotone" dataKey="total" name="Total"
          stroke={theme.palette.primary.main} strokeWidth={2}
          fill={alpha(theme.palette.primary.main, 0.12)}
          activeDot={{ r: 4 }} hide={hidden.total}
        />
        <Line
          type="monotone" dataKey="critical" name="Critical"
          stroke={theme.palette.error.main} strokeWidth={2}
          dot={{ r: 2 }} activeDot={{ r: 4 }} hide={hidden.critical}
        />
        <Line
          type="monotone" dataKey="resolved" name="Resolved"
          stroke={theme.palette.success.main} strokeWidth={2}
          dot={{ r: 2 }} activeDot={{ r: 4 }} hide={hidden.resolved}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
