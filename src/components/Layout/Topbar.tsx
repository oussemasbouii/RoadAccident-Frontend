import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import { RootState } from '../../store/store'
import { logout } from '../../features/auth/slices/authSlice'
import { useThemeMode } from '../../themeMode'

export default function Topbar() {
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null)
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const unreadAlerts = useSelector((state: RootState) => state.alerts?.unreadCount || 0)
  const user = useSelector((state: RootState) => state.auth.user)
  const { mode, toggleMode } = useThemeMode()

  const displayName = user?.displayName || user?.officerId || 'Officer'
  const initials =
    (displayName || 'O')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OF'

  const handleLogout = () => {
    dispatch(logout())
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    navigate('/login')
  }

  return (
    <AppBar position="sticky" color="inherit" elevation={1} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ minHeight: 64, px: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
            Operations Dashboard
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={(e) => setNotificationsAnchor(e.currentTarget)}>
            <Badge badgeContent={unreadAlerts} color="error" max={99}>
              <NotificationsNoneRoundedIcon />
            </Badge>
          </IconButton>

          <IconButton onClick={toggleMode}>
            {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
          </IconButton>

          <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 12 }}>{initials}</Avatar>
          </IconButton>
        </Box>
      </Toolbar>

      <Menu anchorEl={notificationsAnchor} open={Boolean(notificationsAnchor)} onClose={() => setNotificationsAnchor(null)}>
        <MenuItem disabled>Notifications</MenuItem>
        {[...Array(3)].map((_, i) => (
          <MenuItem key={i}>New Alert • 2 minutes ago</MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={userMenuAnchor} open={Boolean(userMenuAnchor)} onClose={() => setUserMenuAnchor(null)}>
        <MenuItem disabled>{displayName}</MenuItem>
        <MenuItem
          onClick={() => {
            navigate('/settings')
            setUserMenuAnchor(null)
          }}
        >
          Account Settings
        </MenuItem>
        <MenuItem onClick={handleLogout}>Sign Out</MenuItem>
      </Menu>
    </AppBar>
  )
}
