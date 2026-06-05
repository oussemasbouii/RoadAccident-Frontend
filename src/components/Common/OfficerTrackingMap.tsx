import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Box, Typography, alpha, useTheme } from '@mui/material'
import { getMapStyle } from '@/utils/mapStyle'
import { getMapControlSx } from '@/utils/mapControlSx'
import { useTranslation } from '@/themeMode'
import type { OfficerLocation } from '@/types/officerTracking'

interface OfficerTrackingMapProps {
  officers: OfficerLocation[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onReady?: (map: maplibregl.Map) => void
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

function statusBadgeColors(status: string): { bg: string; fg: string } {
  const s = status.toLowerCase()
  if (s.includes('active') || s.includes('online')) return { bg: '#dcfce7', fg: '#15803d' }
  if (s.includes('busy') || s.includes('respond')) return { bg: '#fef3c7', fg: '#92400e' }
  if (s.includes('offline') || s.includes('idle')) return { bg: '#f1f5f9', fg: '#475569' }
  return { bg: '#dbeafe', fg: '#1d4ed8' }
}

interface PopupLabels {
  role: string
  phone: string
  lastSeen: string
  officer: string
}

function buildPopupHtml(
  properties: Record<string, unknown>,
  isDark: boolean,
  labels: PopupLabels,
): string {
  const bg       = isDark ? '#1e293b' : '#ffffff'
  const surface  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.025)'
  const textMain = isDark ? '#f1f5f9' : '#0f172a'
  const textSub  = isDark ? '#94a3b8' : '#64748b'
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)'
  const linkColor = isDark ? '#60a5fa' : '#2563eb'

  const rawName = String(properties.name || '')
  const name = escapeHtml(rawName || properties.officerId || properties.id || labels.officer)
  const officerId = properties.officerId ? escapeHtml(String(properties.officerId)) : null
  const color = statusColor(String(properties.status || ''))
  const status = properties.status ? escapeHtml(String(properties.status)) : null
  const role   = properties.role   ? escapeHtml(String(properties.role))   : null
  const phone  = properties.phoneNumber ? escapeHtml(String(properties.phoneNumber)) : null
  const updatedAt = properties.updatedAt
    ? new Date(String(properties.updatedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  const badge = status ? statusBadgeColors(status) : null
  const initials = rawName.trim()
    ? rawName.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')
    : (labels.officer[0]?.toUpperCase() ?? 'O')

  const phoneIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${textSub}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 4.1 11.8 19.8 19.8 0 0 1 1 3.2 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.7 12.7 12.7 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L7.1 8.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5 12.7 12.7 0 0 0 2.8.7A2 2 0 0 1 22 16.9z"/></svg>`
  const roleIcon  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${textSub}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`
  const clockIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${textSub}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`

  const rows: string[] = []
  if (role) rows.push(
    `<div style="display:flex;align-items:flex-start;gap:9px">${roleIcon}<span style="font-size:11px;color:${textSub};min-width:52px;flex-shrink:0;line-height:1.5">${labels.role}</span><span style="font-size:12px;color:${textMain};font-weight:500;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${role}</span></div>`
  )
  if (phone) rows.push(
    `<div style="display:flex;align-items:flex-start;gap:9px">${phoneIcon}<span style="font-size:11px;color:${textSub};min-width:52px;flex-shrink:0;line-height:1.5">${labels.phone}</span><a href="tel:${phone}" style="font-size:12px;color:${linkColor};font-weight:600;text-decoration:none;line-height:1.5">${phone}</a></div>`
  )
  if (updatedAt) rows.push(
    `<div style="display:flex;align-items:flex-start;gap:9px">${clockIcon}<span style="font-size:11px;color:${textSub};min-width:52px;flex-shrink:0;line-height:1.5">${labels.lastSeen}</span><span style="font-size:11px;color:${textSub};line-height:1.5">${escapeHtml(updatedAt)}</span></div>`
  )

  return `<div style="width:210px;font-family:Inter,system-ui,-apple-system,sans-serif;background:${bg};overflow:hidden;border-radius:14px">
  <div style="display:flex;align-items:center;gap:10px;padding:11px 32px 10px 12px;border-bottom:1px solid ${border}">
    <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,${color}28 0%,${color}12 100%);border:2px solid ${color}50;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;font-size:12px;color:${color};letter-spacing:0.5px;font-family:inherit">${initials}</div>
    <div style="overflow:hidden;min-width:0">
      <div style="font-weight:700;font-size:13px;color:${textMain};line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
      ${officerId && officerId !== name ? `<div style="font-size:10px;color:${textSub};margin-top:2px;letter-spacing:0.1px">ID · ${officerId}</div>` : ''}
    </div>
  </div>
  ${badge && status ? `<div style="padding:7px 12px;background:${surface};border-bottom:1px solid ${border}"><span style="display:inline-flex;align-items:center;gap:5px;padding:2px 9px 2px 7px;border-radius:999px;font-size:10px;font-weight:600;background:${badge.bg};color:${badge.fg};box-shadow:inset 0 0 0 1px ${badge.fg}22"><span style="width:5px;height:5px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 0 2px ${color}30"></span>${status}</span></div>` : ''}
  ${rows.length > 0 ? `<div style="padding:9px 12px;display:flex;flex-direction:column;gap:7px">${rows.join('')}</div>` : ''}
</div>`
}

type PointState = { lng: number; lat: number }
type GeoJSONSourceLike = maplibregl.GeoJSONSource & { setData: (data: GeoJSON.FeatureCollection) => void }

export default function OfficerTrackingMap({
  officers,
  selectedId,
  onSelect,
  onReady,
}: OfficerTrackingMapProps) {
  const theme = useTheme()
  const { t } = useTranslation()
  const isDark = theme.palette.mode === 'dark'
  const popupBg = isDark ? '#1e293b' : '#ffffff'

  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const onReadyRef = useRef(onReady)
  const onSelectRef = useRef(onSelect)
  const tRef = useRef(t)
  const isDarkRef = useRef(isDark)
  const metaByIdRef = useRef<Map<string, OfficerLocation>>(new Map())
  const currentByIdRef = useRef<Map<string, PointState>>(new Map())
  const targetByIdRef = useRef<Map<string, PointState>>(new Map())
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { onReadyRef.current = onReady }, [onReady])
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { tRef.current = t }, [t])
  useEffect(() => { isDarkRef.current = isDark }, [isDark])

