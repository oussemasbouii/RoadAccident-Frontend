import { useMemo, useState } from 'react'
import { 
  Avatar, 
  Box, 
  FormControlLabel, 
  Stack, 
  Switch, 
  Typography, 
  Divider, 
  Chip, 
  useTheme,
  alpha
} from '@mui/material'
import { useAppSelector } from '../../../store/store'
import Card from '../../../components/Common/Card'
import { useThemeMode } from '../../../themeMode'

export default function SettingsPage() {
  const theme = useTheme()
  const user = useAppSelector((state) => state.auth.user)
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true)
  const [pushAlerts, setPushAlerts] = useState<boolean>(true)
  const { mode, toggleMode } = useThemeMode()

  const profile = useMemo(() => {
    const displayName = user?.displayName || user?.officerId || 'Officer'
    const initials =
      (displayName || 'O')
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'OF'

    return {
      displayName,
      role: user?.role || 'officer',
      officerId: user?.officerId || 'Not available',
      center: user?.center || 'Not assigned',
      phoneNumber: user?.phoneNumber || 'Not provided',
      initials,
    }
  }, [user])

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: .5 }}>Settings</Typography>
        <Typography color="text.secondary">Manage your profile, preferences, and account security.</Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' } }}>
        <Box>
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar 
                sx={{ 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'primary.main', 
                  fontSize: 24, 
                  fontWeight: 800,
                  borderRadius: 'var(--radius-m3-lg, 16px)',
                  boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                {profile.initials}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{profile.displayName}</Typography>
                <Chip 
                  label={profile.role.toUpperCase()} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ mt: 1, fontWeight: 700, borderRadius: '8px' }}
                />
              </Box>
            </Box>
            <Divider sx={{ my: 3, opacity: 0.6 }} />
            <Stack spacing={2}>
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Officer ID</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.officerId}</Typography>
              </Box>
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Center</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.center}</Typography>
              </Box>
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.phoneNumber}</Typography>
              </Box>
            </Stack>
          </Card>
        </Box>

        <Box>
          <Stack spacing={3}>
            <Card sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 800 }}>Detailed Information</Typography>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                {[
                  ['Full Name', profile.displayName], 
                  ['Officer ID', profile.officerId], 
                  ['Assigned Center', profile.center], 
                  ['Account Role', profile.role]
                ].map(([k, v]) => (
                  <Box 
                    key={String(k)} 
                    sx={{ 
                      p: 2, 
                      borderRadius: 'var(--radius-m3-md, 12px)', 
                      border: '1px solid', 
                      borderColor: 'divider',
                      bgcolor: alpha(theme.palette.action.active, 0.01)
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}>{k}</Typography>
                    <Typography sx={{ fontWeight: 700, mt: 0.5 }}>{String(v)}</Typography>
                  </Box>
                ))}
              </Box>
            </Card>

            <Card sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>System Preferences</Typography>
              <Stack spacing={1}>
                <FormControlLabel 
                  control={<Switch checked={mode === 'dark'} onChange={toggleMode} color="primary" />} 
                  label={<Typography sx={{ fontWeight: 600 }}>Enable High-Contrast Dark Mode (OLED)</Typography>} 
                />
                <Divider sx={{ my: 1, opacity: 0.4 }} />
                <FormControlLabel 
                  control={<Switch checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} color="primary" />} 
                  label={<Typography sx={{ fontWeight: 600 }}>Critical Email Notifications</Typography>} 
                />
                <FormControlLabel 
                  control={<Switch checked={pushAlerts} onChange={(e) => setPushAlerts(e.target.checked)} color="primary" />} 
                  label={<Typography sx={{ fontWeight: 600 }}>Real-time Push Alerts</Typography>} 
                />
              </Stack>
            </Card>
          </Stack>
        </Box>
      </Box>
    </Stack>
  )
}
