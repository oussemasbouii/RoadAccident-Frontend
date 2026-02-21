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
  alpha,
  Divider,
  ListItemIcon,
  ListItemText,
  useTheme,
  InputBase,
} from '@mui/material'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'

import { RootState } from '../../store/store'
import { logout } from '../../features/auth/slices/authSlice'
import { useThemeMode } from '../../themeMode'

interface TopbarProps {
  onMenuClick?: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null)
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const theme = useTheme()
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
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <AppBar 
      position="sticky" 
      color="inherit" 
      elevation={0} 
      sx={{ 
        bgcolor: alpha(theme.palette.background.default, 0.8),
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid', 
        borderColor: 'divider',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, px: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <IconButton
            onClick={onMenuClick}
            edge="start"
            sx={{ 
              color: 'text.primary',
              bgcolor: alpha(theme.palette.action.active, 0.04),
              '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.08) }
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
          
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              bgcolor: alpha(theme.palette.action.active, 0.05),
              borderRadius: 'var(--radius-m3-full, 100px)',
              px: 2,
              py: 0.75,
              width: '100%',
              maxWidth: 400,
              border: '1px solid transparent',
              transition: 'all 0.2s',
              '&:focus-within': {
                bgcolor: 'background.paper',
                borderColor: 'primary.main',
                boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.1)}`
              }
            }}
          >
            <SearchRoundedIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
            <InputBase
              placeholder="Search incidents, staff, reports..."
              sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, mr: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 11 }}>
              Tunisia Operations Center
            </Typography>
          </Box>

          <IconButton 
            onClick={(e) => setNotificationsAnchor(e.currentTarget)}
            sx={{ 
              bgcolor: alpha(theme.palette.action.active, 0.04),
              '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.08) }
            }}
          >
            <Badge 
              badgeContent={unreadAlerts} 
              color="error" 
              max={99}
              sx={{ '& .MuiBadge-badge': { fontWeight: 700, border: `2px solid ${theme.palette.background.default}` } }}
            >
              <NotificationsNoneRoundedIcon />
            </Badge>
          </IconButton>

          <IconButton 
            onClick={toggleMode}
            sx={{ 
              bgcolor: alpha(theme.palette.action.active, 0.04),
              '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.08) }
            }}
          >
            {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
          </IconButton>

          <Box
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
            sx={{ 
              ml: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              p: 0.5,
              pr: { xs: 0.5, md: 2 },
              borderRadius: 100,
              transition: 'all 0.2s',
              '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.04) }
            }}
          >
            <Avatar 
              sx={{ 
                width: 36, 
                height: 36, 
                bgcolor: 'primary.main', 
                fontSize: 14,
                fontWeight: 700,
                boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role || 'Officer'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Toolbar>

      {/* Notifications Menu */}
      <Menu 
        anchorEl={notificationsAnchor} 
        open={Boolean(notificationsAnchor)} 
        onClose={() => setNotificationsAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { 
            borderRadius: 'var(--radius-m3-xl, 24px)', 
            mt: 1, 
            minWidth: 320, 
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            border: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
        <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 800 }}>Notifications</Typography>
          {unreadAlerts > 0 && (
            <Badge badgeContent={unreadAlerts} color="primary" sx={{ mr: 1 }} />
          )}
        </Box>
        <Divider />
        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {[...Array(3)].map((_, i) => (
            <MenuItem key={i} sx={{ py: 2, px: 2.5, gap: 2 }}>
              <Box sx={{ p: 1, borderRadius: 'var(--radius-m3-md, 12px)', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                <NotificationsNoneRoundedIcon fontSize="small" />
              </Box>
              <ListItemText 
                primary="New Alert Protocol" 
                secondary="2 minutes ago • Emergency"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                secondaryTypographyProps={{ variant: 'caption', sx: { mt: 0.5, display: 'block' } }}
              />
            </MenuItem>
          ))}
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <MenuItem onClick={() => { navigate('/alerts'); setNotificationsAnchor(null); }} sx={{ borderRadius: 'var(--radius-m3-md, 12px)', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>View All Notifications</Typography>
          </MenuItem>
        </Box>
      </Menu>

      {/* User Profile Menu */}
      <Menu 
        anchorEl={userMenuAnchor} 
        open={Boolean(userMenuAnchor)} 
        onClose={() => setUserMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { 
            borderRadius: 'var(--radius-m3-xl, 24px)', 
            mt: 1, 
            minWidth: 240, 
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            border: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
        <Box sx={{ p: 2.5, pb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{displayName}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            ID: {user?.officerId || 'N/A'}
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <MenuItem 
            onClick={() => {
              navigate('/settings')
              setUserMenuAnchor(null)
            }}
            sx={{ py: 1.5, px: 2, borderRadius: 'var(--radius-m3-md, 12px)' }}
          >
            <ListItemIcon sx={{ color: 'text.secondary' }}>
              <AccountCircleRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="My Profile" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
          <MenuItem 
            onClick={() => {
              navigate('/settings')
              setUserMenuAnchor(null)
            }}
            sx={{ py: 1.5, px: 2, borderRadius: 'var(--radius-m3-md, 12px)' }}
          >
            <ListItemIcon sx={{ color: 'text.secondary' }}>
              <SettingsRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Account Settings" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <MenuItem 
            onClick={handleLogout} 
            sx={{ 
              py: 1.5, 
              px: 2, 
              borderRadius: 'var(--radius-m3-md, 12px)',
              color: 'error.main',
              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) }
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <LogoutRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sign Out" primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }} />
          </MenuItem>
        </Box>
      </Menu>
    </AppBar>
  )
}
