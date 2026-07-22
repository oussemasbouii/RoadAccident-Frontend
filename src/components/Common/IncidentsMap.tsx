import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { alpha, Box, CircularProgress, Paper, Typography, useTheme } from '@mui/material'
import { getMapStyle } from '@/utils/mapStyle'
import { getMapControlSx } from '@/utils/mapControlSx'
import { geocodeAddress } from '@/utils/mapService'
import { useTranslation } from '@/themeMode'

const SEVERITY_LEGEND = [
  { key: 'critical', label: 'Critical', color: '#B91C1C' },
  { key: 'high',     label: 'High',     color: '#EA580C' },
  { key: 'medium',   label: 'Medium',   color: '#0284C7' },
  { key: 'low',      label: 'Low',      color: '#16A34A' },
] as const

interface IncidentMapItem {
  id: string
  location: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'responded' | 'resolved'
  time: string
  vehicles: number
  injuries: number
  latitude?: number
  longitude?: number
}

interface IncidentsMapProps {
  incidents: IncidentMapItem[]
  height?: number | string
}

type Coordinates = { lat: number; lng: number }

const parseLocationCoordinates = (value: string): Coordinates | null => {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

const markerPaletteBySeverity: Record<
  IncidentMapItem['severity'],
  { pin: string; icon: string }
> = {
  critical: { pin: '#B91C1C', icon: '#7F1D1D' },
  high: { pin: '#EA580C', icon: '#9A3412' },
  medium: { pin: '#0284C7', icon: '#075985' },
  low: { pin: '#16A34A', icon: '#166534' },
}

const createIncidentMarkerElement = (severity: IncidentMapItem['severity']): HTMLDivElement => {
  const palette = markerPaletteBySeverity[severity]
  const el = document.createElement('div')
  el.className = 'incident-collision-marker'
  el.style.width = '44px'
  el.style.height = '54px'
  el.style.cursor = 'pointer'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.filter = 'drop-shadow(0 8px 14px rgba(0,0,0,0.35))'
  el.innerHTML =
    "<svg viewBox='0 0 44 54' width='44' height='54' aria-hidden='true' focusable='false'>" +
    `<path d='M22 2C11.5 2 3 10.5 3 21c0 12.4 14.1 24.8 17.9 27.7.7.5 1.5.5 2.2 0C26.9 45.8 41 33.4 41 21 41 10.5 32.5 2 22 2z' fill='${palette.pin}' stroke='#ffffff' stroke-width='2'/>` +
    "<circle cx='22' cy='21' r='11.2' fill='#ffffff'/>" +
    "<g transform='translate(12.3, 11.3) scale(0.8)'>" +
    `<path fill='${palette.icon}' d='M18 1c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5m.5 6h-1V3h1zm0 1v1h-1V8zm-.59 5c.06.16.09.33.09.5 0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5c0-.39.15-.74.39-1.01-1.63-.66-2.96-1.91-3.71-3.49H5.81l1.04-3H11c0-.69.1-1.37.29-2H5.41L3 11v9h3v-2h12v2h3v-7.68c-1.05.51-2.16.69-3.09.68M7.5 15c-.83 0-1.5-.67-1.5-1.5S6.67 12 7.5 12s1.5.67 1.5 1.5S8.33 15 7.5 15'/>` +
    '</g>' +
    '</svg>'
  return el
}

// Fan out markers that share (near-)identical coordinates so overlapping pins are all
// visible and clickable. Returns a per-incident pixel offset for the MapLibre Marker;
// pixel offsets are zoom-independent, so the pins stay separated at every zoom level.
const buildSpreadOffsets = (
  items: { incident: { id: string }; coords?: { lng: number; lat: number } | null }[]
): Record<string, [number, number]> => {
  const keyFor = (c: { lng: number; lat: number }) => `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`
  const counts = new Map<string, number>()
  items.forEach(({ coords }) => {
    if (!coords) return
    const k = keyFor(coords)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  })
  const seen = new Map<string, number>()
  const offsets: Record<string, [number, number]> = {}
  items.forEach(({ incident, coords }) => {
    if (!coords) return
    const k = keyFor(coords)
    const total = counts.get(k) ?? 1
    if (total <= 1) {
      offsets[incident.id] = [0, 0]
      return
    }
    const idx = seen.get(k) ?? 0
    seen.set(k, idx + 1)
    const radius = 16 + Math.min(total, 8) * 3
    const angle = (2 * Math.PI * idx) / total - Math.PI / 2 // start at top
    offsets[incident.id] = [
      Math.round(radius * Math.cos(angle)),
      Math.round(radius * Math.sin(angle)),
    ]
  })
  return offsets
}

export default function IncidentsMap({ incidents, height = 420 }: IncidentsMapProps) {
  const theme = useTheme()
  const { t } = useTranslation()
  const isDark = theme.palette.mode === 'dark'
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [resolvedCoords, setResolvedCoords] = useState<Record<string, Coordinates>>({})

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    try {
      mapRef.current = new maplibregl.Map({
        container: mapContainer.current,
        style: getMapStyle(),
        center: [9.5615, 34.7678],
        zoom: 6,
      })
    } catch {
      setError(t('maps.failed_to_initialize_map'))
      return
    }

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current.on('error', () => setError(t('maps.failed_to_load_map')))

    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(mapContainer.current)

    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    let active = true

    const resolve = async () => {
      const next: Record<string, Coordinates> = {}
      const toGeocode: { id: string; query: string }[] = []

      incidents.forEach((incident) => {
        if (
          Number.isFinite(incident.latitude) &&
          Number.isFinite(incident.longitude) &&
          typeof incident.latitude === 'number' &&
          typeof incident.longitude === 'number'
        ) {
          next[incident.id] = { lat: incident.latitude, lng: incident.longitude }
          return
        }

        const parsed = parseLocationCoordinates(incident.location)
        if (parsed) {
          next[incident.id] = parsed
          return
        }

        if (incident.location.trim()) {
          toGeocode.push({ id: incident.id, query: incident.location.trim() })
        }
      })

      if (toGeocode.length === 0) {
        if (active) setResolvedCoords(next)
        return
      }

      if (active) setIsResolving(true)

      try {
        const geocoded = await Promise.all(
          toGeocode.map(async ({ id, query }) => {
            try {
              const coords = await geocodeAddress(query)
              if (!coords) return null
              return { id, coords: { lng: coords.lng, lat: coords.lat } }
            } catch {
              return null
            }
          })
        )

        geocoded.forEach((entry) => {
          if (!entry) return
          next[entry.id] = entry.coords
        })
      } finally {
        if (active) {
          setResolvedCoords(next)
          setIsResolving(false)
        }
      }
    }

    resolve()

    return () => {
      active = false
    }
  }, [incidents])

  const incidentsWithCoordinates = useMemo(
    () =>
      incidents
        .map((incident) => ({
          incident,
          coords: resolvedCoords[incident.id],
        }))
        .filter((item) => !!item.coords),
    [incidents, resolvedCoords]
  )

  useEffect(() => {
    if (!mapRef.current) return
    if (!mapRef.current.isStyleLoaded()) {
      const onLoad = () => mapRef.current?.resize()
      mapRef.current.once('load', onLoad)
    } else {
      mapRef.current.resize()
    }

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (incidentsWithCoordinates.length === 0) return

    const bounds = new maplibregl.LngLatBounds()
    const spreadOffsets = buildSpreadOffsets(incidentsWithCoordinates)

    incidentsWithCoordinates.forEach(({ incident, coords }) => {
      if (!coords) return

      const escape = (v: string) => v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const safeLocation = escape(String(incident.location || t('reports.no_location_data')))
      const safeSeverity = escape(String(incident.severity || ''))
      const safeStatus   = escape(String(incident.status || ''))
      const safeTime     = escape(String(incident.time || ''))
      const pinColor = markerPaletteBySeverity[incident.severity]?.pin ?? '#64748b'
      const bgColor  = isDark ? '#1e293b' : '#ffffff'
      const textMain = isDark ? '#f1f5f9' : '#0f172a'
      const textSub  = isDark ? '#94a3b8' : '#475569'
      const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)'

      const statusPalette: Record<string, { bg: string; fg: string; b: string }> = {
        active:    { bg: '#fef3c7', fg: '#92400e', b: '#fcd34d' },
        responded: { bg: '#dbeafe', fg: '#1d4ed8', b: '#93c5fd' },
        resolved:  { bg: '#dcfce7', fg: '#15803d', b: '#86efac' },
      }
      const sp = statusPalette[incident.status] ?? {
        bg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
        fg: textSub,
        b: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)',
      }

      const clockSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`

      const popup = new maplibregl.Popup({ offset: 22, anchor: 'bottom' }).setHTML(
        `<div style="width:210px;font-family:Inter,system-ui,-apple-system,sans-serif;background:${bgColor};overflow:hidden;border-radius:12px">
          <div style="height:3px;background:${pinColor};border-radius:12px 12px 0 0"></div>
          <div style="padding:10px 32px 9px 12px">
            <div style="font-weight:700;font-size:12px;color:${textMain};line-height:1.4;margin-bottom:7px">${safeLocation}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${pinColor}18;color:${pinColor};border:1px solid ${pinColor}40;text-transform:uppercase;letter-spacing:0.5px">${safeSeverity}</span>
              <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:999px;background:${sp.bg};color:${sp.fg};border:1px solid ${sp.b}">${safeStatus}</span>
            </div>
          </div>
          <div style="display:flex;border-top:1px solid ${border}">
            <div style="flex:1;padding:8px 10px;text-align:center;border-right:1px solid ${border}">
              <div style="font-size:18px;font-weight:800;color:${textMain};line-height:1;letter-spacing:-0.5px">${incident.vehicles}</div>
              <div style="font-size:9px;color:${textSub};margin-top:3px;text-transform:uppercase;letter-spacing:0.5px">${t('incidents.vehicles')}</div>
            </div>
            <div style="flex:1;padding:8px 10px;text-align:center">
              <div style="font-size:18px;font-weight:800;color:${incident.injuries > 0 ? '#ef4444' : textMain};line-height:1;letter-spacing:-0.5px">${incident.injuries}</div>
              <div style="font-size:9px;color:${textSub};margin-top:3px;text-transform:uppercase;letter-spacing:0.5px">${t('incidents.injuries')}</div>
            </div>
          </div>
          ${safeTime ? `<div style="padding:6px 12px;font-size:10px;color:${textSub};display:flex;align-items:center;gap:5px;border-top:1px solid ${border}">${clockSvg}${safeTime}</div>` : ''}
        </div>`
      )

      const marker = new maplibregl.Marker({
        element: createIncidentMarkerElement(incident.severity),
        offset: spreadOffsets[incident.id] ?? [0, 0],
      })
        .setLngLat([coords.lng, coords.lat])
        .setPopup(popup)
        .addTo(mapRef.current!)

      markersRef.current.push(marker)
      bounds.extend([coords.lng, coords.lat])
    })

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14 })
    }
  }, [incidentsWithCoordinates])

  const popupBg = isDark ? '#1e293b' : '#ffffff'

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        ...getMapControlSx(theme),
        '& .maplibregl-popup-content': {
          borderRadius: '12px !important',
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, isDark ? 0.45 : 0.2)}`,
          backgroundColor: `${popupBg} !important`,
          padding: '0 !important',
          overflow: 'hidden',
        },
        '& .maplibregl-popup-close-button': {
          top: 8, right: 8,
          width: 24, height: 24, lineHeight: '24px', fontSize: '16px',
          borderRadius: '50%', fontWeight: 400,
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.25)',
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.4)' },
          zIndex: 2,
        },
        '& .maplibregl-popup-tip': {
          borderTopColor: `${popupBg} !important`,
          borderBottomColor: `${popupBg} !important`,
        },
      }}
    >
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />

      {/* Severity legend */}
      <Box sx={{
        position: 'absolute', bottom: 16, left: 12, zIndex: 4,
        bgcolor: isDark ? alpha(theme.palette.background.paper, 0.9) : alpha('#ffffff', 0.92),
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        backdropFilter: 'blur(8px)',
        borderRadius: 2, p: 1.1,
        boxShadow: `0 4px 10px ${alpha(theme.palette.common.black, 0.1)}`,
        display: 'flex', flexDirection: 'column', gap: 0.5,
      }}>
        {SEVERITY_LEGEND.map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 10, color: theme.palette.text.secondary, lineHeight: 1 }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {isResolving && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: isDark ? alpha(theme.palette.background.paper, 0.9) : 'rgba(255,255,255,0.92)',
            border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
            backdropFilter: 'blur(6px)',
            px: 1.25,
            py: 0.75,
            borderRadius: 1.5,
            zIndex: 10,
          }}
        >
          <CircularProgress size={14} />
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{t('maps.resolving_locations')}</Typography>
        </Box>
      )}

      {error && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            p: 1,
            bgcolor: 'error.main',
            color: 'error.contrastText',
            zIndex: 10,
          }}
        >
          <Typography variant="caption">{error}</Typography>
        </Paper>
      )}

      {!error && incidents.length > 0 && incidentsWithCoordinates.length === 0 && !isResolving && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            p: 1,
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
            zIndex: 10,
          }}
        >
          <Typography variant="caption">{t('maps.no_incident_coordinates')}</Typography>
        </Paper>
      )}
    </Box>
  )
}
