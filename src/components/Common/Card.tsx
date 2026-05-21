import React from 'react'
import { Card as MuiCard, alpha, useTheme } from '@mui/material'
import { motion } from 'framer-motion'
import { spring } from '../../utils/motion'

const MotionCard = motion(MuiCard)

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
  const theme = useTheme()

  return (
    <MotionCard
      onClick={onClick}
      className={className}
      // Only apply press feedback when the card itself is clickable
      whileTap={hoverable ? { scale: 0.99 } : undefined}
      whileHover={
        hoverable
          ? { y: -3, transition: spring.smooth }
          : undefined
      }
      // tap override — faster than the hover spring
      sx={{
        // CSS handles box-shadow and border transitions; framer-motion handles transform
        transition: theme.transitions.create(['box-shadow', 'border-color'], {
          duration: theme.transitions.duration.short,
        }),
        cursor: hoverable ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': hoverable
          ? {
              boxShadow: `0 12px 28px ${alpha(theme.palette.common.black, 0.09)}`,
              borderColor: 'primary.main',
            }
          : undefined,
        ...sx,
      }}
    >
      {children}
    </MotionCard>
  )
}
