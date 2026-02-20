import { useMemo, useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import { apiService } from '@/services/api'
import { INSTITUTIONAL_DOMAIN, isInstitutionalEmail } from '@/utils/authValidation'

export default function AdminSignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [center, setCenter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const emailIsInstitutional = useMemo(() => isInstitutionalEmail(email), [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!emailIsInstitutional) {
      setError(`Only institutional emails are allowed (@${INSTITUTIONAL_DOMAIN}).`)
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
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        center: center.trim() || undefined,
        role: 'admin',
      })

      setSuccess('Administrator account created successfully. You can now sign in.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create administrator account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, background: (t) => `linear-gradient(115deg, ${t.palette.primary.main}, ${t.palette.secondary.main})` }}>
      <Card sx={{ width: '100%', maxWidth: 540, p: 4 }}>
        <Stack spacing={2.25} component="form" onSubmit={handleSubmit}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Create Administrator Account</Typography>
            <Typography color="text.secondary" sx={{ mt: .5 }}>
              Institutional email only: <strong>@{INSTITUTIONAL_DOMAIN}</strong>
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth required />
            <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth required />
          </Stack>

          <TextField
            label="Institutional email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            error={email.length > 0 && !emailIsInstitutional}
            helperText={email.length > 0 && !emailIsInstitutional ? `Email must end with @${INSTITUTIONAL_DOMAIN}` : 'Use your official institutional email.'}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField label="Phone number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} fullWidth />
            <TextField label="Center" value={center} onChange={(e) => setCenter(e.target.value)} fullWidth />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required />
            <TextField label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} fullWidth required />
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Admin Account'}
          </Button>
          <Button component={RouterLink} to="/login" variant="text">Back to Sign In</Button>
        </Stack>
      </Card>
    </Box>
  )
}
