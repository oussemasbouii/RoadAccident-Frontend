import { useEffect } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchAlerts, markAlertAsRead } from '../slices/alertsSlice'
import Card from '../../../components/Common/Card'
import Badge from '../../../components/Common/Badge'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'

export default function AlertsPage() {
  const dispatch = useAppDispatch()
  const { list: alerts, unreadCount, loading } = useAppSelector((state) => state.alerts)

  useEffect(() => {
    dispatch(fetchAlerts({ page: 1, limit: 50 }) as any)
  }, [dispatch])

  const displayedAlerts = alerts || []
  const displayedUnreadCount = typeof unreadCount === 'number'
    ? unreadCount
    : displayedAlerts.filter((a: any) => !a.read).length

  const criticalAlerts = displayedAlerts.filter((a: any) => a.severity === 'critical').length

  const typeIcon = {
    traffic: '🚗',
    weather: '⛈️',
    hazard: '⚠️',
    system: '⚙️',
  }

  const severityColor: Record<'critical' | 'high' | 'medium' | 'low', 'danger' | 'warning' | 'info' | 'success'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'success',
  }

  const typeColor: Record<'traffic' | 'weather' | 'hazard' | 'system', 'info' | 'warning' | 'danger' | 'success'> = {
    traffic: 'info',
    weather: 'warning',
    hazard: 'danger',
    system: 'success',
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>Alerts & Notifications</Typography>
          <Typography color="text.secondary">Stay updated with system and road alerts</Typography>
        </Box>
        <ExportButton
          data={displayedAlerts || []}
          filename="alerts"
          label="Export Alerts"
        />
      </Box>

      {/* Statistics cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatCard icon="🔔" label="Unread Alerts" value={displayedUnreadCount} trend="up" trendValue={displayedUnreadCount > 0 ? `${displayedUnreadCount} new` : 'All read'} />
        <StatCard icon="🔴" label="Critical Alerts" value={criticalAlerts} trend={criticalAlerts > 0 ? 'up' : 'down'} trendValue={criticalAlerts > 0 ? 'Needs attention' : 'None'} />
        <StatCard icon="📊" label="Total Alerts" value={displayedAlerts.length} trend="neutral" trendValue="This session" />
        <StatCard icon="✅" label="Resolved" value={displayedAlerts.length > 0 ? displayedAlerts.filter((a: any) => a.read).length : 0} trend="up" trendValue={displayedAlerts.length > 0 ? `${Math.round((displayedAlerts.filter((a: any) => a.read).length / displayedAlerts.length) * 100)}%` : '0%'} />
      </Box>

      {/* Alerts list */}
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Active Alerts</Typography>
          {displayedUnreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => {
                displayedAlerts
                  .filter((a: any) => !a.read)
                  .forEach((a: any) => dispatch(markAlertAsRead(a.id) as any))
              }}
            >
              Mark all as read
            </Button>
          )}
        </Box>

        {displayedAlerts.length === 0 ? (
          <Card>
            <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No alerts at this time</Typography></Box>
          </Card>
        ) : (
          <Stack spacing={1.5}>{displayedAlerts.map((alert: any) => (
            <Card
              key={alert.id}
              className="p-4"
              hoverable
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Typography sx={{ fontSize: 24 }}>{typeIcon[alert.type as 'traffic' | 'weather' | 'hazard' | 'system']}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700 }}>{alert.title}</Typography>
                    <Badge label={alert.type.toUpperCase()} variant={typeColor[alert.type as 'traffic' | 'weather' | 'hazard' | 'system']} size="sm" />
                    <Badge label={alert.severity.toUpperCase()} variant={severityColor[alert.severity as 'critical' | 'high' | 'medium' | 'low']} size="sm" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{alert.description}</Typography>
                  <Typography variant="caption" color="text.secondary">{alert.time}</Typography>
                </Box>
                {!alert.read && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    onClick={() => dispatch(markAlertAsRead(alert.id) as any)}
                  >
                    Mark as read
                  </Button>
                )}
              </Box>
            </Card>
          ))}</Stack>
        )}
      </Stack>
    </Stack>
  )
}
