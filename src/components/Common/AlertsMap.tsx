import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { alpha, Box, Paper, Typography, useTheme } from '@mui/material'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'

interface AlertMapItem {
  id: string
  title?: string
  comment?: string
  time?: string
  latitude?: number
  longitude?: number
  direction?: 'received' | 'sent'
  read?: boolean
}

interface AlertsMapProps {
  alerts: AlertMapItem[]
  height?: number | string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createAlertMarker(direction: 'received' | 'sent', read: boolean): HTMLDivElement {
  const pinColor = direction === 'sent'
    ? '#2563eb'
    : read
      ? '#16a34a'
      : '#dc2626'
  const iconColor = direction === 'sent' ? '#1e3a8a' : read ? '#166534' : '#7f1d1d'

  const el = document.createElement('div')
  el.style.width = '36px'
  el.style.height = '46px'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,0.35))'
  el.innerHTML =
    "<svg viewBox='0 0 36 46' width='36' height='46' aria-hidden='true' focusable='false'>" +
    `<path d='M18 2C9.2 2 2 9.2 2 18c0 10.2 11.1 20.2 14.4 22.8.95.75 2.25.75 3.2 0C22.9 38.2 34 28.2 34 18 34 9.2 26.8 2 18 2z' fill='${pinColor}' stroke='#ffffff' stroke-width='2'/>` +
    "<circle cx='18' cy='18' r='9' fill='#ffffff'/>" +
    `<path fill='${iconColor}' d='M18 11.3a3.9 3.9 0 00-3.9 3.9v1.7l-.7 1.3a1 1 0 00.87 1.5h7.58a1 1 0 00.87-1.5l-.7-1.3v-1.7A3.9 3.9 0 0018 11.3zm0 11.2c1 0 1.85-.64 2.16-1.53h-4.32c.31.89 1.16 1.53 2.16 1.53z'/>` +
    '</svg>'
  return el
}

export default function AlertsMap({ alerts, height = 360 }: AlertsMapProps) {
  const theme = useTheme()
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [error, setError] = useState<string | null>(null)
  const token = getMapboxToken()
  const tokenError = getMapboxTokenError(token)

  const alertsWithCoords = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          typeof alert.latitude === 'number' &&
          typeof alert.longitude === 'number' &&
          Number.isFinite(alert.latitude) &&
          Number.isFinite(alert.longitude)
      ),
    [alerts]
  )

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    if (tokenError) {
      setError(tokenError)
      return
    }

    try {
      mapboxgl.accessToken = token
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [9.5615, 34.7678],
        zoom: 6,
      })
      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      mapRef.current.on('error', () => setError('Failed to load alerts map'))
    } catch {
      setError('Failed to initialize alerts map. Check VITE_MAPBOX_ACCESS_TOKEN.')
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [token, tokenError])

  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (alertsWithCoords.length === 0) return

    const bounds = new mapboxgl.LngLatBounds()

    alertsWithCoords.forEach((alert) => {
      const title = escapeHtml(alert.title || 'Alert Notification')
      const comment = escapeHtml(alert.comment || '')
      const time = escapeHtml(alert.time || '')
      const direction = alert.direction === 'sent' ? 'Sent' : 'Received'
      const readStatus = alert.read ? 'Read' : 'Unread'
      const directionChipColor = alert.direction === 'sent' ? '#1d4ed8' : '#b45309'
      const readChipColor = alert.read ? '#15803d' : '#b91c1c'

      const popup = new mapboxgl.Popup({ offset: 20, className: 'alerts-map-popup' }).setHTML(
        `<div class="alerts-popup-card">
          <div class="alerts-popup-header">
            <div class="alerts-popup-title">${title}</div>
            <div class="alerts-popup-chips">
              <span class="alerts-popup-chip" style="--chip-color:${directionChipColor};">${direction}</span>
              <span class="alerts-popup-chip" style="--chip-color:${readChipColor};">${readStatus}</span>
            </div>
          </div>
          ${comment ? `<div class="alerts-popup-message">${comment}</div>` : ''}
          <div class="alerts-popup-meta">
            ${time ? `<div>${time}</div>` : ''}
            <div>Lat ${alert.latitude?.toFixed(5)} | Lng ${alert.longitude?.toFixed(5)}</div>
          </div>
        </div>`
      )

      const marker = new mapboxgl.Marker({
        element: createAlertMarker(alert.direction || 'received', Boolean(alert.read)),
      })
        .setLngLat([alert.longitude!, alert.latitude!])
        .setPopup(popup)
        .addTo(mapRef.current!)

      markersRef.current.push(marker)
      bounds.extend([alert.longitude!, alert.latitude!])
    })

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14 })
    }
  }, [alertsWithCoords])

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 2.5,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        '& .mapboxgl-popup.alerts-map-popup .mapboxgl-popup-content': {
          borderRadius: '14px',
          border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
          boxShadow: '0 16px 34px rgba(2,6,23,0.24)',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          padding: 0,
          minWidth: 260,
          maxWidth: 320,
        },
        '& .mapboxgl-popup.alerts-map-popup .mapboxgl-popup-close-button': {
          fontSize: '16px',
          width: 22,
          height: 22,
          lineHeight: '20px',
          top: 6,
          right: 6,
          borderRadius: '999px',
          color: '#475569',
          backgroundColor: alpha('#f1f5f9', 0.95),
        },
        '& .mapboxgl-popup.alerts-map-popup .alerts-popup-card': {
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '12px 12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        },
        '& .mapboxgl-popup.alerts-map-popup .alerts-popup-header': {
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        },
        '& .mapboxgl-popup.alerts-map-popup .alerts-popup-title': {
          fontSize: '13px',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '0.1px',
          lineHeight: 1.35,
        },
        '& .mapboxgl-popup.alerts-map-popup .alerts-popup-chips': {
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
        },
        '& .mapboxgl-popup.alerts-map-popup .alerts-popup-chip': {
          fontSize: '10px',
          fontWeight: 700,
          borderRadius: '999px',
          border: '1px solid var(--chip-color)',
          backgroundColor: '#f8fafc',
          color: 'var(--chip-color)',
          padding: '2px 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.25px',
        },
        '& .mapboxgl-popup.alerts-map-popup .alerts-popup-message': {
          fontSize: '12px',
          color: '#334155',
          lineHeight: 1.4,
        },
        '& .mapboxgl-popup.alerts-map-popup .alerts-popup-meta': {
          fontSize: '11px',
          color: '#475569',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          paddingTop: '6px',
          borderTop: `1px dashed ${alpha('#94a3b8', 0.45)}`,
        },
        '& .mapboxgl-popup.alerts-map-popup .mapboxgl-popup-tip': {
          borderTopColor: '#ffffff !important',
          borderBottomColor: '#ffffff !important',
        },
      }}
    >
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />

      {error && (
        <Paper sx={{ position: 'absolute', left: 12, right: 12, bottom: 12, p: 1, bgcolor: 'error.main', color: 'error.contrastText' }}>
          <Typography variant="caption">{error}</Typography>
        </Paper>
      )}

      {!error && alerts.length > 0 && alertsWithCoords.length === 0 && (
        <Paper sx={{ position: 'absolute', left: 12, right: 12, bottom: 12, p: 1, bgcolor: 'warning.main', color: 'warning.contrastText' }}>
          <Typography variant="caption">No alert coordinates found yet.</Typography>
        </Paper>
      )}
    </Box>
  )
}
