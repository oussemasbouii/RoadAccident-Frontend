import { useMemo, useState } from 'react'
import { Avatar, Box, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { useAppSelector } from '../../../store/store'
import Card from '../../../components/Common/Card'
import { useThemeMode } from '../../../themeMode'

export default function SettingsPage() {
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

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' } }}>
        <Box><Card className="p-6">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {profile.initials}
            </Avatar>
            <Box><Typography sx={{ fontWeight: 700 }}>{profile.displayName}</Typography><Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{profile.role}</Typography></Box>
          </Box>
          <Stack spacing={1}><Typography variant="body2"><strong>Officer ID:</strong> {profile.officerId}</Typography><Typography variant="body2"><strong>Center:</strong> {profile.center}</Typography><Typography variant="body2"><strong>Phone:</strong> {profile.phoneNumber}</Typography></Stack>
        </Card></Box>

        <Box><Stack spacing={2}>
          <Card className="p-6"><Typography variant="h6" sx={{ mb: 2 }}>Officer Information</Typography><Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>{[['Name', profile.displayName], ['Officer ID', profile.officerId], ['Center', profile.center], ['Role', profile.role]].map(([k,v]) => (<Box key={String(k)} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}><Typography variant="caption" color="text.secondary">{k}</Typography><Typography sx={{ fontWeight: 600 }}>{String(v)}</Typography></Box>))}</Box></Card>
          <Card className="p-6"><Typography variant="h6" sx={{ mb: 1.5 }}>Preferences</Typography><Stack spacing={.5}><FormControlLabel control={<Switch checked={mode === 'dark'} onChange={toggleMode} />} label="Enable dark mode" /><FormControlLabel control={<Switch checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} />} label="Email alert notifications" /><FormControlLabel control={<Switch checked={pushAlerts} onChange={(e) => setPushAlerts(e.target.checked)} />} label="Push alert notifications" /></Stack></Card>
          <Card className="p-6"><Typography variant="h6" sx={{ mb: .5 }}>Contact</Typography><Typography variant="body2" color="text.secondary">Phone: <strong>{profile.phoneNumber}</strong></Typography></Card>
        </Stack></Box>
      </Box>
    </Stack>
  )
}
