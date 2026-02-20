import React from 'react'
import { Button as MuiButton, CircularProgress } from '@mui/material'

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  loading?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  disabled = false,
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

  return (
    <MuiButton
      disabled={disabled || loading}
      variant={variantMap[variant].variant}
      color={variantMap[variant].color as any}
      size={sizeMap[size]}
      sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <CircularProgress size={16} color="inherit" />
          {children}
        </span>
      ) : (
        children
      )}
    </MuiButton>
  )
}
