import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import {
  Box,
  Chip,
  Divider,
  Stack,
  Autocomplete,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import LocationSearchingRoundedIcon from '@mui/icons-material/LocationSearchingRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import WifiTetheringRoundedIcon from '@mui/icons-material/WifiTetheringRounded'
import SignalWifiOffRoundedIcon from '@mui/icons-material/SignalWifiOffRounded'
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded'
import PersonPinCircleRoundedIcon from '@mui/icons-material/PersonPinCircleRounded'
import RadarRoundedIcon from '@mui/icons-material/RadarRounded'
import SortRoundedIcon from '@mui/icons-material/SortRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import OfficerTrackingMap from '@/components/Common/OfficerTrackingMap'
import type { OfficerLocation } from '@/types/officerTracking'
import { useAppSelector } from '@/store/store'
import { Card, Button } from '@/components/Common'
import { getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'
import { applyLocationUpdate, buildStateFromSnapshot } from './officerTracking.utils'

const TRACKING_EVENTS = {
  subscribe: 'request:admin:tracking:subscribe',
  unsubscribe: 'request:admin:tracking:unsubscribe',
  init: 'action:admin:tracking:locations:init',
  update: 'action:admin:tracking:location:update',
}

const STALE_THRESHOLD_MS = 1000 * 60 * 5
const SUBSCRIBE_ACK_TIMEOUT_MS = 5000

function formatRelativeTime(lastSeen?: number) {
  if (!lastSeen) return 'Unknown'
  const diff = Date.now() - lastSeen
  const seconds = Math.max(1, Math.floor(diff / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export default function OfficerTrackingPage() {
  const theme = useTheme()
  const token = useAppSelector((state) => state.auth.token)
  const [officerMap, setOfficerMap] = useState<Record<string, OfficerLocation>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected')
  const [subscriptionStatus, setSubscriptionStatus] = useState<'idle' | 'pending' | 'subscribed' | 'warning'>('idle')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'stale'>('all')
  const [sortMode, setSortMode] = useState<'recent' | 'name'>('recent')
  const [lastInitCount, setLastInitCount] = useState<number | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const tsMapRef = useRef<Map<string, number>>(new Map())
  const subscribeAckTimerRef = useRef<number | null>(null)

  const officers = useMemo(() => Object.values(officerMap), [officerMap])
  const filteredOfficers = useMemo(() => {
    if (!query.trim()) return officers
    const needle = query.trim().toLowerCase()
    return officers.filter((officer) => {
      const haystack = [
        officer.name,
        officer.officerId,
        officer.role,
        officer.userId,
        officer.id,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ')
      return haystack.includes(needle)
    })
  }, [officers, query])
  const visibleOfficers = useMemo(() => {
    if (statusFilter === 'all') return filteredOfficers
    return filteredOfficers.filter((officer) => {
      const isStale = officer.lastSeen ? Date.now() - officer.lastSeen > STALE_THRESHOLD_MS : true
      return statusFilter === 'stale' ? isStale : !isStale
    })
  }, [filteredOfficers, statusFilter])
  const orderedOfficers = useMemo(() => {
    const list = [...visibleOfficers]
    if (sortMode === 'name') {
      return list.sort((a, b) => {
        const aLabel = (a.name || a.officerId || a.id || '').toLowerCase()
        const bLabel = (b.name || b.officerId || b.id || '').toLowerCase()
        return aLabel.localeCompare(bLabel)
      })
    }
    return list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
  }, [visibleOfficers, sortMode])
  const selectedOfficer = selectedId ? officerMap[selectedId] : null
  const staleCount = useMemo(
    () => officers.filter((officer) => officer.lastSeen && Date.now() - officer.lastSeen > STALE_THRESHOLD_MS).length,
    [officers]
  )
  const liveCount = Math.max(0, officers.length - staleCount)

  const searchOptions = useMemo(() => {
    return officers
      .map((officer) => {
        const label = officer.name || 'Unknown'
        const idLabel = officer.officerId || officer.userId || officer.id
        return idLabel ? `${label} · ${idLabel}` : label
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }, [officers])

  useEffect(() => {
    if (!token) return

    const refreshToken = getRefreshToken()
    if (!refreshToken) return

    const socket = connectSharedSocket(refreshToken)
    if (!socket) return

    const clearSubscribeAckTimer = () => {
      if (subscribeAckTimerRef.current !== null) {
        window.clearTimeout(subscribeAckTimerRef.current)
        subscribeAckTimerRef.current = null
      }
    }

    const subscribe = () => {
      clearSubscribeAckTimer()
      setSubscriptionStatus('pending')
      subscribeAckTimerRef.current = window.setTimeout(() => {
        setSubscriptionStatus((prev) => (prev === 'pending' ? 'warning' : prev))
      }, SUBSCRIBE_ACK_TIMEOUT_MS)

      socket.emit(TRACKING_EVENTS.subscribe, null, (ack: { acknowledged?: boolean }) => {
        clearSubscribeAckTimer()
        setSubscriptionStatus(ack?.acknowledged ? 'subscribed' : 'warning')
        if (import.meta.env.DEV) {
          console.log('[Tracking] Subscribed:', Boolean(ack?.acknowledged))
        }
      })
    }

    const onConnect = () => {
      setSocketStatus('connected')
      subscribe()
    }
    const onDisconnect = () => {
      setSocketStatus('disconnected')
      setSubscriptionStatus('idle')
      clearSubscribeAckTimer()
    }
    const onConnectError = (err: Error) => {
      if (import.meta.env.DEV) {
        console.log('[Tracking] Socket connect error:', err?.message)
      }
      setSocketStatus('error')
      setSubscriptionStatus('warning')
      clearSubscribeAckTimer()
    }

    const onInit = (payload: { locations?: any[] }) => {
      if (import.meta.env.DEV) {
        console.log('[Tracking] Init payload:', payload)
      }
      const locations = Array.isArray(payload?.locations) ? payload.locations : []
      setLastInitCount(locations.length)

      const receivedAt = Date.now()
      const snapshot = buildStateFromSnapshot(locations, receivedAt)
      tsMapRef.current = snapshot.tsMap
      setOfficerMap(snapshot.officerMap)
      setSelectedId((prev) => (prev && snapshot.officerMap[prev] ? prev : null))

    }

    const onUpdate = (payload: any) => {
      if (import.meta.env.DEV) {
        console.log('[Tracking] Update payload:', payload)
      }
      const receivedAt = Date.now()
      setOfficerMap((prev) => applyLocationUpdate(prev, tsMapRef.current, payload, receivedAt).officerMap)
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on(TRACKING_EVENTS.init, onInit)
    socket.on(TRACKING_EVENTS.update, onUpdate)
    if (socket.connected) {
      onConnect()
    }

    return () => {
      clearSubscribeAckTimer()
      socket.emit(TRACKING_EVENTS.unsubscribe, null, (ack: { acknowledged?: boolean }) => {
        if (import.meta.env.DEV) {
          console.log('[Tracking] Unsubscribed:', Boolean(ack?.acknowledged))
        }
      })
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off(TRACKING_EVENTS.init, onInit)
      socket.off(TRACKING_EVENTS.update, onUpdate)
      setSubscriptionStatus('idle')
    }
  }, [token])

  const handleFitBounds = () => {
    if (!mapRef.current || orderedOfficers.length === 0) return
    const bounds = new mapboxgl.LngLatBounds()
    orderedOfficers.forEach((officer) => {
      bounds.extend([officer.longitude, officer.latitude])
    })
    mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 14 })
  }

  const handleFocusSelected = () => {
    if (!mapRef.current || !selectedOfficer) return
    mapRef.current.flyTo({
      center: [selectedOfficer.longitude, selectedOfficer.latitude],
      zoom: 13,
      essential: true,
    })
  }

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map
  }, [])

  const statusChip = socketStatus === 'connected'
    ? { label: 'Live', color: 'success', icon: <WifiTetheringRoundedIcon fontSize="small" /> }
    : socketStatus === 'error'
      ? { label: 'Error', color: 'error', icon: <SignalWifiOffRoundedIcon fontSize="small" /> }
      : { label: 'Offline', color: 'warning', icon: <SignalWifiOffRoundedIcon fontSize="small" /> }
  const subscribeChip = subscriptionStatus === 'subscribed'
    ? { label: 'Subscribed', color: 'success' as const }
    : subscriptionStatus === 'pending'
      ? { label: 'Subscribing', color: 'warning' as const }
      : subscriptionStatus === 'warning'
        ? { label: 'Subscribe Warning', color: 'warning' as const }
        : { label: 'Not Subscribed', color: 'default' as const }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
              Officer Location Tracking
            </Typography>
            <Typography color="text.secondary">
              Live overview of officer locations, activity status, and last known updates.
            </Typography>
            {(socketStatus !== 'connected' || subscriptionStatus === 'warning') && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <InfoRoundedIcon fontSize="small" color="warning" />
                <Typography variant="caption" color="text.secondary">
                  {socketStatus !== 'connected'
                    ? `Realtime stream is ${socketStatus}. The list will update once the socket reconnects.`
                    : 'Subscribe acknowledgement is delayed or failed. Updates are still being processed.'}
                </Typography>
              </Stack>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={statusChip.icon}
              label={statusChip.label}
              color={statusChip.color as any}
              variant="outlined"
            />
            <Chip
              label={subscribeChip.label}
              color={subscribeChip.color}
              variant="outlined"
            />
            <Button variant="secondary" size="sm" onClick={handleFitBounds} icon={<MyLocationRoundedIcon />}>
              Fit to officers
            </Button>
          </Stack>
        </Stack>

        

        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          {[
            { label: 'Total officers', value: officers.length, icon: <RadarRoundedIcon fontSize="small" /> },
            { label: 'Live', value: liveCount, icon: <WifiTetheringRoundedIcon fontSize="small" /> },
            { label: 'Stale', value: staleCount, icon: <SignalWifiOffRoundedIcon fontSize="small" /> },
            { label: 'Selected', value: selectedOfficer ? 1 : 0, icon: <PersonPinCircleRoundedIcon fontSize="small" /> },
          ].map((item) => (
            <Card key={item.label} sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    color: 'primary.main',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{item.value}</Typography>
                </Box>
              </Stack>
            </Card>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2.5 }}>
        <Card sx={{ minHeight: 520, overflow: 'hidden', position: 'relative' }}>
          <Box
            sx={{
              position: 'absolute',
              top: 28,
              left: 28,
              zIndex: 2,
              bgcolor: alpha(theme.palette.background.paper, 0.92),
              borderRadius: 999,
              px: 1.5,
              py: 0.75,
              boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <LocationSearchingRoundedIcon fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Live map feed
            </Typography>
            <Chip size="small" label={`${officers.length} tracking`} />
          </Box>
          <Box sx={{ height: { xs: 420, lg: 520 } }}>
            <OfficerTrackingMap
              officers={officers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReady={handleMapReady}
            />
          </Box>
        </Card>

        <Stack spacing={2.5}>
          <Card sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LocationSearchingRoundedIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Active Officers
              </Typography>
              <Chip label={officers.length} size="small" sx={{ ml: 'auto' }} />
            </Stack>

            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Autocomplete
                freeSolo
                options={searchOptions}
                value={query}
                onInputChange={(_, value) => setQuery(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Search by name, officer ID, or role..."
                  />
                )}
              />

              <Stack direction="row" spacing={1} alignItems="center">
                <FilterAltRoundedIcon fontSize="small" color="action" />
                {(['all', 'live', 'stale'] as const).map((value) => (
                  <Chip
                    key={value}
                    size="small"
                    label={value.toUpperCase()}
                    color={statusFilter === value ? 'primary' : 'default'}
                    onClick={() => setStatusFilter(value)}
                    variant={statusFilter === value ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <SortRoundedIcon fontSize="small" color="action" />
                {(['recent', 'name'] as const).map((value) => (
                  <Chip
                    key={value}
                    size="small"
                    label={value === 'recent' ? 'MOST RECENT' : 'A–Z'}
                    color={sortMode === value ? 'primary' : 'default'}
                    onClick={() => setSortMode(value)}
                    variant={sortMode === value ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>

              <Stack direction="row" spacing={1}>
                <Chip size="small" label={`${staleCount} stale`} color={staleCount ? 'warning' : 'default'} />
                <Chip size="small" label={`${liveCount} live`} color="success" />
              </Stack>
            </Stack>
          </Card>

          <Card sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Officer List
            </Typography>

            <Divider />

            <Stack spacing={1} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
              {orderedOfficers.length === 0 && (
                <Box
                  sx={{
                    borderRadius: 2,
                    border: `1px dashed ${alpha(theme.palette.divider, 0.6)}`,
                    p: 2,
                    textAlign: 'center',
                    color: 'text.secondary',
                  }}
                >
                  {officers.length === 0
                    ? 'No active tracked officers.'
                    : 'No officers match your current filters.'}
                </Box>
              )}

              {orderedOfficers.map((officer) => {
                const isSelected = officer.id === selectedId
                const isStale = officer.lastSeen ? Date.now() - officer.lastSeen > STALE_THRESHOLD_MS : true
                const statusLabel = officer.status || (isStale ? 'stale' : 'active')
                const accent = isStale ? theme.palette.warning.main : theme.palette.success.main

              return (
                <Box
                  key={officer.id}
                  onClick={() => setSelectedId(officer.id)}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: `1px solid ${isSelected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.6)}`,
                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      bgcolor: accent,
                    }}
                  />
                  <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {officer.name || 'Unknown officer'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {officer.officerId || officer.userId || officer.role || 'Officer'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label={statusLabel}
                        color={isStale ? 'warning' : 'success'}
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        Updated {formatRelativeTime(officer.lastSeen)}
                      </Typography>
                      {Number.isFinite(officer.accuracy) && (
                        <Chip size="small" label={`+/-${Math.round(officer.accuracy!)}m`} variant="outlined" />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Last seen: {officer.lastSeen ? new Date(officer.lastSeen).toLocaleString() : 'Unknown'}
                    </Typography>
                  </Stack>
                </Box>
              )
            })}
            </Stack>
          </Card>

          <Card sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Selected Officer
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            {selectedOfficer ? (
              <Stack spacing={0.5}>
                <Typography sx={{ fontWeight: 700 }}>
                  {selectedOfficer.name || 'Unknown officer'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedOfficer.role || 'Officer'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Contact: {selectedOfficer.phoneNumber || selectedOfficer.officerId || 'Not available'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last known: {selectedOfficer.latitude.toFixed(5)}, {selectedOfficer.longitude.toFixed(5)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Updated {formatRelativeTime(selectedOfficer.lastSeen)}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleFocusSelected}
                    icon={<PersonPinCircleRoundedIcon fontSize="small" />}
                  >
                    Center on map
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select an officer to see details and map actions.
              </Typography>
            )}
          </Card>
        </Stack>
      </Box>
    </Stack>
  )
}

