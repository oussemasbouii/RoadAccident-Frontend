import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
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
  Link,
  GridLegacy as Grid
} from '@mui/material'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import LocalPhoneRoundedIcon from '@mui/icons-material/LocalPhoneRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { apiService } from '@/services/api'
import { useThemeMode } from '../../../themeMode'
import { Button, Card } from '@/components/Common'

export default function AdminSignupPage() {
  const navigate = useNavigate()
  const [officerId, setOfficerId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [center, setCenter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const theme = useTheme()
  const { mode } = useThemeMode()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!officerId.trim()) {
      setError('Officer ID is required.')
      return
    }

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
      await apiService.auth.adminSignup({
        officerId: officerId.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        center: center.trim(),
        role: 'admin',
      })

      setSuccess('Administrator account created successfully. You can now sign in with this Officer ID.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create administrator account.')
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

      <Container maxWidth="md" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6, position: 'relative', zIndex: 1 }}>
        <Fade in timeout={800}>
          <Box sx={{ width: '100%' }}>
            <Card sx={{ 
              p: { xs: 4, md: 6 },
              boxShadow: mode === 'dark' 
                ? '0 24px 80px rgba(0,0,0,0.8)' 
                : '0 24px 80px rgba(103,80,164,0.12)',
            }}>
              <Stack spacing={5} component="form" onSubmit={handleSubmit}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5 }}>
                    Create Administrator Account
                  </Typography>
                  <Typography color="text.secondary">
                    Register a new admin. They will sign in with the Officer ID below.
                  </Typography>
                </Box>

                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Officer ID"
                      value={officerId}
                      onChange={(e) => setOfficerId(e.target.value)}
                      required
                      fullWidth
                      placeholder="e.g. ADMIN-01 or admin@institution.gov"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BadgeRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Center / Station"
                      value={center}
                      onChange={(e) => setCenter(e.target.value)}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      fullWidth
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      fullWidth
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Phone Number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocalPhoneRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      fullWidth 
                      required 
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField 
                      label="Confirm Password" 
                      type="password" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      fullWidth 
                      required 
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockRoundedIcon fontSize="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    />
                  </Grid>
                </Grid>

                {error && <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>{success}</Alert>}

                <Stack spacing={2}>
                  <Button type="submit" loading={loading} size="lg">
                    Create Admin Account
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
