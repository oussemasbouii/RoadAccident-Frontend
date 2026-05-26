import { RefObject, useState } from 'react'
import {
  Box, Button, Chip, Collapse, Paper, Stack, TextField, Typography, alpha, useTheme,
} from '@mui/material'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import html2canvas from 'html2canvas'
import type { KpiFiltersResult, Preset } from './useKpiFilters'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { useTranslation } from '../../../../themeMode'

interface Props {
  filters: KpiFiltersResult
  exportRef: RefObject<HTMLDivElement>
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Today',   value: 'today' },
  { label: '7 days',  value: '7d'    },
  { label: '30 days', value: '30d'   },
  { label: '90 days', value: '90d'   },
  { label: '1 year',  value: '1y'    },
]

const SEVERITIES: { label: string; value: Incident['severity']; color: string }[] = [
  { label: 'Critical', value: 'critical', color: '#B91C1C' },
  { label: 'High',     value: 'high',     color: '#EA580C' },
  { label: 'Medium',   value: 'medium',   color: '#0284C7' },
  { label: 'Low',      value: 'low',      color: '#16A34A' },
]

const STATUSES: { label: string; value: Incident['status'] }[] = [
  { label: 'Active',    value: 'active'    },
  { label: 'Responded', value: 'responded' },
  { label: 'Resolved',  value: 'resolved'  },
]

export default function KpiFilterBar({ filters, exportRef }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!exportRef.current || exporting) return
    setExporting(true)
    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: theme.palette.background.default,
        useCORS: true,
        scale: 2,
      })
      const link = document.createElement('a')
      link.download = `kpi-snapshot-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2, borderRadius: 3,
        borderColor: alpha(theme.palette.divider, 0.7),
        bgcolor: alpha(theme.palette.background.paper, 0.96),
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 48 }}>
            {t('dashboard.filter_period')}
          </Typography>
          {PRESETS.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              size="small"
              onClick={() => filters.setPreset(p.value)}
              variant={filters.preset === p.value ? 'filled' : 'outlined'}
              color={filters.preset === p.value ? 'primary' : 'default'}
              sx={{ fontWeight: 600 }}
            />
          ))}
          <Chip
            label={t('dashboard.filter_custom')}
            size="small"
            onClick={() => filters.setPreset('custom')}
            variant={filters.preset === 'custom' ? 'filled' : 'outlined'}
            color={filters.preset === 'custom' ? 'primary' : 'default'}
            sx={{ fontWeight: 600 }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<CameraAltRoundedIcon />}
            onClick={handleExport}
            disabled={exporting}
            sx={{ borderRadius: 6, whiteSpace: 'nowrap' }}
          >
            {t('dashboard.export_png')}
          </Button>
        </Stack>

        <Collapse in={filters.preset === 'custom'}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <TextField
              label={t('dashboard.filter_from')}
              type="date"
              size="small"
              value={filters.customFrom}
              onChange={(e) => filters.setCustomFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'From' } }}
              sx={{ width: 160 }}
            />
            <TextField
              label={t('dashboard.filter_to')}
              type="date"
              size="small"
              value={filters.customTo}
              onChange={(e) => filters.setCustomTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'To' } }}
              sx={{ width: 160 }}
            />
          </Stack>
        </Collapse>

        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 48 }}>
            {t('dashboard.filter_severity')}
          </Typography>
          {SEVERITIES.map((s) => {
            const selected = filters.severities.includes(s.value)
            return (
              <Chip
                key={s.value}
                label={s.label}
                size="small"
                onClick={() => filters.toggleSeverity(s.value)}
                variant={selected ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 600,
                  ...(selected && { bgcolor: alpha(s.color, 0.15), borderColor: s.color, color: s.color }),
                }}
              />
            )
          })}
          <Box sx={{ width: 12 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            {t('dashboard.filter_status')}
          </Typography>
          {STATUSES.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              size="small"
              onClick={() => filters.toggleStatus(s.value)}
              variant={filters.statuses.includes(s.value) ? 'filled' : 'outlined'}
              color={filters.statuses.includes(s.value) ? 'primary' : 'default'}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}
