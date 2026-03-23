import { useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import mapboxgl from 'mapbox-gl'
import {
  Box,
  Chip,
  Divider,
  Stack,
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
import { getDeviceId, getRefreshToken } from '@/utils/tokenStore'

const RAW_SOCKET_URL =
  import.meta.env.VITE_SOCKET_BASE_URL ||
  import.meta.env.VITE_SOCKET_URL ||
  ''
const SOCKET_BASE_URL = RAW_SOCKET_URL.startsWith('http') ? RAW_SOCKET_URL : ''
const SOCKET_PATH =
  import.meta.env.VITE_SOCKET_PATH ||
  (RAW_SOCKET_URL.startsWith('/') ? RAW_SOCKET_URL : '/api/v2/socket.io')
const FALLBACK_SOCKET_PATHS = import.meta.env.VITE_SOCKET_PATH
  ? [SOCKET_PATH]
  : ['/api/v2/socket.io', '/socket.io']
const TRACKING_EVENTS = {
  subscribe: 'request:admin:tracking:subscribe',
  unsubscribe: 'request:admin:tracking:unsubscribe',
  init: 'action:admin:tracking:locations:init',
  update: 'action:admin:tracking:location:update',
}

const STALE_THRESHOLD_MS = 1000 * 60 * 5

function normalizeOfficerLocation(payload: any): OfficerLocation | null {
  const data = payload?.data || payload?.location || payload
  const latitude = Number(data?.lat ?? data?.latitude)
  const longitude = Number(data?.lng ?? data?.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const id = String(data?.userId || data?.officerId || data?.id || data?._id || `${latitude}-${longitude}`)

  const ts = Number(data?.ts)
  const updatedAt =
    Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString()

  return {
    id,
    officerId: data?.officerId,
    name: data?.name,
    role: data?.role,
    status: data?.status,
    latitude,
    longitude,
    updatedAt,
    lastSeen: Date.now(),
    accuracy: Number(data?.accuracy),
    source: data?.source,
  }
}

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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'stale'>('all')
  const [sortMode, setSortMode] = useState<'recent' | 'name'>('recent')
  const [autoFit, setAutoFit] = useState(true)
  const [lastInitCount, setLastInitCount] = useState<number | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const tsMapRef = useRef<Map<string, number>>(new Map())
  const pathIndexRef = useRef(0)

  const officers = useMemo(() => Object.values(officerMap), [officerMap])
  const filteredOfficers = useMemo(() => {
    if (!query.trim()) return officers
    const needle = query.trim().toLowerCase()
    return officers.filter((officer) =>
      [officer.name, officer.officerId, officer.role, officer.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    )
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

  useEffect(() => {
    if (!token) return

    pathIndexRef.current = 0

    const refreshToken = getRefreshToken()
    const effectiveToken = refreshToken || token

    const createSocket = (path: string) =>
      io(SOCKET_BASE_URL || undefined, {
        path,
        transports: ['websocket', 'polling'],
        auth: {
          token: effectiveToken,
          accessToken: token,
          refreshToken,
          deviceId: getDeviceId(),
        },
      })

    let socket: Socket = createSocket(FALLBACK_SOCKET_PATHS[pathIndexRef.current] || SOCKET_PATH)

    const subscribe = () => {
      socket.emit(TRACKING_EVENTS.subscribe, null, (ack: { acknowledged?: boolean }) => {
        if (import.meta.env.DEV) {
          console.log('[Tracking] Subscribed:', Boolean(ack?.acknowledged))
        }
      })
    }

    socket.on('connect', () => {
      setSocketStatus('connected')
      tsMapRef.current.clear()
      subscribe()
    })
    socket.on('disconnect', () => setSocketStatus('disconnected'))
    socket.on('connect_error', (err) => {
      const nextIndex = pathIndexRef.current + 1
      if (nextIndex < FALLBACK_SOCKET_PATHS.length) {
        pathIndexRef.current = nextIndex
        if (import.meta.env.DEV) {
          console.log('[Tracking] Socket path failed, retrying:', FALLBACK_SOCKET_PATHS[nextIndex], err?.message)
        }
        socket.disconnect()
        socket = createSocket(FALLBACK_SOCKET_PATHS[pathIndexRef.current])
        socket.on('connect', () => {
          setSocketStatus('connected')
          tsMapRef.current.clear()
          subscribe()
        })
        socket.on('disconnect', () => setSocketStatus('disconnected'))
        socket.on('connect_error', () => setSocketStatus('error'))
        socket.on(TRACKING_EVENTS.init, onInit)
        socket.on(TRACKING_EVENTS.update, onUpdate)
        return
      }
      setSocketStatus('error')
    })

    const upsertLocation = (payload: any) => {
      const normalized = normalizeOfficerLocation(payload)
      if (!normalized) return
      const incomingTs = Number(payload?.ts ?? payload?.data?.ts)
      const lastTs = tsMapRef.current.get(normalized.id) ?? 0
      if (Number.isFinite(incomingTs) && incomingTs <= lastTs) return
      if (Number.isFinite(incomingTs)) {
        tsMapRef.current.set(normalized.id, incomingTs)
      }
      setOfficerMap((prev) => ({ ...prev, [normalized.id]: normalized }))
    }

    const onInit = (payload: { locations?: any[] }) => {
      if (import.meta.env.DEV) {
        console.log('[Tracking] Init payload:', payload)
      }
      const locations = Array.isArray(payload?.locations) ? payload.locations : []
      setLastInitCount(locations.length)
      locations.forEach((loc) => upsertLocation(loc))
    }

    const onUpdate = (payload: any) => {
      if (import.meta.env.DEV) {
        console.log('[Tracking] Update payload:', payload)
      }
      upsertLocation(payload)
    }
    socket.on(TRACKING_EVENTS.init, onInit)
    socket.on(TRACKING_EVENTS.update, onUpdate)

    return () => {
      socket.emit(TRACKING_EVENTS.unsubscribe, null, (ack: { acknowledged?: boolean }) => {
        if (import.meta.env.DEV) {
          console.log('[Tracking] Unsubscribed:', Boolean(ack?.acknowledged))
        }
      })
      socket.off(TRACKING_EVENTS.init, onInit)
      socket.off(TRACKING_EVENTS.update, onUpdate)
      socket.disconnect()
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

  const statusChip = socketStatus === 'connected'
    ? { label: 'Live', color: 'success', icon: <WifiTetheringRoundedIcon fontSize="small" /> }
    : socketStatus === 'error'
      ? { label: 'Error', color: 'error', icon: <SignalWifiOffRoundedIcon fontSize="small" /> }
      : { label: 'Offline', color: 'warning', icon: <SignalWifiOffRoundedIcon fontSize="small" /> }

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
            {socketStatus !== 'connected' && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <InfoRoundedIcon fontSize="small" color="warning" />
                <Typography variant="caption" color="text.secondary">
                  Realtime stream is {socketStatus}. The list will update once the socket reconnects.
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
              top: 16,
              left: 16,
              zIndex: 2,
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              borderRadius: 2,
              px: 1.5,
              py: 1,
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
              onReady={(map) => {
                mapRef.current = map
                if (autoFit && officers.length > 0) {
                  handleFitBounds()
                }
              }}
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
              <TextField
                size="small"
                placeholder="Search by name, officer ID, or role..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
                <Chip
                  size="small"
                  label={autoFit ? 'Auto-fit ON' : 'Auto-fit OFF'}
                  onClick={() => setAutoFit((prev) => !prev)}
                  variant={autoFit ? 'filled' : 'outlined'}
                />
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
                  No officers match your filters yet.
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
                      {officer.name || officer.officerId || officer.id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {officer.officerId && officer.name ? officer.officerId : officer.role || 'Officer'}
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
                        <Chip size="small" label={`±${Math.round(officer.accuracy!)}m`} variant="outlined" />
                      )}
                    </Stack>
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
                  {selectedOfficer.name || selectedOfficer.officerId || selectedOfficer.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedOfficer.officerId || selectedOfficer.role || 'Officer'}
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
