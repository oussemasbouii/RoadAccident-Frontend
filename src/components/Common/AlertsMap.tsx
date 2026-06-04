import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { alpha, Box, Paper, Typography, useTheme } from '@mui/material'
import { getMapStyle } from '@/utils/mapStyle'
import { getMapControlSx } from '@/utils/mapControlSx'
import { useTranslation } from '@/themeMode'

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
  const { t } = useTranslation()
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [error, setError] = useState<string | null>(null)

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

    try {
      mapRef.current = new maplibregl.Map({
        container: mapContainer.current,
        style: getMapStyle(),
        center: [9.5615, 34.7678],
        zoom: 6,
      })
      mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
      mapRef.current.on('error', () => setError(t('maps.failed_to_load_alerts_map')))
    } catch {
      setError(t('maps.failed_to_initialize_alerts_map'))
    }

    const ro = new ResizeObserver(() => mapRef.current?.resize())
    if (mapContainer.current) ro.observe(mapContainer.current)

    return () => {
      ro.disconnect()
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (alertsWithCoords.length === 0) return

    const bounds = new maplibregl.LngLatBounds()

    alertsWithCoords.forEach((alert) => {
      const title = escapeHtml(alert.title || t('common.loading_text'))
      const comment = escapeHtml(alert.comment || '')
      const time = escapeHtml(alert.time || '')
      const direction = alert.direction === 'sent' ? t('alerts.sent') : t('alerts.received')
      const readStatus = alert.read ? t('common.yes') : t('common.no')
      const directionChipColor = alert.direction === 'sent' ? '#1d4ed8' : '#b45309'
      const readChipColor = alert.read ? '#15803d' : '#b91c1c'

      const popup = new maplibregl.Popup({ offset: 20, className: 'alerts-map-popup' }).setHTML(
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

      const marker = new maplibregl.Marker({
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

  const isDark = theme.palette.mode === 'dark'
  const popupBg = isDark ? '#1e293b' : '#ffffff'
  const textMain = isDark ? '#f1f5f9' : '#0f172a'
  const textSub  = isDark ? '#94a3b8' : '#475569'
  const divider  = isDark ? '#334155' : '#e2e8f0'

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 2.5,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        ...getMapControlSx(theme),
        '& .maplibregl-popup.alerts-map-popup .maplibregl-popup-content': {
          borderRadius: '14px',
          border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
          boxShadow: `0 16px 34px ${alpha(theme.palette.common.black, isDark ? 0.4 : 0.18)}`,
          backgroundColor: popupBg,
          color: textMain,
          padding: 0,
          minWidth: 260,
          maxWidth: 320,
        },
        '& .maplibregl-popup.alerts-map-popup .maplibregl-popup-close-button': {
          fontSize: '16px',
          width: 22,
          height: 22,
          lineHeight: '20px',
          top: 6,
          right: 6,
          borderRadius: '999px',
          color: textSub,
          backgroundColor: isDark ? alpha('#334155', 0.95) : alpha('#f1f5f9', 0.95),
        },
        '& .maplibregl-popup.alerts-map-popup .alerts-popup-card': {
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '12px 12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        },
        '& .maplibregl-popup.alerts-map-popup .alerts-popup-header': {
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        },
        '& .maplibregl-popup.alerts-map-popup .alerts-popup-title': {
          fontSize: '13px',
          fontWeight: 800,
          color: textMain,
          letterSpacing: '0.1px',
          lineHeight: 1.35,
        },
        '& .maplibregl-popup.alerts-map-popup .alerts-popup-chips': {
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
        },
        '& .maplibregl-popup.alerts-map-popup .alerts-popup-chip': {
          fontSize: '10px',
          fontWeight: 700,
          borderRadius: '999px',
          border: '1px solid var(--chip-color)',
          backgroundColor: isDark ? alpha(divider, 0.5) : '#f8fafc',
          color: 'var(--chip-color)',
          padding: '2px 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.25px',
        },
        '& .maplibregl-popup.alerts-map-popup .alerts-popup-message': {
          fontSize: '12px',
          color: textSub,
          lineHeight: 1.4,
        },
        '& .maplibregl-popup.alerts-map-popup .alerts-popup-meta': {
          fontSize: '11px',
          color: textSub,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          paddingTop: '6px',
          borderTop: `1px dashed ${alpha(divider, 0.6)}`,
        },
        '& .maplibregl-popup.alerts-map-popup .maplibregl-popup-tip': {
          borderTopColor: `${popupBg} !important`,
          borderBottomColor: `${popupBg} !important`,
        },
      }}
    >
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />

      {error && (
        <Paper sx={{ position: 'absolute', left: 12, right: 12, bottom: 12, p: 1, bgcolor: 'error.main', color: 'error.contrastText', zIndex: 5 }}>
          <Typography variant="caption">{error}</Typography>
        </Paper>
      )}

      {!error && alerts.length === 0 && (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 1,
          bgcolor: isDark ? alpha(theme.palette.background.paper, 0.55) : alpha('#f8fafc', 0.7),
          backdropFilter: 'blur(2px)', zIndex: 3,
        }}>
          <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontWeight: 500 }}>
            {t('maps.no_alert_coordinates_found_yet')}
          </Typography>
        </Box>
      )}

      {!error && alerts.length > 0 && alertsWithCoords.length === 0 && (
        <Paper sx={{ position: 'absolute', left: 12, right: 12, bottom: 12, p: 1, bgcolor: 'warning.main', color: 'warning.contrastText', zIndex: 5 }}>
          <Typography variant="caption">{t('maps.no_alert_coordinates_found_yet')}</Typography>
        </Paper>
      )}
    </Box>
  )
}
