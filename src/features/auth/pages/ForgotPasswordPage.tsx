import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import { apiService } from '@/services/api'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 480, p: 4 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Forgot Password</Typography>
          <Typography color="text.secondary">Enter your institutional email or officer ID to request a password reset.</Typography>
          <TextField
            label="Institutional email or officer ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Submitting...' : 'Request Reset'}
          </Button>
          <Button component={RouterLink} to="/auth/reset-password" variant="outlined">I already have a reset token</Button>
          <Button component={RouterLink} to="/login" variant="text">Back to Sign In</Button>
        </Stack>
      </Card>
    </Box>
  )
}
