import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  IconButton,
  InputAdornment,
  LinearProgress,
  Link,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import LocalPhoneRoundedIcon from '@mui/icons-material/LocalPhoneRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { apiService } from '@/services/api'
import { parseAuthFormError } from '../authErrors'
import { useThemeMode } from '../../../themeMode'
import { Button, Card } from '@/components/Common'

/* ─── password strength ───────────────────────────────────────────────────── */

function passwordStrength(pw: string): { pct: number; label: string; color: string } {
  if (!pw) return { pct: 0, label: '', color: '#e2e8f0' }
  let s = 0
  if (pw.length >= 12) s++
  if (pw.length >= 16) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 1) return { pct: 20, label: 'Weak',   color: '#ef4444' }
  if (s <= 2) return { pct: 45, label: 'Fair',   color: '#f59e0b' }
  if (s <= 3) return { pct: 68, label: 'Good',   color: '#3b82f6' }
  return              { pct: 100, label: 'Strong', color: '#22c55e' }
}

/* ─── error handling ─────────────────────────────────────────────────────────
   Friendly + per-field parsing lives in ../authErrors (parseAuthFormError).
   A 404 here means the /auth/register endpoint isn't deployed → "contact admin".
─────────────────────────────────────────────────────────────────────────────── */

/* ─── component ───────────────────────────────────────────────────────────── */