  const popupLabels = (): PopupLabels => ({
    role: tRef.current('maps.popup_role'),
    phone: tRef.current('maps.popup_phone'),
    lastSeen: tRef.current('maps.popup_last_seen'),
    officer: tRef.current('maps.popup_officer'),
  })

  const buildFeatureCollection = () => {
    const features: GeoJSON.Feature[] = []
    currentByIdRef.current.forEach((coords, id) => {
      const officer = metaByIdRef.current.get(id)
      if (!officer) return
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
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
    return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection
  }

  const updateSourceData = () => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSourceLike | undefined
    source?.setData(buildFeatureCollection())
  }

  const ensureSelectedFilter = () => {
    const map = mapRef.current
    if (!map || !map.getLayer(SELECTED_LAYER_ID)) return
    map.setFilter(
      SELECTED_LAYER_ID,
      selectedId ? ['==', ['get', 'id'], selectedId] : ['==', ['get', 'id'], '__none__'],
    )
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    })
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current.on('error', () => setError(tRef.current('maps.failed_to_load_map_tiles')))

    mapRef.current.on('load', () => {
      const map = mapRef.current
      if (!map || map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: OFFICERS_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 9,
          'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      })

      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 18,
          'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'circle-opacity': 0.22,
          'circle-stroke-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.5,
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
          'text-halo-width': 1.5,
        },
      })

      map.on('mouseenter', OFFICERS_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', OFFICERS_LAYER_ID, () => { map.getCanvas().style.cursor = '' })
      map.on('click', OFFICERS_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        const props = (feature?.properties || {}) as Record<string, unknown>
        const id = String(props.id || '')
        if (!id) return
        onSelectRef.current?.(id)
        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({ offset: 16, anchor: 'bottom' })
          .setLngLat((feature?.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(buildPopupHtml(props, isDarkRef.current, popupLabels()))
          .addTo(map)
      })

      ensureSelectedFilter()
      updateSourceData()
      onReadyRef.current?.(map)
    })

    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(mapContainer.current)

    return () => {
      ro.disconnect()
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
    popupRef.current = new maplibregl.Popup({ offset: 16, anchor: 'bottom' })
      .setLngLat([coords.lng, coords.lat])
      .setHTML(buildPopupHtml(
        { id: meta.id, name: meta.name, officerId: meta.officerId, role: meta.role, status: meta.status, updatedAt: meta.updatedAt, phoneNumber: meta.phoneNumber },
        isDarkRef.current,
        popupLabels(),
      ))
      .addTo(map)
  }, [selectedId])

  const STATUS_LEGEND = [
    { key: 'legend_active' as const, color: '#22c55e' },
    { key: 'legend_busy'   as const, color: '#f59e0b' },
    { key: 'legend_offline' as const, color: '#94a3b8' },
    { key: 'legend_other'  as const, color: '#3b82f6' },
  ]

  const overlayBg = isDark
    ? alpha(theme.palette.background.paper, 0.9)
    : alpha('#ffffff', 0.92)

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...getMapControlSx(theme),
        '& .maplibregl-ctrl-attrib a[href*="mapbox.com/feedback"]': { display: 'none' },
        '& .maplibregl-popup-content': {
          borderRadius: '14px !important',
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, isDark ? 0.45 : 0.22)}`,
          backgroundColor: `${popupBg} !important`,
          padding: '0 !important',
          overflow: 'hidden',
        },
        '& .maplibregl-popup-close-button': {
          top: 9, right: 9,
          width: 24, height: 24, lineHeight: '24px', fontSize: '16px',
          borderRadius: '50%', fontWeight: 400,
          color: isDark ? '#94a3b8' : '#64748b',
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.12)' },
          zIndex: 2,
        },
        '& .maplibregl-popup-tip': {
          borderTopColor: `${popupBg} !important`,
          borderBottomColor: `${popupBg} !important`,
        },
      }}
    >
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />

      {officers.length > 0 && (
        <Box sx={{
          position: 'absolute', top: 12, left: 12, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: overlayBg,
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          backdropFilter: 'blur(8px)',
          borderRadius: 2, px: 1.5, py: 0.7,
          boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.12)}`,
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e', flexShrink: 0, boxShadow: '0 0 0 2px rgba(34,197,94,0.25)' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1 }}>
            {t('maps.officers_live', { count: officers.length })}
          </Typography>
        </Box>
      )}

      <Box sx={{
        position: 'absolute', bottom: 24, left: 12, zIndex: 2,
        bgcolor: overlayBg,
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        backdropFilter: 'blur(8px)',
        borderRadius: 2, p: 1.25,
        boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.1)}`,
        display: 'flex', flexDirection: 'column', gap: 0.6,
      }}>
        {STATUS_LEGEND.map(({ key, color }) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1 }}>
              {t(`maps.${key}`)}
            </Typography>
          </Box>
        ))}
      </Box>

      {error && (
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: alpha(theme.palette.background.paper, 0.92),
          zIndex: 4, p: 2, textAlign: 'center',
        }}>
          <Typography color="error.main">{error}</Typography>
        </Box>
      )}
    </Box>
  )
}
