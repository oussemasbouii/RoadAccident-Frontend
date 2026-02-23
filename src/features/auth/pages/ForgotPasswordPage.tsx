import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
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
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { apiService } from '@/services/api'
import { useThemeMode } from '../../../themeMode'
import { Button, Card } from '@/components/Common'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const theme = useTheme()
  const { mode } = useThemeMode()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      setLoading(true)
      const payload = identifier.includes('@')
        ? { email: identifier.trim() }
        : { officerId: identifier.trim() }
      await apiService.auth.requestPasswordReset(payload)
      setSuccess('Reset instructions have been sent if the account exists.')
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to request password reset.')
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
                    Forgot Password
                  </Typography>
                  <Typography color="text.secondary">
                    Enter your institutional email or officer ID to request a password reset.
                  </Typography>
                </Box>

                <TextField
                  label="Email or Officer ID"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailRoundedIcon fontSize="small" color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      bgcolor: alpha(theme.palette.primary.main, 0.02) 
                    } 
                  }}
                />

                {error && <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>{success}</Alert>}

                <Stack spacing={2}>
                  <Button type="submit" loading={loading} size="lg">
                    Request Reset Link
                  </Button>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center', pt: 1 }}>
                    <Link 
                      component={RouterLink} 
                      to="/auth/reset-password" 
                      sx={{ fontWeight: 600, fontSize: 14 }}
                    >
                      I already have a reset token
                    </Link>
                    
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
