import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { alpha, Box, CircularProgress, Paper, Typography } from '@mui/material'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'
import { useTranslation } from '@/themeMode'

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

export default function IncidentsMap({ incidents, height = 420 }: IncidentsMapProps) {
  const { t } = useTranslation()
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [resolvedCoords, setResolvedCoords] = useState<Record<string, Coordinates>>({})
  const token = getMapboxToken()
  const tokenError = getMapboxTokenError(token)

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
    } catch (err) {
      setError(t('maps.failed_to_initialize_map'))
      return
    }

    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current.on('error', () => setError(t('maps.failed_to_load_map')))

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [token, tokenError])

  useEffect(() => {
    if (tokenError) return
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
              const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=tn&limit=1`
              )
              const data = await response.json()
              const center = data?.features?.[0]?.center
              if (!Array.isArray(center) || center.length < 2) return null
              return { id, coords: { lng: Number(center[0]), lat: Number(center[1]) } }
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
  }, [incidents, token, tokenError])

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

    const bounds = new mapboxgl.LngLatBounds()

    incidentsWithCoordinates.forEach(({ incident, coords }) => {
      if (!coords) return

      const safeLocation = String(incident.location || t('reports.no_location_data')).replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const safeSeverity = String(incident.severity || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const safeStatus = String(incident.status || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const safeTime = String(incident.time || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(
        `<div style="padding:8px 10px; color:#0f172a; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.35;">
          <div style="font-weight:700; margin-bottom:4px;">${safeLocation}</div>
          <div style="font-size:12px; color:#334155; margin-bottom:4px;">${t('incidents.severity')}: ${safeSeverity.toUpperCase()} | ${t('incidents.status')}: ${safeStatus}</div>
          <div style="font-size:11px; color:#475569; margin-bottom:3px;">${t('incidents.vehicles')}: ${incident.vehicles} | ${t('incidents.injuries')}: ${incident.injuries}</div>
          <div style="font-size:11px; color:#475569;">${safeTime}</div>
        </div>`
      )

      const marker = new mapboxgl.Marker({
        element: createIncidentMarkerElement(incident.severity),
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

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        '& .mapboxgl-popup-content': {
          borderRadius: '12px',
          border: `1px solid ${alpha('#64748b', 0.25)}`,
          boxShadow: '0 14px 28px rgba(0,0,0,0.22)',
          backgroundColor: '#ffffff',
          color: '#0f172a',
        },
        '& .mapboxgl-popup-tip': {
          borderTopColor: '#ffffff !important',
          borderBottomColor: '#ffffff !important',
        },
      }}
    >
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />

      {isResolving && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'rgba(255,255,255,0.9)',
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            zIndex: 10,
          }}
        >
          <CircularProgress size={16} />
          <Typography variant="caption">{t('maps.resolving_locations')}</Typography>
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
          <Typography variant="caption">
            No incident coordinates were found. Add latitude/longitude when creating incidents.
          </Typography>
        </Paper>
      )}
    </Box>
  )
}
