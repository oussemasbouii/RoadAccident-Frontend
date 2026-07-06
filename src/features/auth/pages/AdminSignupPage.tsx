import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import LocalPhoneRoundedIcon from '@mui/icons-material/LocalPhoneRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import SupervisorAccountRoundedIcon from '@mui/icons-material/SupervisorAccountRounded'
import { apiService } from '@/services/api'
import { parseAuthFormError } from '../authErrors'
import { useThemeMode } from '../../../themeMode'
import { Button, Card } from '@/components/Common'

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function passwordStrength(pw: string): { pct: number; label: string; color: string } {
  if (!pw) return { pct: 0, label: '', color: '#e2e8f0' }
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 1) return { pct: 20, label: 'Weak', color: '#ef4444' }
  if (s <= 2) return { pct: 45, label: 'Fair', color: '#f59e0b' }
  if (s <= 3) return { pct: 68, label: 'Good', color: '#3b82f6' }
  return { pct: 100, label: 'Strong', color: '#22c55e' }
}

// Auth-form error parsing (friendly + per-field) lives in ../authErrors → parseAuthFormError.

/* ─── component ───────────────────────────────────────────────────────────── */

export default function AdminSignupPage() {
  const navigate   = useNavigate()
  const theme      = useTheme()
  const { mode }   = useThemeMode()

  const [officerId,       setOfficerId]       = useState('')
  const [firstName,       setFirstName]      = useState('')
  const [lastName,        setLastName]        = useState('')
  const [phone,           setPhone]           = useState('')
  const [center,          setCenter]          = useState('')
  const [role,            setRole]            = useState<'officer' | 'supervisor' | 'admin'>('officer')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw,          setShowPw]          = useState(false)
  const [showConfirmPw,   setShowConfirmPw]   = useState(false)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [apiError,    setApiError]    = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [generatedId, setGeneratedId] = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)

  const pw = passwordStrength(password)

  const resetForm = () => {
    setOfficerId(''); setFirstName(''); setLastName(''); setPhone('')
    setCenter(''); setRole('officer')
    setPassword(''); setConfirmPassword('')
    setFieldErrors({}); setApiError(null)
    setGeneratedId(null); setCopied(false)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!officerId.trim()) errs.officerId = 'Officer ID is required.'
    if (!firstName.trim()) errs.firstName = 'First name is required.'
    if (!lastName.trim())  errs.lastName  = 'Last name is required.'
    if (!center.trim())    errs.center    = 'Center / Station is required.'
    if (password.length < 12)           errs.password        = 'Password must be at least 12 characters.'
    if (password !== confirmPassword)   errs.confirmPassword = 'Passwords do not match.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    if (!validate()) return

    try {
      setLoading(true)
      const resp = await apiService.auth.adminSignup({
        officerId:   officerId.trim(),
        firstName:   firstName.trim(),
        lastName:    lastName.trim(),
        phoneNumber: phone.trim()  || undefined,
        center:      center.trim(),
        password,
        role,
      })
      const payload = resp.data?.data || resp.data || {}
      // Backend returns the officerId it stored (may normalize casing/format)
      const resolvedId = payload.officerId || officerId.trim() || null
      setGeneratedId(resolvedId)
    } catch (err: any) {
      const { message, fieldErrors: fe } = parseAuthFormError(err)
      setApiError(message)
      if (Object.keys(fe).length > 0) setFieldErrors((prev) => ({ ...prev, ...fe }))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (generatedId) {
      navigator.clipboard.writeText(generatedId).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
    }
  }

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: alpha(theme.palette.primary.main, 0.025),
      borderRadius: '10px',
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
    },
  }

  /* ── success screen ── */
  if (generatedId !== null) {
    return (
      <PageShell mode={mode} theme={theme}>
        <Card sx={{ p: { xs: 4, md: 6 }, maxWidth: 520, mx: 'auto', textAlign: 'center' }}>
          <Stack spacing={3} alignItems="center">
            <Box sx={{
              width: 80, height: 80, borderRadius: '50%',
              bgcolor: alpha(theme.palette.success.main, 0.12),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BadgeRoundedIcon sx={{ fontSize: 42, color: 'success.main' }} />
            </Box>

            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Account Created
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                The account for <strong>{firstName} {lastName}</strong> is active immediately.
                Share the Officer ID below so they can sign in.
              </Typography>
            </Box>

            <Box sx={{
              width: '100%', borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
              bgcolor: alpha(theme.palette.primary.main, 0.04), p: 2.5,
            }}>
              <Typography variant="caption" color="text.secondary"
                sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                Assigned Officer ID
              </Typography>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mt: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'monospace', letterSpacing: 2 }}>
                  {generatedId}
                </Typography>
                <IconButton size="small" onClick={handleCopy}
                  sx={{ color: copied ? 'success.main' : 'primary.main' }}>
                  {copied
                    ? <CheckRoundedIcon fontSize="small" />
                    : <ContentCopyRoundedIcon fontSize="small" />}
                </IconButton>
              </Stack>
              <Typography variant="caption" color="text.disabled">
                {copied ? 'Copied to clipboard!' : 'Click the icon to copy'}
              </Typography>
            </Box>

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ width: '100%' }}>
              <Button variant="secondary" onClick={resetForm}>
                Create Another
              </Button>
              <Button onClick={() => navigate('/admin/accounts')}>
                Back to Accounts
              </Button>
            </Stack>
          </Stack>
        </Card>
      </PageShell>
    )
  }

  /* ── form ── */
  return (
    <PageShell mode={mode} theme={theme}>
      <Card sx={{ p: { xs: 3, md: 5 }, maxWidth: 680, mx: 'auto' }}>
        <Stack spacing={4} component="form" onSubmit={handleSubmit} noValidate>

          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SupervisorAccountRoundedIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              Create New Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Admin-created accounts are active immediately — no approval needed.
              The system assigns the Officer ID automatically.
            </Typography>
          </Box>

          {apiError && (
            <Alert severity="error" onClose={() => setApiError(null)}
              sx={{ borderRadius: 2, fontWeight: 500 }}>
              {apiError}
            </Alert>
          )}

          {/* Officer ID */}
          <TextField
            label="Officer ID" value={officerId} required
            onChange={(e) => { setOfficerId(e.target.value); setFieldErrors(p => ({ ...p, officerId: '' })) }}
            error={!!fieldErrors.officerId} helperText={fieldErrors.officerId || 'The ID this person will use to sign in (e.g. OFF-042)'}
            fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><BadgeRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
            sx={fieldSx}
          />

          {/* Name row */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="First Name" value={firstName} required
              onChange={(e) => { setFirstName(e.target.value); setFieldErrors(p => ({ ...p, firstName: '' })) }}
              error={!!fieldErrors.firstName} helperText={fieldErrors.firstName}
              fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
            <TextField
              label="Last Name" value={lastName} required
              onChange={(e) => { setLastName(e.target.value); setFieldErrors(p => ({ ...p, lastName: '' })) }}
              error={!!fieldErrors.lastName} helperText={fieldErrors.lastName}
              fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
          </Stack>

          {/* Phone + Center */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Phone Number" value={phone}
              onChange={(e) => { setPhone(e.target.value); setFieldErrors(p => ({ ...p, phone: '' })) }}
              error={!!fieldErrors.phone} helperText={fieldErrors.phone || ' '}
              fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><LocalPhoneRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
            <TextField
              label="Center / Station" value={center} required
              onChange={(e) => { setCenter(e.target.value); setFieldErrors(p => ({ ...p, center: '' })) }}
              error={!!fieldErrors.center} helperText={fieldErrors.center || ' '}
              fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><BusinessRoundedIcon fontSize="small" color="primary" /></InputAdornment> }}
              sx={fieldSx}
            />
          </Stack>

          {/* Role */}
          <FormControl fullWidth sx={fieldSx}>
            <InputLabel>Role</InputLabel>
            <Select value={role} label="Role"
              onChange={(e) => setRole(e.target.value as typeof role)}
              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.025), borderRadius: '10px' }}>
              <MenuItem value="officer">Officer</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>

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
                  sx={{ height: 4, borderRadius: 4, bgcolor: alpha(theme.palette.divider, 0.5),
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
            Create Account
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/admin/accounts"
              sx={{ fontWeight: 700, textDecoration: 'none', color: 'text.secondary',
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    '&:hover': { color: 'primary.main' } }}>
              <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
              Back to Accounts
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
        <Box sx={{ width: '100%', maxWidth: 720 }}>{children}</Box>
      </Box>
    </Box>
  )
}
