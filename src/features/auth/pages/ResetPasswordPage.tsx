import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import { apiService } from '@/services/api'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 520, p: 4 }}>
        <Stack spacing={2.25} component="form" onSubmit={handleSubmit}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Reset Password</Typography>
          <Typography color="text.secondary">Enter your reset token and choose a new password.</Typography>

          <TextField
            label="Institutional email or officer ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              label="Reset token/code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              fullWidth
            />
            <Button type="button" variant="outlined" onClick={handleVerifyToken} disabled={loading || !token || !identifier}>
              Verify Token
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
            />
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Saving...' : 'Set New Password'}
          </Button>
          <Button component={RouterLink} to="/login" variant="text">Back to Sign In</Button>
        </Stack>
      </Card>
    </Box>
  )
}
