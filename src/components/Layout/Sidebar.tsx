import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  alpha,
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
} from '@mui/material'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded'
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import LocationSearchingRoundedIcon from '@mui/icons-material/LocationSearchingRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'

import { RootState } from '../../store/store'
import { logout } from '../../features/auth/slices/authSlice'
import { clearAuthStorage } from '../../utils/authSecurity'

interface SidebarProps {
  collapsed?: boolean
}

export default function Sidebar({ collapsed = false }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector((state: RootState) => state.auth.user)

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardRoundedIcon /> },
    { path: '/incidents', label: 'Accidents', icon: <ReportProblemRoundedIcon /> },
    { path: '/alerts', label: 'Alerts', icon: <NotificationsActiveRoundedIcon /> },
    { path: '/reports', label: 'Reports', icon: <BarChartRoundedIcon /> },
    { path: '/admin/accounts', label: 'User Accounts', icon: <AdminPanelSettingsRoundedIcon />, role: 'admin' },
    { path: '/admin/officer-tracking', label: 'Officer Tracking', icon: <LocationSearchingRoundedIcon />, role: 'admin' },
    { path: '/settings', label: 'Settings', icon: <SettingsRoundedIcon /> },
  ]

  const filteredMenuItems = menuItems.filter(item => !item.role || user?.role === item.role)
  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  const handleLogout = () => {
    dispatch(logout())
    clearAuthStorage()
    navigate('/login')
  }

  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: (theme) => theme.transitions.create(['width'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.standard,
        }),
      }}
    >
      {/* Brand Header */}
      <Box sx={{ 
        px: collapsed ? 2.5 : 3, 
        py: 3, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        minHeight: 88,
        transition: (theme) => theme.transitions.create(['padding', 'gap'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.standard,
        }),
      }}>
        <Box sx={{ 
          p: 1.25, 
          borderRadius: 'var(--radius-m3-md, 12px)', 
          bgcolor: 'primary.main', 
          color: 'white', 
          display: 'flex',
          boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.25)}`,
          flexShrink: 0
        }}>
          <ReportProblemRoundedIcon />
        </Box>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 800, 
            letterSpacing: -0.5,
            color: 'text.primary',
            whiteSpace: 'nowrap',
            opacity: collapsed ? 0 : 1,
            visibility: collapsed ? 'hidden' : 'visible',
            transition: (theme) => theme.transitions.create(['opacity', 'visibility'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          }}
        >
          RoadAccident
        </Typography>
      </Box>

      {/* Navigation List */}
      <Box sx={{ flex: 1, px: 2, py: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Typography 
          variant="overline" 
          sx={{ 
            px: 2, 
            mb: 1.5, 
            display: 'block', 
            color: 'text.secondary', 
            fontWeight: 700,
            letterSpacing: 1.2,
            opacity: collapsed ? 0 : 0.7,
            visibility: collapsed ? 'hidden' : 'visible',
            transition: (theme) => theme.transitions.create(['opacity', 'visibility'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          }}
        >
          Main Menu
        </Typography>

        <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {filteredMenuItems.map((item) => {
            const isItemActive = isActive(item.path)
            const content = (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                selected={isItemActive}
                sx={{
                  borderRadius: 100,
                  py: 1.5,
                  px: collapsed ? 2 : 2.5,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  minHeight: 56,
                  transition: (theme) => theme.transitions.create(['padding', 'background-color'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.standard,
                  }),
                  '&.Mui-selected': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18),
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                      transform: 'scale(1.1)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: collapsed ? 0 : 44, 
                  color: isItemActive ? 'primary.main' : 'text.secondary',
                  transition: (theme) => theme.transitions.create(['min-width', 'color', 'transform'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.standard,
                  }),
                  justifyContent: 'center'
                }}>
                  {item.icon}
                </ListItemIcon>
                
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    variant: 'body2',
                    sx: { 
                      fontWeight: isItemActive ? 700 : 500,
                      whiteSpace: 'nowrap',
                      opacity: collapsed ? 0 : 1,
                      visibility: collapsed ? 'hidden' : 'visible',
                      transition: (theme) => theme.transitions.create(['opacity', 'visibility'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.standard,
                      }),
                    } 
                  }} 
                />
              </ListItemButton>
            )

            return collapsed ? (
              <Tooltip key={item.path} title={item.label} placement="right">
                {content}
              </Tooltip>
            ) : content
          })}
        </List>
      </Box>

      <Divider sx={{ mx: collapsed ? 1 : 2, my: 1, opacity: 0.5, transition: 'margin 0.2s' }} />

      {/* User Profile Section */}
      <Box sx={{ p: 2, mt: 'auto' }}>
        <Box 
          sx={{ 
            p: 1.5, 
            borderRadius: 'var(--radius-m3-xl, 24px)',
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 2,
            transition: (theme) => theme.transitions.create(['padding', 'gap'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
            bgcolor: (theme) => alpha(theme.palette.action.active, 0.03),
            '&:hover': { bgcolor: (theme) => alpha(theme.palette.action.active, 0.06) }
          }} 
        >
          <Tooltip title={collapsed ? user?.displayName || 'User' : ''} placement="right">
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'white', 
                width: 44, 
                height: 44,
                fontSize: 16,
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
              }}
            >
              {((user?.displayName?.[0]) || (user?.officerId?.[0]) || 'U').toUpperCase()}
            </Avatar>
          </Tooltip>
          
          <Box sx={{ 
            minWidth: 0, 
            flex: 1,
            opacity: collapsed ? 0 : 1,
            visibility: collapsed ? 'hidden' : 'visible',
            transition: (theme) => theme.transitions.create(['opacity', 'visibility'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
              {user?.displayName || user?.officerId || 'Officer'}
            </Typography>
            <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary', opacity: 0.8 }}>
              {(user?.role || 'officer').toUpperCase()}
            </Typography>
          </Box>

          {!collapsed && (
            <Tooltip title="Sign Out">
              <IconButton
                onClick={handleLogout}
                sx={{
                  color: 'error.main',
                  '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.08) }
                }}
              >
                <LogoutRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        
        {collapsed && (
          <Tooltip title="Sign Out" placement="right">
            <IconButton
              onClick={handleLogout}
              sx={{
                width: '100%',
                borderRadius: 3,
                mt: 1,
                py: 1.5,
                color: 'error.main',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.08) }
              }}
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
