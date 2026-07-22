import { useState } from 'react'
import { Box, IconButton, Popover, Stack, TextField, Typography, alpha, useTheme } from '@mui/material'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import Button from './Button'
import { useTranslation } from '@/themeMode'

type Props = {
  label: string
  startDate?: string // yyyy-mm-dd
  endDate?: string // yyyy-mm-dd
  onChange: (startDate: string | undefined, endDate: string | undefined) => void
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : undefined)

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type MonthGridProps = {
  month: Date
  rangeStart?: Date
  rangeEnd?: Date
  onDayClick: (day: Date) => void
  onDayHover: (day: Date | undefined) => void
  onNavigate: (direction: -1 | 1) => void
  showPrev: boolean
  showNext: boolean
}

// Renders the range as a background fill on each day cell (rounded only at
// the two ends) rather than the border/pseudo-element tricks most calendar
// libraries use — a plain bgcolor can't "crack" under a CSS reset the way
// border-based shapes can, so this stays visually solid regardless of what
// other global styles are in play.
function MonthGrid({ month, rangeStart, rangeEnd, onDayClick, onDayHover, onNavigate, showPrev, showNext }: MonthGridProps) {
  const theme = useTheme()
  const gridStart = startOfWeek(startOfMonth(month))
  const gridEnd = endOfWeek(endOfMonth(month))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const rangeLow = rangeStart && rangeEnd ? (isBefore(rangeEnd, rangeStart) ? rangeEnd : rangeStart) : undefined
  const rangeHigh = rangeStart && rangeEnd ? (isBefore(rangeEnd, rangeStart) ? rangeStart : rangeEnd) : undefined

  return (
    <Box sx={{ width: 252 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <IconButton size="small" onClick={() => onNavigate(-1)} sx={{ visibility: showPrev ? 'visible' : 'hidden' }}>
          <ChevronLeftRoundedIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{format(month, 'MMMM yyyy')}</Typography>
        <IconButton size="small" onClick={() => onNavigate(1)} sx={{ visibility: showNext ? 'visible' : 'hidden' }}>
          <ChevronRightRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {WEEKDAY_LABELS.map((w) => (
          <Typography key={w} variant="caption" align="center" color="text.secondary" sx={{ py: 0.5 }}>
            {w}
          </Typography>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month)
          const isStart = Boolean(rangeLow && isSameDay(day, rangeLow))
          const isEnd = Boolean(rangeHigh && isSameDay(day, rangeHigh))
          const inRange = Boolean(rangeLow && rangeHigh && isWithinInterval(day, { start: rangeLow, end: rangeHigh }))
          const isFirstCol = day.getDay() === 0
          const isLastCol = day.getDay() === 6
          const capStart = inRange && (isFirstCol || isStart)
          const capEnd = inRange && (isLastCol || isEnd)

          return (
            <Box
              key={day.toISOString()}
              onMouseEnter={() => onDayHover(day)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: inRange && !isStart && !isEnd ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                borderTopLeftRadius: capStart ? 18 : 0,
                borderBottomLeftRadius: capStart ? 18 : 0,
                borderTopRightRadius: capEnd ? 18 : 0,
                borderBottomRightRadius: capEnd ? 18 : 0,
              }}
            >
              <Box
                component="button"
                type="button"
                disabled={!inMonth}
                onClick={() => onDayClick(day)}
                sx={{
                  width: 34,
                  height: 34,
                  m: '2px 0',
                  borderRadius: '50%',
                  border: 'none',
                  outline: 'none',
                  cursor: inMonth ? 'pointer' : 'default',
                  bgcolor: isStart || isEnd ? 'primary.main' : 'transparent',
                  color: isStart || isEnd
                    ? theme.palette.primary.contrastText
                    : inMonth
                      ? theme.palette.text.primary
                      : theme.palette.text.disabled,
                  fontWeight: isStart || isEnd ? 700 : 400,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  '&:hover': inMonth && !isStart && !isEnd ? { bgcolor: alpha(theme.palette.primary.main, 0.2) } : {},
                }}
              >
                {format(day, 'd')}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// A calendar-based range picker (two months, click start then end) rather
// than a text-only dropdown. Built from plain MUI/Emotion primitives instead
// of a third-party calendar stylesheet — this app's Tailwind reset clashed
// with react-date-range's CSS (border/box-sizing resets broke its range
// highlight), so a hand-rolled grid sidesteps that entirely. Auto-closes the
// popover as soon as a full range is picked.
export default function DateRangePickerField({ label, startDate, endDate, onChange }: Props) {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [leftMonth, setLeftMonth] = useState(() => toDate(startDate) ?? new Date())
  const [clickStart, setClickStart] = useState<Date | undefined>(undefined)
  const [hoverDate, setHoverDate] = useState<Date | undefined>(undefined)

  const committedStart = toDate(startDate)
  const committedEnd = toDate(endDate)
  const displayStart = clickStart ?? committedStart
  const displayEnd = clickStart ? hoverDate : committedEnd

  const displayValue =
    startDate && endDate
      ? `${format(committedStart!, 'MMM d, yyyy')} - ${format(committedEnd!, 'MMM d, yyyy')}`
      : t('documents.date_range_all')

  const openPicker = (target: HTMLElement) => {
    setAnchorEl(target)
    setClickStart(undefined)
    setHoverDate(undefined)
    setLeftMonth(committedStart ?? new Date())
  }

  const handleDayClick = (day: Date) => {
    if (!clickStart) {
      setClickStart(day)
      return
    }
    const [start, end] = isBefore(day, clickStart) ? [day, clickStart] : [clickStart, day]
    onChange(toIsoDate(start), toIsoDate(end))
    setClickStart(undefined)
    setHoverDate(undefined)
    setAnchorEl(null) // auto-close once the range is complete
  }

  return (
    <Box>
      <TextField
        size="small"
        label={label}
        value={displayValue}
        onClick={(event) => openPicker(event.currentTarget)}
        slotProps={{
          input: {
            readOnly: true,
            startAdornment: <CalendarMonthRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
          },
        }}
        sx={{ bgcolor: 'background.paper', width: '100%', cursor: 'pointer', '& input': { cursor: 'pointer' } }}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack direction="row" spacing={2} sx={{ p: 2 }}>
          <MonthGrid
            month={leftMonth}
            rangeStart={displayStart}
            rangeEnd={displayEnd}
            onDayClick={handleDayClick}
            onDayHover={setHoverDate}
            onNavigate={(dir) => setLeftMonth((m) => (dir === -1 ? subMonths(m, 1) : addMonths(m, 1)))}
            showPrev
            showNext={false}
          />
          <MonthGrid
            month={addMonths(leftMonth, 1)}
            rangeStart={displayStart}
            rangeEnd={displayEnd}
            onDayClick={handleDayClick}
            onDayHover={setHoverDate}
            onNavigate={(dir) => setLeftMonth((m) => (dir === -1 ? subMonths(m, 1) : addMonths(m, 1)))}
            showPrev={false}
            showNext
          />
        </Stack>
        <Stack direction="row" justifyContent="flex-start" sx={{ px: 2, pb: 2 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onChange(undefined, undefined)
              setClickStart(undefined)
              setAnchorEl(null)
            }}
          >
            {t('documents.clear_filters')}
          </Button>
        </Stack>
      </Popover>
    </Box>
  )
}
