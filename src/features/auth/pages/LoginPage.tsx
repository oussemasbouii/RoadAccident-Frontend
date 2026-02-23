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
import { apiService } from '@/services/api'
import { AuthUser } from '../slices/authSlice'
import { setUser, setToken } from '../slices/authSlice'
import { useThemeMode } from '../../../themeMode'
import { clearAuthStorage } from '@/utils/authSecurity'
import { Button, Card } from '@/components/Common'

function mapLoginError(err: any) {
  const status = err?.response?.status
  const payload = err?.response?.data || {}
  const errorType = String(payload?.type || '').toUpperCase()
  const msg = String(payload?.message || err?.message || 'Login failed').toLowerCase()

  if (errorType === 'INVALID_CREDENTIALS') {
    return 'Invalid credentials or account not yet validated. Please verify your Officer ID and password.'
  }

  if (errorType === 'UNKNOWN_ERROR' && msg.includes('verifying user password')) {
    return 'Server error during password verification. Please try again later.'
  }

  if (
    status === 423 ||
    msg.includes('blocked') ||
    msg.includes('suspended') ||
    msg.includes('restricted') ||
    payload?.accountStatus === 'blocked' ||
    payload?.accountStatus === 'restricted'
  ) {
    return 'Your account is restricted. Please contact an administrator.'
  }

  if (status === 401 || status === 403 || msg.includes('invalid') || msg.includes('unauthorized')) {
    return 'Invalid credentials. Please check your officer ID and password.'
  }

  return payload?.message || err?.message || 'Login failed'
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
  
  const theme = useTheme()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { mode, toggleMode } = useThemeMode()
  
  const canUseDevBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LOGIN === 'true'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    clearAuthStorage()
    try {
      const normalizedOfficerId = officerId.trim()
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
      
      const user: AuthUser = {
        id: String(backendUser?.id || backendUser?._id || normalizedOfficerId),
        officerId: backendUser?.officerId || normalizedOfficerId,
        firstName,
        lastName,
        displayName: backendUser?.name || backendUser?.fullName || (fullName || normalizedOfficerId),
        center: backendUser?.center,
        role: backendUser?.role || 'officer',
        phoneNumber: backendUser?.phoneNumber,
      }
      
      dispatch(setToken(accessToken))
      dispatch(setUser(user))
      navigate('/')
    } catch (err: any) {
      setError(mapLoginError(err))
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
          sx={{ bgcolor: 'background.paper' }}
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
