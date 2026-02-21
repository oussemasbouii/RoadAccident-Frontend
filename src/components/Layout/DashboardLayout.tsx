import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Box, useMediaQuery, useTheme, Drawer } from '@mui/material'
import { useAppDispatch } from '../../store/store'
import { prependIncomingAlert } from '../../features/alerts/slices/alertsSlice'
import { prependIncomingIncident } from '../../features/incidents/slices/incidentsSlice'
import { prependIncomingReport } from '../../features/reports/slices/reportsSlice'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const SIDEBAR_WIDTH = 280
const COLLAPSED_SIDEBAR_WIDTH = 88

export default function DashboardLayout() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)

  // Sync sidebar state with mobile/desktop view
  useEffect(() => {
    setSidebarOpen(!isMobile)
  }, [isMobile])

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) return

    const socket = io('https://micladevops.com', {
      path: '/api/v2/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    })

    const onNotification = (payload: any) => {
      const data = payload?.data || payload?.alert || payload?.incident || payload?.report || payload
      const type = (payload?.type || data?.type || '').toString().toLowerCase()

      const isAlertLike =
        type.includes('alert') ||
        Boolean(data?.alertId) ||
        (typeof data?.latitude === 'number' && typeof data?.longitude === 'number')

      const isIncidentLike =
        type.includes('incident') ||
        type.includes('accident') ||
        Boolean(data?.incidentId || data?.accidentId) ||
        data?.status === 'active' || data?.status === 'responded' || data?.status === 'resolved'

      const isReportLike =
        type.includes('report') ||
        Boolean(data?.reportId) ||
        (typeof data?.title === 'string' && type.includes('analytics'))

      if (isAlertLike) dispatch(prependIncomingAlert(data))
      if (isIncidentLike) dispatch(prependIncomingIncident(data))
      if (isReportLike) dispatch(prependIncomingReport(data))
    }

    socket.on('notification', onNotification)
    socket.on('action:alert:send', onNotification)
    socket.on('alert', onNotification)
    socket.on('incident', onNotification)
    socket.on('accident', onNotification)
    socket.on('report', onNotification)

    return () => {
      socket.off('notification', onNotification)
      socket.off('action:alert:send', onNotification)
      socket.off('alert', onNotification)
      socket.off('incident', onNotification)
      socket.off('accident', onNotification)
      socket.off('report', onNotification)
      socket.disconnect()
    }
  }, [dispatch])

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  const drawerTransition = theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: sidebarOpen 
      ? theme.transitions.duration.enteringScreen 
      : theme.transitions.duration.leavingScreen,
  })

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={sidebarOpen}
        onClose={toggleSidebar}
        sx={{
          width: sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          '& .MuiDrawer-paper': {
            width: sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH,
            transition: drawerTransition,
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
          },
        }}
      >
        <Sidebar collapsed={!sidebarOpen} />
      </Drawer>

      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minWidth: 0,
          width: '100%',
        }}
      >
        <Topbar onMenuClick={toggleSidebar} />
        <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
          <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto', width: '100%' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
