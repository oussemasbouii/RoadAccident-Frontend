import React from 'react'
import { Chip } from '@mui/material'

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
    default: 'default',
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

  return (
    <Chip
      label={label}
      color={variantColor[variant] as any}
      size={size === 'sm' ? 'small' : 'medium'}
      sx={{ fontWeight: 600 }}
    />
  )
}
