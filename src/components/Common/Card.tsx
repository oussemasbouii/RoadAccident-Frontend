import React from 'react'
import { Card as MuiCard } from '@mui/material'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export default function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
}: CardProps) {
  return (
    <MuiCard
      onClick={onClick}
      className={className}
      sx={{
        border: 1,
        borderColor: 'divider',
        transition: 'all 0.2s ease',
        cursor: hoverable ? 'pointer' : 'default',
        '&:hover': hoverable
          ? {
              boxShadow: 6,
              borderColor: 'primary.main',
            }
          : undefined,
      }}
    >
      {children}
    </MuiCard>
  )
}
