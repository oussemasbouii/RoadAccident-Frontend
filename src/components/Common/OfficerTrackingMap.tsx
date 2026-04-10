import { useEffect, useRef, useState } from 'react'
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
const SOURCE_ID = 'officer-tracking-source'
const OFFICERS_LAYER_ID = 'officer-tracking-points'
const SELECTED_LAYER_ID = 'officer-tracking-selected'
const LABEL_LAYER_ID = 'officer-tracking-labels'
const INTERPOLATION_DURATION_MS = 600
const SNAP_EPSILON = 0.00001

function statusColor(status?: string) {
  const normalized = (status || '').toLowerCase()
  if (normalized.includes('active') || normalized.includes('online')) return '#22c55e'
  if (normalized.includes('busy') || normalized.includes('respond')) return '#f59e0b'
  if (normalized.includes('offline') || normalized.includes('idle')) return '#94a3b8'
  return '#3b82f6'
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function popupFromProps(properties: Record<string, unknown>) {
  const title = escapeHtml(properties.name || properties.officerId || properties.id || 'Officer')
  const updated = properties.updatedAt ? new Date(String(properties.updatedAt)).toLocaleString() : 'Unknown'

  return `
    <div style="min-width:180px;font-family:Inter,system-ui,sans-serif;color:#000000">
      <div style="font-weight:700;margin-bottom:6px">${title}</div>
      <div style="font-size:12px"><strong>Updated:</strong> ${escapeHtml(updated)}</div>
    </div>
  `
}

type PointState = { lng: number; lat: number }
type GeoJSONSourceLike = mapboxgl.GeoJSONSource & { setData: (data: GeoJSON.FeatureCollection) => void }

export default function OfficerTrackingMap({
  officers,
  selectedId,
  onSelect,
  onReady,
}: OfficerTrackingMapProps) {
  const theme = useTheme()
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const onReadyRef = useRef(onReady)
  const onSelectRef = useRef(onSelect)
  const metaByIdRef = useRef<Map<string, OfficerLocation>>(new Map())
  const currentByIdRef = useRef<Map<string, PointState>>(new Map())
  const targetByIdRef = useRef<Map<string, PointState>>(new Map())
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  const buildFeatureCollection = () => {
    const features: GeoJSON.Feature[] = []
    currentByIdRef.current.forEach((coords, id) => {
      const officer = metaByIdRef.current.get(id)
      if (!officer) return
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [coords.lng, coords.lat],
        },
        properties: {
          id: officer.id,
          name: officer.name || '',
          officerId: officer.officerId || '',
          phoneNumber: officer.phoneNumber || '',
          role: officer.role || '',
          status: officer.status || '',
          updatedAt: officer.updatedAt || '',
          color: statusColor(officer.status),
          accuracy: Number.isFinite(officer.accuracy) ? officer.accuracy : '',
        },
      })
    })

    return {
      type: 'FeatureCollection',
      features,
    } as GeoJSON.FeatureCollection
  }

  const updateSourceData = () => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSourceLike | undefined
    if (!source) return
    source.setData(buildFeatureCollection())
  }

  const ensureSelectedFilter = () => {
    const map = mapRef.current
    if (!map || !map.getLayer(SELECTED_LAYER_ID)) return
    if (selectedId) {
      map.setFilter(SELECTED_LAYER_ID, ['==', ['get', 'id'], selectedId])
      return
    }
    map.setFilter(SELECTED_LAYER_ID, ['==', ['get', 'id'], '__none__'])
  }

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
      attributionControl: false,
    })
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current.on('error', () => setError('Failed to load map tiles.'))
    mapRef.current.on('load', () => {
      const map = mapRef.current
      if (!map) return
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      map.addLayer({
        id: OFFICERS_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'circle-stroke-color': theme.palette.common.white,
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      })

      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 12,
          'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'circle-opacity': 0.2,
        },
        filter: ['==', ['get', 'id'], '__none__'],
      })

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ['get', 'officerId'], 'Officer'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
        },
      })

      map.on('mouseenter', OFFICERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', OFFICERS_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', OFFICERS_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        const props = (feature?.properties || {}) as Record<string, unknown>
        const id = String(props.id || '')
        if (!id) return

        onSelectRef.current?.(id)
        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ offset: 16 })
          .setLngLat((feature?.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(popupFromProps(props))
          .addTo(map)
      })

      ensureSelectedFilter()
      updateSourceData()
      onReadyRef.current?.(map)
    })

    return () => {
      popupRef.current?.remove()
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const nextIds = new Set<string>()
    officers.forEach((officer) => {
      nextIds.add(officer.id)
      metaByIdRef.current.set(officer.id, officer)
      targetByIdRef.current.set(officer.id, { lng: officer.longitude, lat: officer.latitude })
      if (!currentByIdRef.current.has(officer.id)) {
        currentByIdRef.current.set(officer.id, { lng: officer.longitude, lat: officer.latitude })
      }
    })

    Array.from(currentByIdRef.current.keys()).forEach((id) => {
      if (!nextIds.has(id)) {
        currentByIdRef.current.delete(id)
        targetByIdRef.current.delete(id)
        metaByIdRef.current.delete(id)
      }
    })

    const animate = (ts: number) => {
      const last = lastFrameRef.current ?? ts
      const dt = Math.max(1, ts - last)
      lastFrameRef.current = ts
      const alphaStep = Math.min(1, dt / INTERPOLATION_DURATION_MS)
      let hasMovement = false

      currentByIdRef.current.forEach((current, id) => {
        const target = targetByIdRef.current.get(id)
        if (!target) return
        const nextLng = current.lng + (target.lng - current.lng) * alphaStep
        const nextLat = current.lat + (target.lat - current.lat) * alphaStep
        const lngDone = Math.abs(target.lng - nextLng) <= SNAP_EPSILON
        const latDone = Math.abs(target.lat - nextLat) <= SNAP_EPSILON
        current.lng = lngDone ? target.lng : nextLng
        current.lat = latDone ? target.lat : nextLat
        if (!lngDone || !latDone) hasMovement = true
      })

      updateSourceData()
      if (hasMovement) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        animationFrameRef.current = null
        lastFrameRef.current = null
      }
    }

    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    updateSourceData()
  }, [officers])

  useEffect(() => {
    ensureSelectedFilter()
    const map = mapRef.current
    if (!map || !selectedId) return
    const coords = currentByIdRef.current.get(selectedId)
    const meta = metaByIdRef.current.get(selectedId)
    if (!coords || !meta) return
    popupRef.current?.remove()
    popupRef.current = new mapboxgl.Popup({ offset: 16 })
      .setLngLat([coords.lng, coords.lat])
      .setHTML(
        popupFromProps({
          id: meta.id,
          name: meta.name,
          officerId: meta.officerId,
          role: meta.role,
          status: meta.status,
          updatedAt: meta.updatedAt,
          phoneNumber: meta.phoneNumber,
        })
      )
      .addTo(map)
  }, [selectedId])

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        '& .mapboxgl-ctrl-attrib a[href*="mapbox.com/feedback"]': { display: 'none' },
      }}
    >
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
