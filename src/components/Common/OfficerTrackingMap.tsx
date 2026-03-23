import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Box, Typography, alpha, useTheme } from '@mui/material'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'
import type { OfficerLocation } from '@/types/officerTracking'

interface OfficerTrackingMapProps {
  officers: OfficerLocation[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onReady?: (map: mapboxgl.Map) => void
}

const DEFAULT_CENTER: [number, number] = [10.1815, 36.8065]
const DEFAULT_ZOOM = 6

function statusColor(status?: string) {
  const normalized = (status || '').toLowerCase()
  if (normalized.includes('active') || normalized.includes('online')) return '#22c55e'
  if (normalized.includes('busy') || normalized.includes('respond')) return '#f59e0b'
  if (normalized.includes('offline') || normalized.includes('idle')) return '#94a3b8'
  return '#3b82f6'
}

function buildPopupHtml(officer: OfficerLocation) {
  const title = officer.name || officer.officerId || officer.id
  const subtitle = officer.officerId && officer.name ? officer.officerId : officer.role
  const status = officer.status ? officer.status.toUpperCase() : 'UNKNOWN'
  const updated = officer.updatedAt ? new Date(officer.updatedAt).toLocaleString() : 'Unknown'

  const safeTitle = String(title || 'Officer').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeSubtitle = String(subtitle || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeStatus = String(status).replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `
    <div style="min-width:180px;font-family:Inter,system-ui,sans-serif">
      <div style="font-weight:700;margin-bottom:4px">${safeTitle}</div>
      ${safeSubtitle ? `<div style="font-size:12px;opacity:0.7;margin-bottom:6px">${safeSubtitle}</div>` : ''}
      <div style="font-size:12px"><strong>Status:</strong> ${safeStatus}</div>
      <div style="font-size:12px;margin-top:4px"><strong>Updated:</strong> ${updated}</div>
    </div>
  `
}

export default function OfficerTrackingMap({
  officers,
  selectedId,
  onSelect,
  onReady,
}: OfficerTrackingMapProps) {
  const theme = useTheme()
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const officersById = useMemo(() => {
    const map = new Map<string, OfficerLocation>()
    officers.forEach((officer) => map.set(officer.id, officer))
    return map
  }, [officers])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const token = getMapboxToken()
    const tokenError = getMapboxTokenError(token)
    if (tokenError) {
      setError(tokenError)
      return
    }

    mapboxgl.accessToken = token
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current.on('error', () => setError('Failed to load map tiles.'))

    if (onReady) onReady(mapRef.current)

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [onReady])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const markers = markersRef.current

    officers.forEach((officer) => {
      const existing = markers.get(officer.id)
      const color = statusColor(officer.status)

      if (existing) {
        existing.setLngLat([officer.longitude, officer.latitude])
        const el = existing.getElement() as HTMLDivElement
        el.style.background = color
        el.style.boxShadow = officer.id === selectedId ? `0 0 0 6px ${alpha(color, 0.2)}` : 'none'
        return
      }

      const el = document.createElement('div')
      el.style.width = '12px'
      el.style.height = '12px'
      el.style.borderRadius = '999px'
      el.style.background = color
      el.style.boxShadow = officer.id === selectedId ? `0 0 0 6px ${alpha(color, 0.2)}` : 'none'
      el.style.border = `2px solid ${theme.palette.common.white}`
      el.style.cursor = 'pointer'

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([officer.longitude, officer.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(buildPopupHtml(officer)))
        .addTo(map)

      el.addEventListener('click', () => {
        onSelect?.(officer.id)
        marker.togglePopup()
      })

      markers.set(officer.id, marker)
    })

    markers.forEach((marker, id) => {
      if (!officersById.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    })
  }, [officers, officersById, onSelect, selectedId, theme.palette.common.white])

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />
      {error && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            zIndex: 2,
            p: 2,
            textAlign: 'center',
          }}
        >
          <Typography color="error.main">{error}</Typography>
        </Box>
      )}
    </Box>
  )
}
