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
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import { apiService } from '@/services/api'
import { AuthUser } from '../slices/authSlice'
import { setUser, setToken } from '../slices/authSlice'
import { useThemeMode, useTranslation } from '../../../themeMode'
import { localeLabels, type LocaleCode, translate } from '../../../i18n'
import { clearAuthStorage } from '@/utils/authSecurity'
import { getDeviceId, setAccessToken, setDeviceId, setRefreshToken } from '@/utils/tokenStore'
import { Button, Card } from '@/components/Common'

type LoginErrorKind = 'credentials' | 'server' | 'network' | 'rate_limit'

function mapLoginError(err: any, locale: LocaleCode): {
  message: string
  kind: LoginErrorKind
  isBlocked?: boolean
  isRestricted?: boolean
} {
  const status = err?.response?.status
  const payload = err?.response?.data || {}
  const errorType = String(payload?.type || '').toUpperCase()
  const msg = String(payload?.message || err?.message || '').toLowerCase()

  if (import.meta.env.DEV) {
    console.log('🔴 Login Error:', { status, errorType, msg, payload })
  }

  const userData = payload?.data?.user || payload?.data?.officer || payload?.user || payload?.officer || {}
  const isValid = userData?.isValid
  const isFrozen = userData?.isFrozen
  const accountStatus = payload?.accountStatus || userData?.status || payload?.data?.accountStatus || payload?.status

  // Blocked account
  if (
    isValid === false ||
    accountStatus === 'blocked' || accountStatus === 'BLOCKED' ||
    payload?.isValid === false || payload?.data?.isValid === false ||
    msg.includes('account is blocked') || msg.includes('account blocked') ||
    errorType === 'ACCOUNT_BLOCKED' || errorType === 'BLOCKED'
  ) {
    return { message: translate(locale, 'auth.blocked'), kind: 'credentials', isBlocked: true }
  }

  // Restricted account
  if (
    isFrozen === true ||
    accountStatus === 'restricted' || accountStatus === 'frozen' ||
    accountStatus === 'RESTRICTED' || accountStatus === 'FROZEN' ||
    payload?.isFrozen === true || payload?.data?.isFrozen === true ||
    msg.includes('account is restricted') || msg.includes('temporarily restricted') ||
    msg.includes('frozen') ||
    errorType === 'ACCOUNT_RESTRICTED' || errorType === 'RESTRICTED' || errorType === 'FROZEN'
  ) {
    return { message: translate(locale, 'auth.restricted'), kind: 'credentials', isRestricted: true }
  }

  // "user not valid" — unvalidated / access limited
  if (errorType === 'INVALID_CREDENTIALS' && msg.includes('user not valid')) {
    return { message: translate(locale, 'auth.not_validated'), kind: 'credentials', isBlocked: true }
  }

  // Explicit invalid credentials
  if (errorType === 'INVALID_CREDENTIALS') {
    return { message: translate(locale, 'auth.invalid_credentials'), kind: 'credentials' }
  }

  // UNKNOWN_ERROR during password verification = wrong password (backend bug, treat as credentials)
  if (errorType === 'UNKNOWN_ERROR' && (msg.includes('verifying user password') || msg.includes('password'))) {
    return { message: translate(locale, 'auth.invalid_credentials'), kind: 'credentials' }
  }

  // Rate limiting
  if (status === 429) {
    return { message: translate(locale, 'auth.too_many_attempts'), kind: 'rate_limit' }
  }

  // Locked / suspended
  if (status === 423 || msg.includes('suspended')) {
    return { message: translate(locale, 'auth.restricted'), kind: 'credentials', isRestricted: true }
  }

  // 401 / 403 — always wrong credentials, not server fault
  if (status === 401 || status === 403 || msg.includes('unauthorized')) {
    return { message: translate(locale, 'auth.invalid_credentials'), kind: 'credentials' }
  }

  // Server errors
  if (status && status >= 500) {
    return { message: translate(locale, 'auth.server_error'), kind: 'server' }
  }

  // No internet
  if (!status && !navigator.onLine) {
    return { message: translate(locale, 'auth.no_connection'), kind: 'network' }
  }

  // Network / fetch failure
  if (!status && (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed'))) {
    return { message: translate(locale, 'auth.network_error'), kind: 'network' }
  }

  // Fallback — try to surface the server message, default to credentials error
  const serverMsg = payload?.message
  if (serverMsg && typeof serverMsg === 'string' && serverMsg.length < 120) {
    return { message: serverMsg, kind: 'credentials' }
  }
  return { message: translate(locale, 'auth.invalid_credentials'), kind: 'credentials' }
}

function getDeviceInfo() {
  const ua = navigator.userAgent || ''
  const existingDeviceId = getDeviceId()
  const deviceId = existingDeviceId || `web-${Math.random().toString(36).slice(2, 10)}`
  if (!existingDeviceId) {
    setDeviceId(deviceId)
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<LoginErrorKind | null>(null)
  const [statusWarning, setStatusWarning] = useState<{ type: 'blocked' | 'restricted' | 'notValidated' | null; message: string }>({ type: null, message: '' })
  
  const theme = useTheme()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { mode, toggleMode, locale, setLocale } = useThemeMode()
  const { t } = useTranslation()
  
  const canUseDevBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LOGIN === 'true'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setErrorKind(null)
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

      setAccessToken(accessToken)
      if (refreshToken) setRefreshToken(refreshToken)
      
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
        try {
          const meResp = await apiService.users.getMe()
          const profile = meResp.data?.data || meResp.data || {}
          dispatch(setUser({
            ...user,
            id: String(profile.id || profile._id || user.id),
            officerId: profile.officerId || user.officerId,
            firstName: profile.firstName || user.firstName,
            lastName: profile.lastName || user.lastName,
            displayName: profile.displayName || profile.name || user.displayName,
            center: profile.center || user.center,
            phoneNumber: profile.phoneNumber || user.phoneNumber,
          }))
        } catch { /* use JWT data */ }
        setStatusWarning({
          type: 'restricted',
          message: 'Your account is temporarily restricted. Some features may be limited. You will be redirected shortly...'
        })
        setTimeout(() => {
          navigate('/', { state: { accountWarning: 'restricted' } })
        }, 2000)
        return
      }
      
      dispatch(setToken(accessToken))
      dispatch(setUser(user))

      // Enrich profile from /users/me since login response may omit user fields
      try {
        const meResp = await apiService.users.getMe()
        const profile = meResp.data?.data || meResp.data || {}
        dispatch(setUser({
          ...user,
          id: String(profile.id || profile._id || user.id),
          officerId: profile.officerId || user.officerId,
          firstName: profile.firstName || user.firstName,
          lastName: profile.lastName || user.lastName,
          displayName: profile.displayName || profile.name || profile.fullName || user.displayName,
          center: profile.center || user.center,
          phoneNumber: profile.phoneNumber || user.phoneNumber,
          isValid: profile.isValid !== undefined ? profile.isValid : user.isValid,
          isFrozen: profile.isFrozen !== undefined ? profile.isFrozen : user.isFrozen,
          validated: profile.validated !== undefined ? profile.validated : user.validated,
        }))
      } catch {
        // Profile fetch failed — JWT data is still stored above
      }

      navigate('/')
    } catch (err: any) {
      const loginError = mapLoginError(err, locale)
      if (loginError.isBlocked) {
        setStatusWarning({ type: 'blocked', message: loginError.message })
      } else if (loginError.isRestricted) {
        setStatusWarning({ type: 'restricted', message: loginError.message })
      } else {
        setError(loginError.message)
        setErrorKind(loginError.kind)
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

    setAccessToken(devToken)
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
          onClick={() => {
            const order: LocaleCode[] = ['en', 'fr', 'ar']
            const next = order[(order.indexOf(locale) + 1) % order.length]
            setLocale(next)
          }}
          icon={<TranslateRoundedIcon fontSize="inherit" />}
        >
          {localeLabels[locale]}
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
                      {t('app.name')}
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400, color: 'inherit' }}>
                      {t('auth.welcome_subtitle')}
                    </Typography>
                  </Box>

                  <Stack spacing={2} sx={{ mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <EmergencyRoundedIcon sx={{ opacity: 0.7 }} />
                      <Typography variant="body1">{t('dashboard.subtitle')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <EmergencyRoundedIcon sx={{ opacity: 0.7 }} />
                      <Typography variant="body1">{t('nav.officer_tracking')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <EmergencyRoundedIcon sx={{ opacity: 0.7 }} />
                      <Typography variant="body1">{t('nav.reports')}</Typography>
                    </Box>
                  </Stack>
                </Stack>
                
                <Box sx={{ mt: 'auto', pt: 6, opacity: 0.7 }}>
                  <Typography variant="caption">
                    © 2026 Micla Engineering & Design Tunis. All rights reserved.
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
                      {t('auth.sign_in')}
                    </Typography>
                    <Typography color="text.secondary">
                      {t('auth.welcome_title')}
                    </Typography>
                  </Box>

                  <Stack spacing={2.5}>
                    <TextField
                      label={t('auth.officer_id')}
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
                        label={t('auth.password')}
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
                          {t('auth.forgot_password')}
                        </Link>
                      </Box>
                    </Box>
                  </Stack>

                  {error && (
                    <Fade in>
                      <Alert
                        severity={errorKind === 'network' || errorKind === 'server' ? 'warning' : 'error'}
                        variant="outlined"
                        icon={
                          errorKind === 'network' ? <WifiOffRoundedIcon fontSize="small" /> :
                          errorKind === 'server' ? <CloudOffRoundedIcon fontSize="small" /> :
                          errorKind === 'rate_limit' ? <TimerRoundedIcon fontSize="small" /> :
                          <KeyRoundedIcon fontSize="small" />
                        }
                        sx={{
                          borderRadius: 2,
                          alignItems: 'flex-start',
                          '& .MuiAlert-icon': { mt: 0.25 },
                        }}
                        action={
                          (errorKind === 'server' || errorKind === 'network') ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => { setError(null); setErrorKind(null) }}
                            >
                              {t('auth.retry')}
                            </Button>
                          ) : undefined
                        }
                      >
                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.4 }}>
                          {errorKind === 'credentials' && t('auth.invalid_credentials').split('.')[0]}
                          {errorKind === 'server' && 'Service unavailable'}
                          {errorKind === 'network' && 'No connection'}
                          {errorKind === 'rate_limit' && 'Too many attempts'}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, opacity: 0.9 }}>
                          {error}
                        </Typography>
                      </Alert>
                    </Fade>
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
                        {t('auth.blocked')}
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
                        {t('auth.restricted')}
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
                        {t('auth.not_validated')}
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
                      {t('auth.sign_in_button')}
                    </Button>
                    
                    {canUseDevBypass && (
                      <Button type="button" variant="secondary" onClick={handleDevBypassLogin}>
                        {t('auth.dev_mode')}
                      </Button>
                    )}

                    <Box sx={{ textAlign: 'center', pt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        New officer?{' '}
                        <Link
                          component={RouterLink}
                          to="/register"
                          sx={{ fontWeight: 700, textDecoration: 'none' }}
                        >
                          Request an account
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
