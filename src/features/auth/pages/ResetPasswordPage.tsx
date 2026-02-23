import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { 
  Alert, 
  Box, 
  Stack, 
  TextField, 
  Typography, 
  useTheme, 
  alpha, 
  Fade, 
  Container,
  InputAdornment,
  Link
} from '@mui/material'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { apiService } from '@/services/api'
import { useThemeMode } from '../../../themeMode'
import { Button, Card } from '@/components/Common'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const theme = useTheme()
  const { mode } = useThemeMode()

  const payloadIdentity = useMemo(
    () => (identifier.includes('@') ? { email: identifier.trim() } : { officerId: identifier.trim() }),
    [identifier]
  )

  const handleVerifyToken = async () => {
    setError(null)
    setSuccess(null)
    try {
      setLoading(true)
      await apiService.auth.verifyPasswordResetToken({ token: token.trim(), ...payloadIdentity })
      setSuccess('Reset token verified. You can now set a new password.')
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired token.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    try {
      setLoading(true)
      await apiService.auth.resetPassword({
        token: token.trim(),
        newPassword: password,
        confirmPassword,
        ...payloadIdentity,
      })
      setSuccess('Password has been reset successfully. Redirecting to login...')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
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

      <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, position: 'relative', zIndex: 1 }}>
        <Fade in timeout={800}>
          <Box sx={{ width: '100%' }}>
            <Card sx={{ 
              p: { xs: 4, md: 6 },
              boxShadow: mode === 'dark' 
                ? '0 24px 80px rgba(0,0,0,0.8)' 
                : '0 24px 80px rgba(103,80,164,0.12)',
            }}>
              <Stack spacing={4} component="form" onSubmit={handleSubmit}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5 }}>
                    Reset Password
                  </Typography>
                  <Typography color="text.secondary">
                    Enter your reset token and choose a new password.
                  </Typography>
                </Box>

                <Stack spacing={2.5}>
                  <TextField
                    label="Email or Officer ID"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeRoundedIcon fontSize="small" color="primary" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                  />

                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <TextField
                      label="Reset token/code"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      required
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <VpnKeyRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={handleVerifyToken} 
                      disabled={loading || !token || !identifier}
                      sx={{ whiteSpace: 'nowrap', py: 1.75 }}
                    >
                      Verify
                    </Button>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="New password"
                      type="password"
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
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                    <TextField
                      label="Confirm password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Stack>
                </Stack>

                {error && <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>{success}</Alert>}

                <Stack spacing={2}>
                  <Button type="submit" loading={loading} size="lg">
                    Set New Password
                  </Button>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                    <Link 
                      component={RouterLink} 
                      to="/login" 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 0.5, 
                        fontWeight: 700, 
                        textDecoration: 'none',
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main' }
                      }}
                    >
                      <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
                      Back to Sign In
                    </Link>
                  </Box>
                </Stack>
              </Stack>
            </Card>
          </Box>
        </Fade>
      </Container>
    </Box>
  )
}
