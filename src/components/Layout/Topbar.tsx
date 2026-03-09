import { useEffect, useMemo, useState } from 'react'
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
  CircularProgress,
} from '@mui/material'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

import { RootState } from '../../store/store'
import { logout } from '../../features/auth/slices/authSlice'
import { fetchAlerts, markAlertAsRead } from '../../features/alerts/slices/alertsSlice'
import { apiService } from '../../services/api'
import { useThemeMode } from '../../themeMode'

interface TopbarProps {
  onMenuClick?: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null)
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const theme = useTheme()
  const unreadAlerts = useSelector((state: RootState) => state.alerts?.unreadCount || 0)
  const alerts = useSelector((state: RootState) => state.alerts?.list || [])
  const alertsLoading = useSelector((state: RootState) => state.alerts?.loading || false)
  const user = useSelector((state: RootState) => state.auth.user)
  const { mode, toggleMode } = useThemeMode()

  const receivedAlerts = useMemo(
    () => (alerts as any[]).filter((alert) => alert.direction !== 'sent').slice(0, 6),
    [alerts]
  )

  useEffect(() => {
    dispatch(fetchAlerts({ page: 1, limit: 20 }) as any)
  }, [dispatch])

  useEffect(() => {
    const senderIds = Array.from(
      new Set(
        receivedAlerts
          .map((alert: any) => String(alert.senderId || '').trim())
          .filter(Boolean)
      )
    )
    const missingIds = senderIds.filter((id) => !senderNames[id])
    if (missingIds.length === 0) return

    let mounted = true

    const loadSenderNames = async () => {
      const settled = await Promise.allSettled(
        missingIds.map(async (id) => {
          const resp = await apiService.users.getById(id)
          const raw = resp.data?.data ?? resp.data
          const firstName = String(raw?.firstName ?? '').trim()
          const lastName = String(raw?.lastName ?? '').trim()
          const displayName = String(raw?.displayName ?? '').trim()
          const fullName = `${firstName} ${lastName}`.trim() || displayName
          return { id, fullName: fullName || 'Unknown sender' }
        })
      )

      if (!mounted) return
      setSenderNames((prev) => {
        const next = { ...prev }
        settled.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.id] = result.value.fullName
          }
        })
        return next
      })
    }

    loadSenderNames()

    return () => {
      mounted = false
    }
  }, [receivedAlerts, senderNames])

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
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, mr: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 11 }}>
              Tunisia Operations Center
            </Typography>
          </Box>

          <IconButton
            onClick={(e) => {
              dispatch(fetchAlerts({ page: 1, limit: 20 }) as any)
              setNotificationsAnchor(e.currentTarget)
            }}
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
            minWidth: 340,
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
          {alertsLoading && receivedAlerts.length === 0 ? (
            <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={22} />
            </Box>
          ) : receivedAlerts.length === 0 ? (
            <Box sx={{ py: 3, px: 2.5 }}>
              <Typography variant="body2" color="text.secondary">No received alerts.</Typography>
            </Box>
          ) : (
            receivedAlerts.map((alert: any) => (
              <MenuItem key={alert.id} sx={{ py: 1.5, px: 2.5, gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ p: 1, borderRadius: 'var(--radius-m3-md, 12px)', bgcolor: alpha(alert.read ? theme.palette.success.main : theme.palette.warning.main, 0.15), color: alert.read ? 'success.main' : 'warning.main' }}>
                  <NotificationsNoneRoundedIcon fontSize="small" />
                </Box>
                <ListItemText
                  primary={
                    alert.senderId && senderNames[alert.senderId]
                      ? `From: ${senderNames[alert.senderId]}`
                      : 'From: Unknown sender'
                  }
                  secondary={`${alert.time || 'Just now'} - ${alert.comment || 'No comment'}`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                  secondaryTypographyProps={{ variant: 'caption', sx: { mt: 0.5, display: 'block' } }}
                />
                {!alert.read && (
                  <IconButton
                    size="small"
                    onClick={(evt) => {
                      evt.stopPropagation()
                      dispatch(markAlertAsRead(alert.id) as any)
                    }}
                    sx={{
                      mt: 0.25,
                      color: 'success.main',
                      bgcolor: alpha(theme.palette.success.main, 0.12),
                      '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.2) }
                    }}
                  >
                    <CheckCircleRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </MenuItem>
            ))
          )}
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <MenuItem onClick={() => { navigate('/alerts'); setNotificationsAnchor(null); }} sx={{ borderRadius: 'var(--radius-m3-md, 12px)', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>View All Notifications</Typography>
          </MenuItem>
        </Box>
      </Menu>

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
