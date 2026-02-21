import React from 'react'
import { Card as MuiCard, alpha, useTheme } from '@mui/material'

interface CardProps {
  children: React.ReactNode
  sx?: any
  onClick?: () => void
  hoverable?: boolean
  className?: string
}

export default function Card({
  children,
  sx = {},
  onClick,
  hoverable = false,
  className,
}: CardProps) {
  const theme = useTheme();
  
  return (
    <MuiCard
      onClick={onClick}
      className={className}
      sx={{
        transition: theme.transitions.create(['box-shadow', 'transform', 'border-color']),
        cursor: hoverable ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': hoverable
          ? {
              transform: 'translateY(-2px)',
              boxShadow: (theme) => `0 12px 24px ${alpha(theme.palette.common.black, 0.08)}`,
              borderColor: 'primary.main',
            }
          : undefined,
        ...sx
      }}
    >
      {children}
    </MuiCard>
  )
}