export default function RegisterPage() {
  const theme    = useTheme()
  const { mode } = useThemeMode()

  const [officerId,       setOfficerId]       = useState('')
  const [firstName,       setFirstName]       = useState('')
  const [lastName,        setLastName]        = useState('')
  const [phone,           setPhone]           = useState('')
  const [center,          setCenter]          = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw,          setShowPw]          = useState(false)
  const [showConfirmPw,   setShowConfirmPw]   = useState(false)

  const [fieldErrors,      setFieldErrors]      = useState<Record<string, string>>({})
  const [apiError,         setApiError]         = useState<string | null>(null)
  const [loading,          setLoading]          = useState(false)
  const [submitted,        setSubmitted]        = useState(false)
  const [endpointMissing,  setEndpointMissing]  = useState(false)
  const [copied,           setCopied]           = useState(false)

  const pw = passwordStrength(password)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!officerId.trim())             errs.officerId       = 'Officer ID is required.'
    if (!firstName.trim())             errs.firstName       = 'First name is required.'
    if (!lastName.trim())              errs.lastName        = 'Last name is required.'
    if (!center.trim())                errs.center          = 'Center / Station is required.'
    if (password.length < 12)          errs.password        = 'Password must be at least 12 characters.'
    if (password !== confirmPassword)  errs.confirmPassword = 'Passwords do not match.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    setEndpointMissing(false)
    if (!validate()) return

    try {
      setLoading(true)
      await apiService.auth.register({
        officerId:   officerId.trim(),
        firstName:   firstName.trim(),
        lastName:    lastName.trim(),
        phoneNumber: phone.trim()   || undefined,
        center:      center.trim(),
        password,
        role: 'officer',
      })
      setSubmitted(true)
    } catch (err: any) {
      const { status, message, fieldErrors: fe } = parseAuthFormError(err)
      // 404 → the /auth/register endpoint isn't deployed yet on this server.
      if (status === 404) {
        setEndpointMissing(true)
      } else {
        setApiError(message)
        if (Object.keys(fe).length > 0) setFieldErrors((prev) => ({ ...prev, ...fe }))
      }
    } finally {
      setLoading(false)
    }
  }

  const adminSummary = [
    `Officer ID : ${officerId.trim()}`,
    `Name       : ${firstName.trim()} ${lastName.trim()}`,
    phone.trim()  ? `Phone      : ${phone.trim()}`  : '',
    center.trim() ? `Center     : ${center.trim()}` : '',
  ].filter(Boolean).join('\n')

  const handleCopy = () => {
    navigator.clipboard.writeText(adminSummary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: alpha(theme.palette.primary.main, 0.025),
      borderRadius: '10px',
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
    },
  }

  /* ── success screen (endpoint returned 201) ── */
  if (submitted) {
    return (
      <PageShell mode={mode} theme={theme}>
        <Card sx={{ p: { xs: 4, md: 6 }, maxWidth: 520, mx: 'auto', textAlign: 'center' }}>
          <Stack spacing={3} alignItems="center">
            <Box sx={{
              width: 80, height: 80, borderRadius: '50%',
              bgcolor: alpha(theme.palette.warning.main, 0.12),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HourglassTopRoundedIcon sx={{ fontSize: 42, color: 'warning.main' }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Request submitted
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Your registration has been sent for review. You will be able to sign in once an administrator approves your account.
              </Typography>
            </Box>
            {[
              'Your request is pending review',
              'An admin will activate your account',
              'You will then be able to sign in',
            ].map((step, i) => (
              <Stack key={i} direction="row" spacing={1.5} alignItems="center"
                sx={{ width: '100%', py: 0.75,
                      borderTop: i > 0 ? `1px solid ${alpha(theme.palette.divider, 0.6)}` : 'none' }}>
                <CheckCircleRoundedIcon sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary">{step}</Typography>
              </Stack>
            ))}
            <Link component={RouterLink} to="/login"
              sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5,
                    textDecoration: 'none', color: 'primary.main' }}>
              <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> Back to Sign In
            </Link>
          </Stack>
        </Card>
      </PageShell>
    )
  }

  /* ── fallback screen (endpoint not deployed yet) ── */
  if (endpointMissing) {
    return (
      <PageShell mode={mode} theme={theme}>
        <Card sx={{ p: { xs: 4, md: 6 }, maxWidth: 560, mx: 'auto', textAlign: 'center' }}>
          <Stack spacing={3} alignItems="center">
            <Box sx={{
              width: 80, height: 80, borderRadius: '50%',
              bgcolor: alpha(theme.palette.info.main, 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AdminPanelSettingsRoundedIcon sx={{ fontSize: 42, color: 'info.main' }} />
            </Box>

            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Contact your administrator
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Self-registration is not yet enabled on this server. Share your details below with an admin so they can create your account.
              </Typography>
            </Box>

            {/* Details box with copy button */}
            <Box sx={{
              width: '100%', borderRadius: 2, p: 2.5,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              textAlign: 'left',
            }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
                  Your account details
                </Typography>
                <IconButton size="small" onClick={handleCopy}
                  sx={{ color: copied ? 'success.main' : 'primary.main' }}>
                  {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
                </IconButton>
              </Stack>
              <Box component="pre" sx={{
                fontFamily: 'monospace', fontSize: 13, m: 0,
                color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.8,
              }}>
                {adminSummary}
              </Box>
              {copied && (
                <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block', fontWeight: 600 }}>
                  Copied to clipboard!
                </Typography>
              )}
            </Box>

            <Alert severity="info" sx={{ width: '100%', borderRadius: 2, textAlign: 'left' }}>
              Give this information to your administrator. They will create your account and set the same password you chose.
            </Alert>

            <Stack direction="row" spacing={2}>
              <Button variant="secondary" onClick={() => setEndpointMissing(false)}>
                Edit Details
              </Button>
              <Link component={RouterLink} to="/login" style={{ textDecoration: 'none' }}>
                <Button>Back to Sign In</Button>
              </Link>
            </Stack>
          </Stack>
        </Card>
      </PageShell>
    )
  }

  /* ── registration form ── */
  return (
    <PageShell mode={mode} theme={theme}>
      <Card sx={{ p: { xs: 3, md: 5 }, maxWidth: 620, mx: 'auto' }}>
        <Stack spacing={4} component="form" onSubmit={handleSubmit} noValidate>

          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PersonRoundedIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              Officer Registration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Submit a request — an administrator will review and activate your account.
            </Typography>
          </Box>

          {apiError && (
            <Alert severity="error" onClose={() => setApiError(null)} sx={{ borderRadius: 2 }}>
              {apiError}
            </Alert>
          )}

          {/* Officer ID */}
          <TextField
            label="Officer ID" value={officerId} required
            onChange={(e) => { setOfficerId(e.target.value); setFieldErrors(p => ({ ...p, officerId: '' })) }}
            error={!!fieldErrors.officerId}
            helperText={fieldErrors.officerId || 'Choose an ID you will use to sign in (e.g. OFF-001)'}
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><BadgeRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
            sx={fieldSx}
          />

          {/* Name */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="First Name" value={firstName} required
              onChange={(e) => { setFirstName(e.target.value); setFieldErrors(p => ({ ...p, firstName: '' })) }}
              error={!!fieldErrors.firstName} helperText={fieldErrors.firstName}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
            <TextField
              label="Last Name" value={lastName} required
              onChange={(e) => { setLastName(e.target.value); setFieldErrors(p => ({ ...p, lastName: '' })) }}
              error={!!fieldErrors.lastName} helperText={fieldErrors.lastName}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
          </Stack>

          {/* Phone + Center */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Phone Number" value={phone}
              onChange={(e) => { setPhone(e.target.value); setFieldErrors(p => ({ ...p, phone: '' })) }}
              error={!!fieldErrors.phone} helperText={fieldErrors.phone}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><LocalPhoneRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
            <TextField
              label="Center / Station" value={center} required
              onChange={(e) => { setCenter(e.target.value); setFieldErrors(p => ({ ...p, center: '' })) }}
              error={!!fieldErrors.center} helperText={fieldErrors.center}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><BusinessRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
          </Stack>

          {/* Password */}
          <Stack spacing={1}>
            <TextField
              label="Password" type={showPw ? 'text' : 'password'} value={password} required
              onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })) }}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password || 'Minimum 12 characters required'}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" color="primary" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(v => !v)} edge="end">
                      {showPw ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
            {password && (
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.disabled">Password strength</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: pw.color }}>{pw.label}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={pw.pct}
                  sx={{ height: 4, borderRadius: 4,
                        bgcolor: alpha(theme.palette.divider, 0.5),
                        '& .MuiLinearProgress-bar': { bgcolor: pw.color, borderRadius: 4 } }} />
              </Box>
            )}
          </Stack>

          <TextField
            label="Confirm Password" type={showConfirmPw ? 'text' : 'password'} value={confirmPassword} required
            onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: '' })) }}
            error={!!fieldErrors.confirmPassword} helperText={fieldErrors.confirmPassword}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" color="primary" /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowConfirmPw(v => !v)} edge="end">
                    {showConfirmPw ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />

          <Button type="submit" loading={loading} size="lg">
            Submit Registration Request
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/login"
              sx={{ fontWeight: 700, textDecoration: 'none', color: 'text.secondary',
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    '&:hover': { color: 'primary.main' } }}>
              <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
              Already have an account? Sign in
            </Link>
          </Box>

        </Stack>
      </Card>
    </PageShell>
  )
}

/* ─── page shell ──────────────────────────────────────────────────────────── */

function PageShell({ children, mode, theme }: { children: React.ReactNode; mode: string; theme: any }) {
  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      bgcolor: mode === 'dark' ? 'background.default' : alpha(theme.palette.primary.main, 0.02),
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `radial-gradient(${alpha(theme.palette.primary.main, 0.08)} 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
        opacity: mode === 'dark' ? 0.25 : 0.5,
      }} />
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                 py: 6, px: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{ width: '100%', maxWidth: 680 }}>{children}</Box>
      </Box>
    </Box>
  )
}
