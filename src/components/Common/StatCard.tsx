import React from 'react'
import { Box, Card, Typography } from '@mui/material'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  intent?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

export default function StatCard({
  icon,
  label,
  value,
  trend,
  trendValue,
  intent = 'default',
}: StatCardProps) {
  const trendColor = {
    up: 'success.main',
    down: 'error.main',
    neutral: 'text.secondary',
  }

  const intentBg: Record<NonNullable<StatCardProps['intent']>, string> = {
    default: 'primary.main',
    success: 'success.main',
    warning: 'warning.main',
    danger: 'error.main',
    info: 'info.main',
  }

  return (
    <Card sx={{ p: 3, border: 1, borderColor: 'divider', transition: 'all .2s ease', '&:hover': { boxShadow: 5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: intentBg[intent], color: 'common.white', fontSize: 24, lineHeight: 1 }}>
          {icon}
        </Box>
        {trend && trendValue && (
          <Typography variant="body2" sx={{ fontWeight: 700, color: trendColor[trend] }}>
            {trend === 'up' && '↑'} {trend === 'down' && '↓'} {trendValue}
          </Typography>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.8rem' }}>
        {value}
      </Typography>
    </Card>
  )
}
