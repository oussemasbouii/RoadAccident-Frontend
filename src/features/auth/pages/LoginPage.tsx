import React, { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { 
  Alert, 
  Box, 
  IconButton, 
  InputAdornment, 
  Link, 
  Stack, 
  TextField, 
  Typography,
  useTheme,
  alpha,
  Fade,
  Container
} from '@mui/material'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import TrafficRoundedIcon from '@mui/icons-material/TrafficRounded'
import EmergencyRoundedIcon from '@mui/icons-material/EmergencyRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import { apiService } from '@/services/api'
import { AuthUser } from '../slices/authSlice'
import { setUser, setToken } from '../slices/authSlice'
import { useThemeMode } from '../../../themeMode'
import { clearAuthStorage } from '@/utils/authSecurity'
import { Button, Card } from '@/components/Common'

function mapLoginError(err: any): { message: string; isBlocked?: boolean; isRestricted?: boolean } {
  const status = err?.response?.status
  const payload = err?.response?.data || {}
  const errorType = String(payload?.type || '').toUpperCase()
  const msg = String(payload?.message || err?.message || 'Login failed').toLowerCase()
  
  // Debug: Log the full error response to understand the structure
  if (import.meta.env.DEV) {
    console.log('🔴 Login Error - Full Response:', err?.response)
    console.log('🔴 Login Error - Payload:', payload)
    console.log('🔴 Login Error - Error Type:', errorType)
    console.log('🔴 Login Error - Message:', msg)
  }
  
  // Check for blocked/restricted status in error response - check multiple locations
  const userData = payload?.data?.user || payload?.data?.officer || payload?.user || payload?.officer || {}
  const isValid = userData?.isValid
  const isFrozen = userData?.isFrozen
  const accountStatus = payload?.accountStatus || userData?.status || payload?.data?.accountStatus || payload?.status
  
  // Debug: Log extracted status fields
  if (import.meta.env.DEV) {
    console.log('🔴 Login Error - User Data:', userData)
    console.log('🔴 Login Error - isValid:', isValid)
    console.log('🔴 Login Error - isFrozen:', isFrozen)
    console.log('🔴 Login Error - accountStatus:', accountStatus)
  }

  // Blocked account detection - check all possible indicators
  if (
    isValid === false ||
    accountStatus === 'blocked' ||
    accountStatus === 'BLOCKED' ||
    payload?.isValid === false ||
    payload?.data?.isValid === false ||
    msg.includes('account is blocked') ||
    msg.includes('account blocked') ||
    msg.includes('blocked') ||
    errorType === 'ACCOUNT_BLOCKED' ||
    errorType === 'BLOCKED'
  ) {
    return { 
      message: 'Your account has been blocked. You cannot sign in at this time. Please contact an administrator for assistance.',
      isBlocked: true
    }
  }

  // Restricted account detection - check all possible indicators
  if (
    isFrozen === true ||
    accountStatus === 'restricted' ||
    accountStatus === 'frozen' ||
    accountStatus === 'RESTRICTED' ||
    accountStatus === 'FROZEN' ||
    payload?.isFrozen === true ||
    payload?.data?.isFrozen === true ||
    msg.includes('account is restricted') ||
    msg.includes('account restricted') ||
    msg.includes('temporarily restricted') ||
    msg.includes('restricted') ||
    msg.includes('frozen') ||
    errorType === 'ACCOUNT_RESTRICTED' ||
    errorType === 'RESTRICTED' ||
    errorType === 'FROZEN'
  ) {
    return { 
      message: 'Your account is temporarily restricted. Some features may be limited. Please contact an administrator for assistance.',
      isRestricted: true
    }
  }

  // Check for "user not valid" in the message - indicates blocked/restricted/unvalidated account
  // Note: Backend returns same message for both blocked and restricted accounts
  if (errorType === 'INVALID_CREDENTIALS' && msg.includes('user not valid')) {
    return { 
      message: 'Your account has been blocked, restricted, or is not yet validated. Please contact an administrator for assistance.',
      isBlocked: true
    }
  }

  if (errorType === 'INVALID_CREDENTIALS') {
    return { message: 'Invalid credentials. Please verify your Officer ID and password.' }
  }

  if (errorType === 'UNKNOWN_ERROR' && msg.includes('verifying user password')) {
    return { message: 'Server error during password verification. Please try again later.' }
  }

  if (
    status === 423 ||
    msg.includes('blocked') ||
    msg.includes('suspended') ||
    msg.includes('restricted')
  ) {
    return { message: 'Your account is restricted. Please contact an administrator.' }
  }

  if (status === 401 || status === 403 || msg.includes('invalid') || msg.includes('unauthorized')) {
    return { message: 'Invalid credentials. Please check your officer ID and password.' }
  }

  return { message: payload?.message || err?.message || 'Login failed' }
}

function getDeviceInfo() {
  const ua = navigator.userAgent || ''
  const existingDeviceId = localStorage.getItem('deviceId')
  const deviceId = existingDeviceId || `web-${Math.random().toString(36).slice(2, 10)}`
  if (!existingDeviceId) {
    localStorage.setItem('deviceId', deviceId)
  }

  return {
    deviceId,
    name: navigator.platform || 'web',
    model: 'browser',
    operatingSystem: navigator.platform || 'web',
    osVersion: ua,
    manufacturer: 'browser',
  }
}

export default function LoginPage() {
  const [officerId, setOfficerId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [language, setLanguage] = useState<'EN' | 'FR'>('EN')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusWarning, setStatusWarning] = useState<{ type: 'blocked' | 'restricted' | 'notValidated' | null; message: string }>({ type: null, message: '' })
  
  const theme = useTheme()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { mode, toggleMode } = useThemeMode()
  
  const canUseDevBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LOGIN === 'true'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setStatusWarning({ type: null, message: '' })
    clearAuthStorage()
    
    const normalizedOfficerId = officerId.trim()
    
    try {
      const payload = {
        officerId: normalizedOfficerId,
        password,
        deviceInfo: getDeviceInfo(),
      }

      const resp = await apiService.auth.signin(payload)
      const tokenPayload = resp.data?.data || resp.data || {}
      const { accessToken, refreshToken } = tokenPayload

      if (!accessToken) {
        throw new Error('Login failed: No access token received')
      }

      localStorage.setItem('accessToken', accessToken)
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
      
      const backendUser = tokenPayload?.user || tokenPayload?.officer || {}
      const firstName = backendUser?.firstName || ''
      const lastName = backendUser?.lastName || ''
      const fullName = `${firstName} ${lastName}`.trim()
      
      // Extract role from JWT token if available
      let jwtRole: string | undefined
      let jwtPayload: any = {}
      try {
        const tokenParts = accessToken.split('.')
        if (tokenParts.length === 3) {
          jwtPayload = JSON.parse(atob(tokenParts[1]))
          jwtRole = jwtPayload?.role || jwtPayload?.roles?.[0]
        }
      } catch (e) {
        // Failed to decode JWT
      }

      // Debug: Log all available data to help identify role field
      if (import.meta.env.DEV) {
        console.log('🔍 Login Response - Full Token Payload:', tokenPayload)
        console.log('🔍 Login Response - Backend User:', backendUser)
        console.log('🔍 Login Response - JWT Payload:', jwtPayload)
        console.log('🔍 Login Response - Extracted JWT Role:', jwtRole)
      }

      // Support role from various sources: JWT, backendUser, tokenPayload
      const rawRole = 
        jwtRole ?? 
        tokenPayload?.role ??
        backendUser?.role ?? 
        backendUser?.userType ?? 
        backendUser?.type ?? 
        backendUser?.accountType ?? 
        tokenPayload?.userType ??
        tokenPayload?.type
      
      // Check roles array if exists
      const rolesArray = backendUser?.roles ?? backendUser?.userRoles ?? backendUser?.authorities ?? []
      
      const resolvedRole = 
        rawRole ||
        (Array.isArray(rolesArray) && rolesArray.includes('admin') ? 'admin' : undefined) ||
        (Array.isArray(rolesArray) && rolesArray.includes('dispatch') ? 'dispatch' : undefined) ||
        (Array.isArray(rolesArray) && rolesArray[0]) ||
        'officer'

      // Extract status fields from backend
      const isValid = backendUser?.isValid !== undefined ? backendUser.isValid : true
      const isFrozen = backendUser?.isFrozen !== undefined ? backendUser.isFrozen : false
      const validated = backendUser?.validated !== undefined ? backendUser.validated : true
      
      const user: AuthUser = {
        id: String(backendUser?.id || backendUser?._id || normalizedOfficerId),
        officerId: backendUser?.officerId || normalizedOfficerId,
        firstName,
        lastName,
        displayName: backendUser?.name || backendUser?.fullName || (fullName || normalizedOfficerId),
        center: backendUser?.center,
        role: resolvedRole,
        phoneNumber: backendUser?.phoneNumber,
        isValid,
        isFrozen,
        validated,
      }

      // Check account status and show appropriate messages
      if (isValid === false) {
        // Account is blocked - don't allow login, show warning on login page
        clearAuthStorage()
        setLoading(false)
        setStatusWarning({
          type: 'blocked',
          message: 'Your account has been blocked. You cannot sign in at this time. Please contact an administrator for assistance.'
        })
        return
      }

      if (isFrozen === true) {
        // Account is restricted - show warning on login page but allow login
        dispatch(setToken(accessToken))
        dispatch(setUser(user))
        setStatusWarning({
          type: 'restricted',
          message: 'Your account is temporarily restricted. Some features may be limited. You will be redirected shortly...'
        })
        // Navigate after showing warning briefly
        setTimeout(() => {
          navigate('/', { state: { accountWarning: 'restricted' } })
        }, 2000)
        return
      }
      
      dispatch(setToken(accessToken))
      dispatch(setUser(user))
      navigate('/')
    } catch (err: any) {
      const loginError = mapLoginError(err)
      
      // If "user not valid" error, show a user-friendly message
      if (loginError.isBlocked && err?.response?.data?.message?.includes('user not valid')) {
        try {
          // Since the backend returns the same message for all cases, we'll show a more helpful generic message
          // that guides the user to contact support for their specific issue
          setStatusWarning({
            type: 'blocked',
            message: 'Your account access is currently limited. This could be due to account validation, restrictions, or blocking. Please contact your administrator for assistance with your specific account status.'
          })
        } catch (statusErr: any) {
          // If anything fails, show the same helpful message
          setStatusWarning({
            type: 'blocked',
            message: 'Your account access is currently limited. This could be due to account validation, restrictions, or blocking. Please contact your administrator for assistance with your specific account status.'
          })
        }
      } else if (loginError.isBlocked) {
        setStatusWarning({
          type: 'blocked',
          message: loginError.message
        })
      } else if (loginError.isRestricted) {
        setStatusWarning({
          type: 'restricted',
          message: loginError.message
        })
      } else {
        setError(loginError.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDevBypassLogin = () => {
    const devToken = 'dev-bypass-token'
    const devUser: AuthUser = {
      id: 'dev-officer',
      officerId: officerId.trim() || 'DEV-OFFICER',
      displayName: 'Development Officer',
      role: 'officer',
      center: 'DEV CENTER',
    }

    localStorage.setItem('accessToken', devToken)
    dispatch(setToken(devToken))
    dispatch(setUser(devUser))
    navigate('/')
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: mode === 'dark' ? 'background.default' : alpha(theme.palette.primary.main, 0.02),
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background patterns */}
      <Box sx={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundImage: `radial-gradient(${alpha(theme.palette.primary.main, 0.1)} 1px, transparent 1px)`, 
        backgroundSize: '32px 32px',
        opacity: mode === 'dark' ? 0.3 : 0.6,
        pointerEvents: 'none'
      }} />

      {/* Top Header / Actions */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: 1.5,
        position: 'relative',
        zIndex: 10
      }}>
        <IconButton 
          onClick={toggleMode} 
          sx={{ 
            bgcolor: 'background.paper', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
          }}
        >
          {mode === 'dark' ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
        </IconButton>
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => setLanguage((v) => (v === 'EN' ? 'FR' : 'EN'))}
          icon={<TranslateRoundedIcon fontSize="inherit" />}
        >
          {language}
        </Button>
      </Box>

      <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <Fade in timeout={800}>
          <Box sx={{ width: '100%', maxWidth: 1000 }}>
            <Card sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' },
              p: 0,
              overflow: 'hidden',
              minHeight: { md: 600 },
              border: 'none',
              boxShadow: mode === 'dark' 
                ? '0 24px 80px rgba(0,0,0,0.8)' 
                : '0 24px 80px rgba(103,80,164,0.12)',
            }}>
              {/* Brand Side */}
              <Box sx={{ 
                flex: 1.1,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                p: 6,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative',
                color: 'primary.contrastText',
                overflow: 'hidden'
              }}>
                <Box sx={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                <Box sx={{ position: 'absolute', bottom: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                
                <Stack spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    width: 64, 
                    height: 64, 
                    bgcolor: 'rgba(255,255,255,0.15)', 
                    borderRadius: 4, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    mb: 2
                  }}>
                    <TrafficRoundedIcon sx={{ fontSize: 40 }} />
                  </Box>
                  
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, lineHeight: 1.1 }}>
                      Road Accident System
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400, color: 'inherit' }}>
                      Emergency Response & Monitoring Interface
                    </Typography>
                  </Box>

                  <Stack spacing={2} sx={{ mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <EmergencyRoundedIcon sx={{ opacity: 0.7 }} />
                      <Typography variant="body1">Real-time Incident Tracking</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <EmergencyRoundedIcon sx={{ opacity: 0.7 }} />
                      <Typography variant="body1">Officer Deployment Management</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <EmergencyRoundedIcon sx={{ opacity: 0.7 }} />
                      <Typography variant="body1">Analytics & Reporting Dashboard</Typography>
                    </Box>
                  </Stack>
                </Stack>
                
                <Box sx={{ mt: 'auto', pt: 6, opacity: 0.7 }}>
                  <Typography variant="caption">
                    © 2026 Emergency Services Administration. All rights reserved.
                  </Typography>
                </Box>
              </Box>

              {/* Form Side */}
              <Box sx={{ 
                flex: 1, 
                p: { xs: 4, md: 8 }, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                bgcolor: 'background.paper'
              }}>
                <Stack spacing={4} component="form" onSubmit={handleSubmit}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                      Sign In
                    </Typography>
                    <Typography color="text.secondary">
                      Access your portal using your credentials
                    </Typography>
                  </Box>

                  <Stack spacing={2.5}>
                    <TextField
                      label="Officer ID"
                      value={officerId}
                      onChange={(e) => setOfficerId(e.target.value)}
                      required
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BadgeRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          bgcolor: alpha(theme.palette.primary.main, 0.02) 
                        } 
                      }}
                    />
                    
                    <Box>
                      <TextField
                        type={showPassword ? 'text' : 'password'}
                        label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        fullWidth
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockRoundedIcon fontSize="small" color="primary" />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small">
                                {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{ 
                          '& .MuiOutlinedInput-root': { 
                            bgcolor: alpha(theme.palette.primary.main, 0.02) 
                          } 
                        }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Link 
                          component={RouterLink} 
                          to="/auth/forgot-password" 
                          underline="hover" 
                          sx={{ fontSize: 13, fontWeight: 600 }}
                        >
                          Forgot password?
                        </Link>
                      </Box>
                    </Box>
                  </Stack>

                  {error && (
                    <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
                      {error}
                    </Alert>
                  )}

                  {/* Blocked Account Warning */}
                  {statusWarning.type === 'blocked' && (
                    <Alert 
                      severity="error" 
                      variant="filled"
                      icon={<BlockRoundedIcon />}
                      sx={{ 
                        borderRadius: 2,
                        '& .MuiAlert-icon': { alignItems: 'center' }
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Account Blocked
                      </Typography>
                      {statusWarning.message}
                    </Alert>
                  )}

                  {/* Restricted Account Warning */}
                  {statusWarning.type === 'restricted' && (
                    <Alert 
                      severity="warning"
                      icon={<WarningRoundedIcon />}
                      sx={{ 
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.dark,
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                        '& .MuiAlert-icon': { color: theme.palette.warning.main, alignItems: 'center' }
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: theme.palette.warning.dark }}>
                        Account Temporarily Restricted
                      </Typography>
                      <Typography variant="body2" sx={{ color: theme.palette.warning.dark }}>
                        {statusWarning.message}
                      </Typography>
                    </Alert>
                  )}

                  {/* Not Validated Account Warning */}
                  {statusWarning.type === 'notValidated' && (
                    <Alert 
                      severity="info"
                      icon={<HourglassEmptyRoundedIcon />}
                      sx={{ 
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: theme.palette.info.dark,
                        border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                        '& .MuiAlert-icon': { color: theme.palette.info.main, alignItems: 'center' }
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: theme.palette.info.dark }}>
                        Account Pending Approval
                      </Typography>
                      <Typography variant="body2" sx={{ color: theme.palette.info.dark }}>
                        {statusWarning.message}
                      </Typography>
                    </Alert>
                  )}
                  
                  {canUseDevBypass && (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Development bypass is active.
                    </Alert>
                  )}

                  <Stack spacing={2}>
                    <Button 
                      type="submit" 
                      loading={loading} 
                      size="lg"
                    >
                      Sign In to Portal
                    </Button>
                    
                    {canUseDevBypass && (
                      <Button type="button" variant="secondary" onClick={handleDevBypassLogin}>
                        Continue in DEV mode
                      </Button>
                    )}

                    <Box sx={{ textAlign: 'center', pt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Don't have an account?{' '}
                        <Link 
                          component={RouterLink} 
                          to="/auth/admin-signup" 
                          sx={{ fontWeight: 700, textDecoration: 'none' }}
                        >
                          Create Admin Account
                        </Link>
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Box>
            </Card>
          </Box>
        </Fade>
      </Container>
    </Box>
  )
}
