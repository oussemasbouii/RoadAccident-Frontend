import React from 'react'
import { Button as MuiButton, CircularProgress } from '@mui/material'
import { motion } from 'framer-motion'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  loading?: boolean
  icon?: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  disabled = false,
  icon,
  ...props
}: ButtonProps) {
  const variantMap = {
    primary: { variant: 'contained' as const, color: 'primary' as const },
    secondary: { variant: 'outlined' as const, color: 'inherit' as const },
    danger: { variant: 'contained' as const, color: 'error' as const },
    success: { variant: 'contained' as const, color: 'success' as const },
  }

  const sizeMap = {
    sm: 'small' as const,
    md: 'medium' as const,
    lg: 'large' as const,
  }

  // Wrap in motion.span to get tactile press feedback without MUI type conflicts
  return (
    <motion.span
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 600, damping: 40 }}
      style={{ display: 'inline-flex' }}
    >
      <MuiButton
        disabled={disabled || loading}
        variant={variantMap[variant].variant}
        color={variantMap[variant].color as any}
        size={sizeMap[size]}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : icon}
        sx={{
          borderRadius: 100,
          fontWeight: 700,
          textTransform: 'none',
          px: size === 'sm' ? 2 : 3,
          py: size === 'sm' ? 0.75 : 1.25,
          boxShadow: variant === 'primary' ? '0 4px 12px rgba(103,80,164,0.15)' : 'none',
          transition: 'box-shadow 0.18s ease, background-color 0.18s ease, opacity 0.18s ease',
          '&:hover': {
            boxShadow: variant === 'primary' ? '0 6px 18px rgba(103,80,164,0.28)' : 'none',
          },
        }}
        {...props}
      >
        {children}
      </MuiButton>
    </motion.span>
  )
}
