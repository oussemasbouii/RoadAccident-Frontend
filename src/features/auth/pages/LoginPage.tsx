import React, { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Alert, Avatar, Box, Button, Card, IconButton, InputAdornment, Link, Stack, TextField, Typography } from '@mui/material'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import { keyframes } from '@mui/material/styles'
import { apiService } from '@/services/api'
import { AuthUser } from '../slices/authSlice'
import { setUser, setToken } from '../slices/authSlice'
import { useThemeMode } from '../../../themeMode'
import { clearAuthStorage } from '@/utils/authSecurity'

function mapLoginError(err: any) {
  const status = err?.response?.status
  const payload = err?.response?.data || {}
  const errorType = String(payload?.type || '').toUpperCase()
  const msg = String(payload?.message || err?.message || 'Login failed').toLowerCase()

  if (errorType === 'INVALID_CREDENTIALS') {
    return 'Invalid credentials or account not valid yet. Please verify your Officer ID/password, or contact admin for account validation.'
  }

  if (errorType === 'UNKNOWN_ERROR' && msg.includes('verifying user password')) {
    return 'Server could not verify your password right now. Please try again shortly. If it persists, contact support.'
  }

  if (
    status === 423 ||
    msg.includes('blocked') ||
    msg.includes('suspended') ||
    msg.includes('restricted') ||
    payload?.accountStatus === 'blocked' ||
    payload?.accountStatus === 'restricted'
  ) {
    return 'Your account is currently restricted. Please contact an administrator.'
  }

  if (status === 401 || status === 403 || msg.includes('invalid') || msg.includes('unauthorized')) {
    return 'Invalid credentials. Please check your officer ID and password.'
  }

  if (status >= 500) {
    return payload?.message || 'Authentication service is temporarily unavailable. Please try again shortly.'
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
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { mode, toggleMode } = useThemeMode()
  const canUseDevBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LOGIN === 'true'

  const auroraShift = keyframes`
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  `

  const floatAnim = keyframes`
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  `

  const pulseGlow = keyframes`
    0% { transform: scale(1); opacity: .45; }
    50% { transform: scale(1.08); opacity: .7; }
    100% { transform: scale(1); opacity: .45; }
  `

  const cardEntrance = keyframes`
    0% { transform: translateY(24px) scale(.985); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  `

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
        throw new Error('Login succeeded but no access token was returned')
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
      console.error('Login error details:', err.response?.data || err.message)
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
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, position: 'relative', overflow: 'hidden', background: 'linear-gradient(115deg, #6750A4, #7D5260, #4F378B, #625B71)', backgroundSize: '260% 260%', animation: `${auroraShift} 16s ease infinite` }}>
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 3, display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          onClick={toggleMode}
          startIcon={mode === 'dark' ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
          sx={{ borderRadius: 2, textTransform: 'none', bgcolor: 'rgba(255,255,255,.2)', backdropFilter: 'blur(4px)' }}
        >
          {mode === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => setLanguage((v) => (v === 'EN' ? 'FR' : 'EN'))}
          startIcon={<TranslateRoundedIcon fontSize="small" />}
          sx={{ borderRadius: 2, textTransform: 'none', bgcolor: 'rgba(255,255,255,.2)', backdropFilter: 'blur(4px)' }}
        >
          {language}
        </Button>
      </Box>

      <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: .25 }} />

      <Box sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.16)', top: 30, left: 20, filter: 'blur(10px)', animation: `${floatAnim} 8s ease-in-out infinite, ${pulseGlow} 5.8s ease-in-out infinite` }} />
      <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.12)', right: 70, bottom: 50, filter: 'blur(8px)', animation: `${floatAnim} 9s ease-in-out infinite` }} />
      <Box sx={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.10)', right: 250, top: 120, filter: 'blur(6px)', animation: `${floatAnim} 7s ease-in-out infinite` }} />

      <Card sx={{ width: '100%', maxWidth: 460, p: 4, border: 1, borderColor: mode === 'dark' ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.28)', boxShadow: '0 24px 64px rgba(18, 15, 30, .42)', backdropFilter: 'blur(16px)', background: mode === 'dark' ? 'linear-gradient(180deg, rgba(28,27,31,.92), rgba(18,18,18,.90))' : 'linear-gradient(180deg, rgba(255,255,255,.90), rgba(255,255,255,.82))', position: 'relative', zIndex: 1, animation: `${cardEntrance} .72s cubic-bezier(.2,.8,.2,1)` }}>
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: 'linear-gradient(120deg, rgba(255,255,255,.42), transparent 38%)' }} />
        <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
          <Box sx={{ textAlign: 'center', mb: 0.5 }}>
            <Avatar sx={{ width: 62, height: 62, mx: 'auto', mb: 1.25, bgcolor: 'primary.main', boxShadow: '0 10px 24px rgba(103,80,164,.45)', transition: 'transform .25s ease', '&:hover': { transform: 'translateY(-2px) scale(1.03)' } }}>
              <PersonRoundedIcon />
            </Avatar>
            <Typography variant="h4" sx={{ fontWeight: 800, color: mode === 'dark' ? 'grey.100' : 'text.primary' }}>Welcome Back</Typography>
            <Typography sx={{ color: mode === 'dark' ? 'grey.400' : 'text.secondary' }}>Sign in to your emergency services account</Typography>
          </Box>

          <TextField
            label="Officer ID"
            value={officerId}
            onChange={(e) => setOfficerId(e.target.value)}
            required
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BadgeRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiInputLabel-root': { color: mode === 'dark' ? 'grey.400' : undefined }, '& .MuiOutlinedInput-root': { borderRadius: 2.5, transition: 'all .2s ease', color: mode === 'dark' ? 'grey.100' : 'text.primary', '& fieldset': { borderColor: mode === 'dark' ? 'rgba(255,255,255,.25)' : undefined }, '&:hover fieldset': { borderColor: 'primary.main' } } }}
          />
          <TextField
            type={showPassword ? 'text' : 'password'}
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small" aria-label="toggle password visibility">
                    {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiInputLabel-root': { color: mode === 'dark' ? 'grey.400' : undefined }, '& .MuiOutlinedInput-root': { borderRadius: 2.5, transition: 'all .2s ease', color: mode === 'dark' ? 'grey.100' : 'text.primary', '& fieldset': { borderColor: mode === 'dark' ? 'rgba(255,255,255,.25)' : undefined }, '&:hover fieldset': { borderColor: 'primary.main' } } }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
            <Link component={RouterLink} to="/auth/forgot-password" underline="hover" sx={{ fontSize: 13, color: mode === 'dark' ? 'grey.300' : 'primary.main' }}>
              Forgot password?
            </Link>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {canUseDevBypass && (
            <Alert severity="warning">
              DEV auth bypass is enabled. Use only for local UI testing.
            </Alert>
          )}

          <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.2, fontWeight: 700, borderRadius: 2.5, boxShadow: '0 10px 18px rgba(103,80,164,.35)', '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 14px 24px rgba(103,80,164,.45)' } }}>{loading ? 'Authenticating...' : 'Continue to Dashboard'}</Button>
          {canUseDevBypass && (
            <Button type="button" variant="outlined" size="large" onClick={handleDevBypassLogin}>
              Continue in DEV mode
            </Button>
          )}
          <Button component={RouterLink} to="/auth/admin-signup" type="button" variant="outlined" size="large" sx={{ borderWidth: 1.5 }}>Create Admin Account</Button>
        </Stack>
      </Card>
    </Box>
  )
}
