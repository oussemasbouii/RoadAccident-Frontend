import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Box, Stack, Typography } from '@mui/material'
import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchIncidents } from '../../incidents/slices/incidentsSlice'
import { fetchAlerts } from '../../alerts/slices/alertsSlice'
import Card from '../../../components/Common/Card'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import Badge from '../../../components/Common/Badge'

export default function DashboardPage() {
  const dispatch = useAppDispatch()
  const { list: incidents, loading: incidentsLoading, error: incidentsError, stats: incidentStats } = useAppSelector((state) => state.incidents)
  const { list: alerts, unreadCount, loading: alertsLoading, error: alertsError } = useAppSelector((state) => state.alerts)

  useEffect(() => {
    dispatch(fetchIncidents({ page: 1, limit: 5 }) as any)
    dispatch(fetchAlerts({ page: 1, limit: 20 }) as any)
  }, [dispatch])

  const stats = [
    {
      icon: '🚨',
      label: 'Open Incidents',
      value: incidents.filter((i: any) => i.status !== 'resolved').length,
      trend: 'neutral',
      trendValue: `${incidents.length} total`,
      intent: 'danger',
    },
    {
      icon: '🔔',
      label: 'Unread Alerts',
      value: unreadCount,
      trend: unreadCount > 0 ? 'up' : 'neutral',
      trendValue: `${unreadCount} unread`,
      intent: 'warning',
    },
    {
      icon: '📍',
      label: 'Unique Locations',
      value: new Set(incidents.map((i: any) => i.location)).size,
      trend: 'neutral',
      trendValue: 'Active zones',
      intent: 'info',
    },
    {
      icon: '⏱️',
      label: 'Avg Response',
      value: incidentStats.avgResponseTime > 0 ? `${incidentStats.avgResponseTime} min` : 'N/A',
      trend: 'neutral',
      trendValue: 'From backend',
      intent: 'info',
    },
  ]

  const recentIncidents = incidents.slice(0, 5)
  const recentAlerts = alerts.slice(0, 3)
  const resolvedIncidents = incidents.filter((i: any) => i.status === 'resolved').length
  const resolutionRate = incidents.length > 0 ? Math.round((resolvedIncidents / incidents.length) * 100) : 0
  const totalInjuries = incidents.reduce((sum: number, i: any) => sum + Number(i.injuries || 0), 0)
  const apiHealthy = !incidentsError && !alertsError

  const severityColor: Record<'critical' | 'high' | 'medium' | 'low', 'danger' | 'warning' | 'info' | 'success'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'success',
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ p: 4, borderRadius: 3, color: 'white', background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})` }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Welcome to Road Accident Response System</Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Real-time monitoring and coordination of emergency response for road accidents
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        {stats.map((stat, idx) => (
          <Box key={idx}><StatCard icon={stat.icon} label={stat.label} value={stat.value} trend={stat.trend as 'up' | 'down' | 'neutral'} trendValue={stat.trendValue} intent={stat.intent as 'default' | 'success' | 'warning' | 'danger' | 'info'} /></Box>
        ))}
      </Box>

      {/* Main content grid */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <Box>
          <Card>
            <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">Recent Incidents</Typography>
                <Link to="/incidents">
                  <Button variant="secondary" size="sm">View all →</Button>
                </Link>
            </Box>
            <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {recentIncidents.length === 0 ? (
                <Box sx={{ p: 2.5, color: 'text.secondary' }}>
                  {incidentsLoading ? 'Loading incidents...' : 'No incidents returned from backend yet.'}
                </Box>
              ) : (
                recentIncidents.map((incident: any) => (
                  <Box
                    key={incident.id}
                    sx={{ p: 2.5 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box><Typography sx={{ fontWeight: 700 }}>{incident.location}</Typography><Typography variant="body2" color="text.secondary">{incident.time}</Typography></Box>
                      <Badge
                        label={incident.severity.toUpperCase()}
                        variant={severityColor[incident.severity as 'critical' | 'high' | 'medium' | 'low']}
                        size="sm"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">🚗 {incident.vehicles} vehicles</Typography>
                  </Box>
                ))
              )}
            </Stack>
          </Card>
        </Box>

        {/* Quick actions */}
        <Box><Stack spacing={2}>
          <Card>
            <Box sx={{ p: 2.5 }}><Typography variant="h6" sx={{ mb: 2 }}>Quick Actions</Typography><Stack spacing={1.2}><Button variant="primary">🚨 Report Incident</Button><Button variant="secondary">📲 Receive Alerts</Button><Button variant="secondary">👥 Contact Responders</Button><Button variant="secondary">⚙️ Settings</Button></Stack></Box>
          </Card>

          {/* System status */}
          <Card>
            <Box sx={{ p: 2.5 }}><Typography variant="h6" sx={{ mb: 2 }}>System Status</Typography><Stack spacing={1.1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">API Status</Typography>
                  <Badge label={apiHealthy ? 'Online' : 'Issue'} variant={apiHealthy ? 'success' : 'danger'} size="sm" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Incidents API</Typography>
                  <Badge label={incidentsError ? 'Error' : 'Connected'} variant={incidentsError ? 'danger' : 'success'} size="sm" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Alerts API</Typography>
                  <Badge label={alertsError ? 'Error' : 'Connected'} variant={alertsError ? 'danger' : 'success'} size="sm" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Response Team</Typography>
                  <Badge label={incidentsLoading || alertsLoading ? 'Syncing' : 'Active'} variant={incidentsLoading || alertsLoading ? 'warning' : 'success'} size="sm" />
                </Box>
              </Stack></Box>
          </Card>
        </Stack></Box>
      </Box>

      {/* Information cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Card>
          <Box sx={{ p: 2.5 }}><Typography variant="h6" sx={{ mb: 1.5 }}>🎯 Today's Performance</Typography><Stack spacing={1}>{[
            ['Incidents Handled', incidents.length],
            ['Avg Response Time', incidentStats.avgResponseTime > 0 ? `${incidentStats.avgResponseTime} minutes` : 'N/A'],
            ['Resolution Rate', `${resolutionRate}%`],
            ['People Assisted', totalInjuries],
          ].map(([k,v]) => (<Box key={String(k)} sx={{ display:'flex', justifyContent:'space-between' }}><Typography variant="body2" color="text.secondary">{k}</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{v}</Typography></Box>))}</Stack></Box>
        </Card>

        <Card>
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>📣 Latest Updates</Typography>
            <Stack spacing={1}>
              {recentAlerts.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {alertsLoading ? 'Loading alerts...' : 'No updates available from backend.'}
                </Typography>
              ) : (
                recentAlerts.map((alert: any, idx: number) => (
                  <Box key={alert.id || idx} sx={{ pb: idx < recentAlerts.length - 1 ? 1 : 0, borderBottom: idx < recentAlerts.length - 1 ? 1 : 0, borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{alert.title || 'Alert update'}</Typography>
                    <Typography variant="caption" color="text.secondary">{alert.time || alert.description || 'Updated recently'}</Typography>
                  </Box>
                ))
              )}
            </Stack>
          </Box>
        </Card>
      </Box>
    </Stack>
  )
}
