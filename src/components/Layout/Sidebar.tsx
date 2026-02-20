import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  alpha,
  Avatar,
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material'
import { RootState } from '../../store/store'
import { logout } from '../../features/auth/slices/authSlice'

interface SidebarProps {
  onMouseLeave?: () => void
}

export default function Sidebar({ onMouseLeave }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector((state: RootState) => state.auth.user)

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/incidents', label: 'Accidents', icon: '🚨' },
    { path: '/alerts', label: 'Alerts', icon: '🔔' },
    { path: '/reports', label: 'Reports', icon: '📈' },
    { path: '/admin/accounts', label: 'Admin Accounts', icon: '🛡️' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  const isActive = (path: string) => location.pathname === path

  const handleLogout = () => {
    dispatch(logout())
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    navigate('/login')
  }

  return (
    <Box
      sx={{
        height: '100%',
        background: (theme) => `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 45%, ${theme.palette.primary.main} 100%)`,
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseLeave={onMouseLeave}
    >
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          Road Accident
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Emergency Response
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

      <Box sx={{ flex: 1, px: 1.5, py: 2 }}>
        <Typography variant="overline" sx={{ px: 1.5, opacity: 0.75 }}>
          Main Menu
        </Typography>
        <List dense sx={{ mt: 1 }}>
        {menuItems.map((item, index) => {
          const isItemActive = isActive(item.path)
          return (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={isItemActive}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: 'white',
                '&.Mui-selected': {
                  bgcolor: (theme) => alpha(theme.palette.common.white, 0.22),
                },
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.common.white, 0.12),
                },
              }}
            >
              <Typography sx={{ mr: 1.5 }}>{item.icon}</Typography>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
            </ListItemButton>
          )
        })}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

      <Box sx={{ p: 2 }}>
        <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }} elevation={0}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Avatar sx={{ bgcolor: 'warning.main', color: 'white', width: 34, height: 34, fontSize: 14 }}>
              {(user?.displayName?.[0] || user?.officerId?.[0] || 'U').toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>
                {user?.displayName || user?.officerId || 'Officer'}
              </Typography>
              <Typography noWrap sx={{ fontSize: 11, opacity: 0.85 }}>
                ID: {user?.officerId || 'N/A'}
              </Typography>
            </Box>
          </Box>

          <Button fullWidth size="small" variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', mb: 1 }} onClick={() => navigate('/settings')}>
            Open Settings
          </Button>
          <Button fullWidth size="small" variant="contained" color="error" onClick={handleLogout}>
            Sign Out
          </Button>
        </Paper>
      </Box>
    </Box>
  )
}
