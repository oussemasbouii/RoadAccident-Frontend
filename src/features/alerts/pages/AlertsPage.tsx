import { useEffect, useMemo, useState } from 'react'
import {
  Alert as MuiAlert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'

import { apiService } from '../../../services/api'
import { useAppDispatch, useAppSelector } from '../../../store/store'
import { createAlert, fetchAlerts, markAlertAsRead } from '../slices/alertsSlice'
import Card from '../../../components/Common/Card'
import Button from '../../../components/Common/Button'
import StatCard from '../../../components/Common/StatCard'
import AccidentLocationMap from '../../../components/Common/AccidentLocationMap'
import AlertsMap from '../../../components/Common/AlertsMap'
import { ExportButton } from '../../../components/Common'

interface RecipientOption {
  id: string
  label: string
  sublabel?: string
}

export default function AlertsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const { list: alerts, unreadCount, loading, error } = useAppSelector((state) => state.alerts)

  const [tab, setTab] = useState<'received' | 'sent'>('received')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([])
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [sendMessage, setSendMessage] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [form, setForm] = useState({
    recipientIds: [] as string[],
    latitude: '',
    longitude: '',
    comment: '',
  })

  useEffect(() => {
    dispatch(fetchAlerts({ page: 1, limit: 50 }) as any)
  }, [dispatch])

  useEffect(() => {
    const loadRecipients = async () => {
      try {
        setRecipientLoading(true)
        setRecipientError(null)
        const resp = await apiService.users.list({ page: 1, limit: 100 })
        const raw = resp.data?.data ?? resp.data?.items ?? resp.data?.rows ?? resp.data?.users ?? resp.data
        const rows = Array.isArray(raw) ? raw : []
        const mapped = rows.map((row: any) => {
          const id = String(row?.id ?? row?._id ?? row?.officerId ?? '')
          const firstName = String(row?.firstName ?? '').trim()
          const lastName = String(row?.lastName ?? '').trim()
          const officerId = String(row?.officerId ?? '').trim()
          const fullName = `${firstName} ${lastName}`.trim()
          const label = fullName || officerId || id
          return {
            id,
            label,
            sublabel: officerId && fullName ? officerId : undefined,
          }
        }).filter((row: RecipientOption) => Boolean(row.id))
        setRecipientOptions(mapped)
      } catch (err: any) {
        setRecipientOptions([])
        setRecipientError(err?.response?.data?.message || err?.message || 'Failed to load recipients')
      } finally {
        setRecipientLoading(false)
      }
    }

    loadRecipients()
  }, [])

  const sentAlerts = useMemo(() => alerts.filter((a: any) => a.direction === 'sent'), [alerts])
  const receivedAlerts = useMemo(() => alerts.filter((a: any) => a.direction !== 'sent'), [alerts])
  const activeList = tab === 'received' ? receivedAlerts : sentAlerts

  useEffect(() => {
    const senderIds = Array.from(
      new Set(
        receivedAlerts
          .map((alert: any) => String(alert.senderId || '').trim())
          .filter(Boolean)
      )
    ) as string[]
    const missingIds = senderIds.filter((id) => !senderNames[id])
    if (missingIds.length === 0) return

    let mounted = true

    const loadSenderNames = async () => {
      const settled = await Promise.allSettled<{ id: string; fullName: string }>(
        missingIds.map(async (id: string) => {
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

  const mapAlerts = useMemo(
    () =>
      alerts.map((alert: any) => ({
        id: alert.id,
        title: alert.title,
        comment: alert.comment || alert.description,
        time: alert.time,
        latitude: alert.latitude,
        longitude: alert.longitude,
        direction: alert.direction,
        read: alert.read,
      })),
    [alerts]
  )

  const displayedAlerts = activeList.filter((alert: any) => {
    const text = `${alert.title} ${alert.description} ${alert.comment || ''}`.toLowerCase()
    const matchesSearch = !search || text.includes(search.toLowerCase())
    const matchesStatus = tab === 'sent'
      ? true
      : statusFilter === 'all'
        ? true
        : statusFilter === 'unread'
          ? !alert.read
          : alert.read
    return matchesSearch && matchesStatus
  })

  const sentAcknowledgedRate = sentAlerts.length === 0
    ? 0
    : Math.round(
      sentAlerts.reduce((sum: number, alert: any) => {
        const total = Number(alert.recipientCount || 0)
        const ack = Number(alert.acknowledgedCount || 0)
        return sum + (total > 0 ? ack / total : 0)
      }, 0) / sentAlerts.length * 100
    )

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSendError('Geolocation is not supported on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }))
      },
      (geoError) => {
        if (geoError.code === 1) {
          setSendError('Location permission denied. Enter coordinates manually.')
          return
        }
        setSendError('Unable to retrieve your location. Enter coordinates manually.')
      }
    )
  }

  const handleSendAlert = async () => {
    setSendError(null)
    setSendMessage(null)

    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)
    const comment = form.comment.trim()

    if (form.recipientIds.length === 0) {
      setSendError('Select at least one recipient.')
      return
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setSendError('Latitude and longitude must be valid numbers.')
      return
    }
    if (!comment) {
      setSendError('Write a short alert comment before sending.')
      return
    }

    try {
      await dispatch(createAlert({
        recipientIds: form.recipientIds,
        latitude,
        longitude,
        comment,
      }) as any).unwrap()
      setSendMessage('Alert sent successfully.')
      setForm({
        recipientIds: [],
        latitude: '',
        longitude: '',
        comment: '',
      })
      dispatch(fetchAlerts({ page: 1, limit: 50 }) as any)
    } catch (err: any) {
      setSendError(err || 'Failed to send alert')
    }
  }

  const handleAcknowledge = async (alertId: string) => {
    await dispatch(markAlertAsRead(alertId) as any)
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>Alerts Operations</Typography>
          <Typography color="text.secondary">Send location alerts, track delivery, and acknowledge received alerts</Typography>
        </Box>
        <ExportButton
          data={alerts || []}
          filename="alerts-operations"
          label="Export Alerts"
          title="Alert Operations"
          variant="alerts"
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatCard icon={<NotificationsActiveRoundedIcon />} label="Received Alerts" value={receivedAlerts.length} trend="neutral" trendValue={`${unreadCount} unread`} intent="warning" />
        <StatCard icon={<SendRoundedIcon />} label="Sent Alerts" value={sentAlerts.length} trend="neutral" trendValue="Delivered to recipients" intent="info" />
        <StatCard icon={<CheckCircleRoundedIcon />} label="Acknowledged Rate" value={`${sentAcknowledgedRate}%`} trend={sentAcknowledgedRate >= 50 ? 'up' : 'neutral'} trendValue="For sent alerts" intent="success" />
        <StatCard icon={<PublicRoundedIcon />} label="Unread Received" value={unreadCount} trend={unreadCount > 0 ? 'up' : 'down'} trendValue={unreadCount > 0 ? 'Needs action' : 'All acknowledged'} intent="danger" />
      </Box>

      <Card sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <GroupRoundedIcon color="primary" fontSize="small" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Compose Alert</Typography>
        </Stack>

        <Stack spacing={2}>
          {sendError && <MuiAlert severity="error">{sendError}</MuiAlert>}
          {sendMessage && <MuiAlert severity="success">{sendMessage}</MuiAlert>}
          {recipientError && <MuiAlert severity="warning">{recipientError}</MuiAlert>}

          <FormControl fullWidth size="small">
            <InputLabel id="recipients-label">Recipients</InputLabel>
            <Select
              labelId="recipients-label"
              multiple
              value={form.recipientIds}
              label="Recipients"
              onChange={(e) => setForm((prev) => ({ ...prev, recipientIds: e.target.value as string[] }))}
              renderValue={(selected) => `${selected.length} selected`}
            >
              {recipientLoading ? (
                <MenuItem disabled>Loading recipients...</MenuItem>
              ) : recipientOptions.length === 0 ? (
                <MenuItem disabled>No recipients available</MenuItem>
              ) : (
                recipientOptions.map((recipient) => (
                  <MenuItem key={recipient.id} value={recipient.id}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{recipient.label}</Typography>
                      {recipient.sublabel && <Typography variant="caption" color="text.secondary">{recipient.sublabel}</Typography>}
                    </Stack>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' }, gap: 2 }}>
            <TextField
              size="small"
              label="Latitude"
              value={form.latitude}
              onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
            />
            <TextField
              size="small"
              label="Longitude"
              value={form.longitude}
              onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
            />
            <Button variant="secondary" icon={<MyLocationRoundedIcon fontSize="small" />} onClick={handleUseCurrentLocation}>
              Use My Location
            </Button>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Pick Exact Location On Map
            </Typography>
            <AccidentLocationMap
              initialLocation={{
                latitude: Number(form.latitude) || 34.7678,
                longitude: Number(form.longitude) || 9.5615,
              }}
              onLocationChange={(location) => {
                setForm((prev) => ({
                  ...prev,
                  latitude: String(location.latitude),
                  longitude: String(location.longitude),
                }))
              }}
              height={320}
              readOnly={false}
              showSearch
              showInstructions={false}
              markerVariant="alert"
            />
          </Box>

          <TextField
            multiline
            minRows={3}
            label="Alert Comment"
            value={form.comment}
            onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            placeholder="Write what happened and what officers should do."
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" icon={<SendRoundedIcon fontSize="small" />} loading={loading} onClick={handleSendAlert}>
              Send Alert
            </Button>
          </Box>
        </Stack>
      </Card>

      <Card sx={{ p: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <PlaceRoundedIcon color="primary" fontSize="small" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Alerts Location Map</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Live map of sent and received alerts with saved coordinates.
        </Typography>
        <AlertsMap alerts={mapAlerts} height={360} />
      </Card>

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ px: 2, pt: 2 }}>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 1 }}>
            <Tab label={`Received (${receivedAlerts.length})`} value="received" />
            <Tab label={`Sent (${sentAlerts.length})`} value="sent" />
          </Tabs>
        </Box>

        <Box sx={{ px: 2, pb: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: tab === 'received' ? '2fr 1fr' : '1fr' }, gap: 2 }}>
            <TextField
              size="small"
              label="Search alerts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {tab === 'received' && (
              <FormControl size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'unread' | 'read')}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="unread">Unread</MenuItem>
                  <MenuItem value="read">Read</MenuItem>
                </Select>
              </FormControl>
            )}
          </Box>
        </Box>

        {error && (
          <Box sx={{ px: 2, pb: 1 }}>
            <MuiAlert severity="error">{error}</MuiAlert>
          </Box>
        )}

        {loading && alerts.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : displayedAlerts.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography color="text.secondary">No alerts found for current filters.</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {displayedAlerts.map((alert: any, idx: number) => {
              const isUnread = !alert.read && alert.direction === 'received'
              const ackCount = Number(alert.acknowledgedCount || 0)
              const recipientCount = Number(alert.recipientCount || 0)
              const pendingCount = Math.max(0, recipientCount - ackCount)
              const senderName =
                alert.direction === 'received'
                  ? (alert.senderId && senderNames[alert.senderId] ? senderNames[alert.senderId] : 'Unknown sender')
                  : ''
              return (
                <ListItem
                  key={alert.id || idx}
                  divider={idx !== displayedAlerts.length - 1}
                  sx={{
                    px: 2,
                    py: 1.75,
                    alignItems: 'flex-start',
                    bgcolor: isUnread ? alpha(theme.palette.warning.main, 0.06) : 'transparent',
                  }}
                  secondaryAction={
                    alert.direction === 'received' && !alert.read ? (
                      <Button variant="secondary" size="sm" onClick={() => handleAcknowledge(alert.id)}>
                        Acknowledge
                      </Button>
                    ) : undefined
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {alert.direction === 'received' ? `Alert from ${senderName}` : 'Sent alert'}
                        </Typography>
                        <Chip size="small" label={alert.direction.toUpperCase()} color={alert.direction === 'sent' ? 'info' : 'warning'} variant="outlined" />
                        {alert.direction === 'received' && (
                          <Chip size="small" label={alert.read ? 'READ' : 'UNREAD'} color={alert.read ? 'success' : 'warning'} />
                        )}
                        {alert.direction === 'sent' && (
                          <Chip
                            size="small"
                            color={pendingCount === 0 ? 'success' : 'warning'}
                            label={pendingCount === 0 ? 'Fully acknowledged' : `${pendingCount} pending`}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                        <Typography variant="body2" color="text.secondary">{alert.comment || alert.description}</Typography>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <PlaceRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {Number.isFinite(alert.latitude) && Number.isFinite(alert.longitude)
                                ? `${alert.latitude.toFixed(5)}, ${alert.longitude.toFixed(5)}`
                                : 'No coordinates'}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {alert.time}
                          </Typography>
                          {alert.direction === 'sent' && (
                            <Typography variant="caption" color="text.secondary">
                              Delivery: {ackCount}/{recipientCount} acknowledged
                            </Typography>
                          )}
                        </Stack>
                      </Stack>
                    }
                  />
                </ListItem>
              )
            })}
          </List>
        )}
      </Card>
    </Stack>
  )
}
