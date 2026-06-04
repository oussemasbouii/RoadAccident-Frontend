import { alpha } from '@mui/material'
import type { Theme } from '@mui/material'

export function getMapControlSx(theme: Theme) {
  const isDark = theme.palette.mode === 'dark'
  return {
    '& .maplibregl-ctrl-group': {
      border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: `0 6px 16px ${alpha(theme.palette.common.black, isDark ? 0.34 : 0.12)}`,
    },
    '& .maplibregl-ctrl-group button': {
      width: 36,
      height: 36,
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      transition: 'background-color 120ms ease',
      '&:hover': { backgroundColor: isDark ? '#374151' : '#f8fafc' },
    },
    '& .maplibregl-ctrl-group button + button': {
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
    },
  }
}
