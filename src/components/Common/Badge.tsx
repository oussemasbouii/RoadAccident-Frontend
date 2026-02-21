import React from 'react'
import { Chip, alpha } from '@mui/material'

interface BadgeProps {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'critical' | 'high' | 'medium' | 'low' | 'open' | 'in_progress' | 'resolved'
  size?: 'sm' | 'md'
}

export default function Badge({
  label,
  variant = 'default',
  size = 'md',
}: BadgeProps) {
  const variantColor = {
    default: 'secondary',
    success: 'success',
    warning: 'warning',
    danger: 'error',
    info: 'info',
    critical: 'error',
    high: 'error',
    medium: 'warning',
    low: 'success',
    open: 'primary',
    in_progress: 'info',
    resolved: 'success',
  }

  const colorKey = (variantColor[variant] || 'secondary') as string;
  const color = colorKey as any;

  return (
    <Chip
      label={label}
      color={color}
      size={size === 'sm' ? 'small' : 'medium'}
      sx={{ 
        fontWeight: 600, 
        borderRadius: 100, // Pill shape for MD3
        fontSize: size === 'sm' ? 10 : 11,
        height: size === 'sm' ? 20 : 24,
        letterSpacing: 0.2,
        textTransform: 'capitalize',
        bgcolor: (theme) => alpha((theme.palette[colorKey === 'secondary' ? 'secondary' : (colorKey as keyof typeof theme.palette)] as any).main, 0.08),
        color: (theme) => (theme.palette[colorKey === 'secondary' ? 'secondary' : (colorKey as keyof typeof theme.palette)] as any).main,
        border: 'none',
        '& .MuiChip-label': {
          px: 1.25
        }
      }}
    />
  )
}
