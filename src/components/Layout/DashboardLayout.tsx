import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Box, IconButton, Paper } from '@mui/material'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { useAppDispatch } from '../../store/store'
import { prependIncomingAlert } from '../../features/alerts/slices/alertsSlice'
import { prependIncomingIncident } from '../../features/incidents/slices/incidentsSlice'
import { prependIncomingReport } from '../../features/reports/slices/reportsSlice'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const SIDEBAR_WIDTH = 280

export default function DashboardLayout() {
  const dispatch = useAppDispatch()
  const [sidebarOpen, setSidebarOpen] = useState(true)

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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          transition: 'width 200ms ease',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        onMouseEnter={() => setSidebarOpen(true)}
      >
        <Sidebar onMouseLeave={() => setSidebarOpen(false)} />
      </Box>

      {!sidebarOpen && (
        <Paper elevation={6} sx={{ position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 1400, borderRadius: '0 12px 12px 0' }}>
          <IconButton color="primary" onClick={() => setSidebarOpen(true)} onMouseEnter={() => setSidebarOpen(true)}>
            <MenuOpenIcon />
          </IconButton>
        </Paper>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
          <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto', width: '100%' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
