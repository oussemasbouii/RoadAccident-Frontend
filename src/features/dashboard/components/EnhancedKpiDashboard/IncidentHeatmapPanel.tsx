import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Avatar, Box, Chip, CircularProgress, IconButton,
  List, ListItem, ListItemAvatar, ListItemText,
  Paper, Stack, Tooltip, Typography, alpha, useTheme,
} from '@mui/material'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import ZoomOutMapRoundedIcon from '@mui/icons-material/ZoomOutMapRounded'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'
import { useTranslation } from '../../../../themeMode'

type Coords = { lat: number; lng: number }

interface HotspotRow {
  location: string
  count: number
  severity: string
  coords: Coords | null
}

const SEV_COLORS: Record<string, string> = {
  critical: '#B91C1C',
  high:     '#EA580C',
  medium:   '#0284C7',
  low:      '#16A34A',
}

function parseCoords(location: string): Coords | null {
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const lat = Number(match[1]); const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function resolveCoords(inc: Incident, resolved: Record<string, Coords>): Coords | null {
  if (inc.latitude != null && inc.longitude != null) return { lat: inc.latitude, lng: inc.longitude }
  const key = inc.location?.trim().toLowerCase() ?? ''
  return resolved[key] ?? parseCoords(inc.location ?? '') ?? null
}

function buildGeoJson(incidents: Incident[], resolved: Record<string, Coords>): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const inc of incidents) {
    const coords = resolveCoords(inc, resolved)
    if (coords) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        properties: { id: inc.id, location: inc.location, severity: inc.severity, status: inc.status },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

function buildHotspots(incidents: Incident[], resolved: Record<string, Coords>): HotspotRow[] {
  const acc: Record<string, HotspotRow & { sevCounts: Record<string, number> }> = {}
  for (const inc of incidents) {
    const key = inc.location.trim().toLowerCase()
    if (!acc[key]) acc[key] = { location: inc.location.trim(), count: 0, severity: inc.severity, coords: null, sevCounts: {} }
    acc[key].count += 1
    acc[key].sevCounts[inc.severity] = (acc[key].sevCounts[inc.severity] ?? 0) + 1
    if (!acc[key].coords) acc[key].coords = resolveCoords(inc, resolved)
  }
  return Object.values(acc)
    .map(({ sevCounts, ...row }) => ({
      ...row,
      severity: (['critical', 'high', 'medium', 'low'].find((s) => (sevCounts[s] ?? 0) > 0)) ?? 'low',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export default function IncidentHeatmapPanel({ incidents }: { incidents: Incident[] }) {
  const theme    = useTheme()
  const { t }    = useTranslation()
  const isDark   = theme.palette.mode === 'dark'

  const containerRef     = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<mapboxgl.Map | null>(null)
  const sourceLoaded     = useRef(false)
  const popupRef         = useRef<mapboxgl.Popup | null>(null)
  // Refs to avoid stale closures inside map callbacks
  const incidentsRef     = useRef(incidents)
  const resolvedRef      = useRef<Record<string, Coords>>({})

  const [mapError, setMapError]               = useState<string | null>(null)
  const [resolvedCoords, setResolvedCoords]   = useState<Record<string, Coords>>({})
  const [geocoding, setGeocoding]             = useState(false)
  const [pointCount, setPointCount]           = useState(0)

  const token      = getMapboxToken()
  const tokenError = getMapboxTokenError(token)

  // Keep refs in sync
  incidentsRef.current = incidents
  resolvedRef.current  = resolvedCoords

  // ── Geocode location names ──────────────────────────────────
  useEffect(() => {
    if (!token || tokenError) return
    const toGeocode = [
      ...new Set(
        incidents
          .filter((i) => i.latitude == null && i.longitude == null)
          .map((i) => i.location?.trim())
          .filter((loc): loc is string => !!loc && !parseCoords(loc))
      ),
    ].slice(0, 30)

    if (toGeocode.length === 0) return
    let cancelled = false
    setGeocoding(true)

    Promise.all(
      toGeocode.map(async (loc) => {
        try {
          const res  = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(loc)}.json?access_token=${token}&country=tn&limit=1`)
          const data = await res.json()
          const center = data?.features?.[0]?.center
          if (!Array.isArray(center) || center.length < 2) return null
          return { key: loc.toLowerCase(), lng: Number(center[0]), lat: Number(center[1]) }
        } catch { return null }
      })
    ).then((results) => {
      if (cancelled) return
      const next: Record<string, Coords> = {}
      results.forEach((r) => { if (r) next[r.key] = { lat: r.lat, lng: r.lng } })
      setResolvedCoords((prev) => ({ ...prev, ...next }))
      setGeocoding(false)
    })

    return () => { cancelled = true }
  }, [incidents, token, tokenError])

  // ── Fit bounds helper ───────────────────────────────────────
  const handleFitBounds = () => {
    if (!mapRef.current) return
    const coords: [number, number][] = []
    for (const inc of incidentsRef.current) {
      const c = resolveCoords(inc, resolvedRef.current)
      if (c) coords.push([c.lng, c.lat])
    }
    if (coords.length === 0) return
    if (coords.length === 1) { mapRef.current.flyTo({ center: coords[0], zoom: 11 }); return }
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    )
    mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 1000 })
  }

  // ── Initialise map once ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current || tokenError) return
    if (!token) { setMapError('Missing Mapbox token'); return }

    mapboxgl.accessToken = token
    const mapStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12'

    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: mapStyle,
        center: [9.5615, 34.7678],
        zoom: 6,
      })
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      map.on('load', () => {
        const geo = buildGeoJson(incidentsRef.current, resolvedRef.current)
        setPointCount(geo.features.length)

        map.addSource('incidents-heat', { type: 'geojson', data: geo })

        // ── Heatmap layer (fades out at zoom 11) ──────────────
        map.addLayer({
          id: 'incidents-heatmap',
          type: 'heatmap',
          source: 'incidents-heat',
          maxzoom: 13,
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 1, 12, 3] as any,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(255,255,0,0)',
              0.2, 'rgba(255,200,0,0.55)',
              0.5, 'rgba(255,100,0,0.8)',
              0.8, 'rgba(220,30,30,0.9)',
              1,   'rgb(140,0,0)',
            ] as any,
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 22, 12, 45] as any,
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.85, 12, 0] as any,
          },
        })

        // ── Circle layer (fades in at zoom 9) ─────────────────
        map.addLayer({
          id: 'incidents-circles',
          type: 'circle',
          source: 'incidents-heat',
          minzoom: 8,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 14] as any,
            'circle-color': [
              'match', ['get', 'severity'],
              'critical', SEV_COLORS.critical,
              'high',     SEV_COLORS.high,
              'medium',   SEV_COLORS.medium,
              'low',      SEV_COLORS.low,
              '#64748B',
            ] as any,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 10, 0.9] as any,
          },
        })

        // ── Popups ─────────────────────────────────────────────
        map.on('click', 'incidents-circles', (e) => {
          const feat = e.features?.[0] as any
          if (!feat) return
          const [lng, lat] = feat.geometry.coordinates
          const { location, severity, status } = feat.properties ?? {}
          popupRef.current?.remove()
          popupRef.current = new mapboxgl.Popup({ closeButton: true, offset: 10, maxWidth: '220px' })
            .setLngLat([lng, lat])
            .setHTML(`
              <div style="font-family:system-ui,sans-serif;padding:2px 0">
                <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px">${location ?? 'Unknown'}</div>
                <span style="display:inline-block;font-size:10px;font-weight:700;color:${SEV_COLORS[severity] ?? '#64748b'};background:${SEV_COLORS[severity]}20;padding:1px 6px;border-radius:4px;margin-right:4px;text-transform:capitalize">${severity ?? '—'}</span>
                <span style="font-size:10px;color:#64748b;text-transform:capitalize">${status ?? '—'}</span>
              </div>
            `)
            .addTo(map)
        })
        map.on('mouseenter', 'incidents-circles', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'incidents-circles', () => { map.getCanvas().style.cursor = '' })

        sourceLoaded.current = true
      })

      map.on('error', () => setMapError('Map failed to load'))
      mapRef.current = map
    } catch {
      setMapError('Map initialization failed')
    }

    return () => {
      popupRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
      sourceLoaded.current = false
    }
  }, [token, tokenError, isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update data when incidents / resolved coords change ─────
  useEffect(() => {
    if (!mapRef.current || !sourceLoaded.current) return
    const geo = buildGeoJson(incidents, resolvedCoords)
    setPointCount(geo.features.length)
    ;(mapRef.current.getSource('incidents-heat') as mapboxgl.GeoJSONSource | undefined)?.setData(geo)
  }, [incidents, resolvedCoords])

  const hotspots = useMemo(() => buildHotspots(incidents, resolvedCoords), [incidents, resolvedCoords])

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: alpha(theme.palette.divider, 0.7),
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.25, py: 1.75,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          display: 'flex', alignItems: 'center', gap: 1.25,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 60%)`,
        }}
      >
        <Box sx={{ p: 0.875, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
          <LocationOnRoundedIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{t('dashboard.heatmap_title')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {pointCount > 0 ? `${pointCount} incidents mapped` : 'Locating incidents…'}
          </Typography>
        </Box>
        {geocoding && <CircularProgress size={14} sx={{ mr: 0.5 }} />}
        <Tooltip title="Fit map to all incidents">
          <span>
            <IconButton size="small" onClick={handleFitBounds} disabled={pointCount === 0}>
              <ZoomOutMapRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Map */}
      <Box sx={{ position: 'relative', height: 460, flexShrink: 0 }}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />

        {/* Severity legend overlay */}
        <Box
          sx={{
            position: 'absolute', bottom: 28, left: 12,
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            borderRadius: 2, px: 1.25, py: 0.875,
            backdropFilter: 'blur(6px)',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'text.secondary' }}>
            Severity
          </Typography>
          <Stack spacing={0.4}>
            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
              <Stack key={sev} direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SEV_COLORS[sev], flexShrink: 0 }} />
                <Typography variant="caption" sx={{ textTransform: 'capitalize', fontSize: 10, lineHeight: 1 }}>
                  {sev}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Heatmap legend bar */}
        <Box
          sx={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 1,
            bgcolor: alpha(theme.palette.background.paper, 0.88),
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            borderRadius: 999, px: 1.5, py: 0.5,
            backdropFilter: 'blur(6px)',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{t('dashboard.heatmap_low')}</Typography>
          <Box sx={{ width: 80, height: 5, borderRadius: 1, background: 'linear-gradient(to right, rgba(255,200,0,0.6), rgba(255,100,0,0.8), rgb(140,0,0))' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{t('dashboard.heatmap_high')}</Typography>
        </Box>

        {(mapError || tokenError) && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.background.paper, 0.92) }}>
            <Typography variant="body2" color="text.secondary">{mapError ?? tokenError}</Typography>
          </Box>
        )}
      </Box>

      {/* Hotspot list */}
      <Box sx={{ px: 1.75, pb: 1.75, pt: 1.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, fontWeight: 700, display: 'block', mb: 0.75 }}>
          {t('dashboard.top_10_black_spot_locations')}
        </Typography>
        <List disablePadding dense sx={{ maxHeight: 240, overflow: 'auto' }}>
          {hotspots.length === 0 ? (
            <Box sx={{ py: 2.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">{t('dashboard.no_hotspot_data_yet')}</Typography>
            </Box>
          ) : (
            hotspots.map((row, idx) => {
              const sevColor = SEV_COLORS[row.severity] ?? theme.palette.primary.main
              return (
                <ListItem
                  key={`${row.location}-${idx}`}
                  onClick={() => {
                    if (!mapRef.current || !row.coords) return
                    mapRef.current.flyTo({ center: [row.coords.lng, row.coords.lat], zoom: 11 })
                  }}
                  sx={{
                    px: 1, py: 0.625, borderRadius: 2, mb: 0.25,
                    cursor: row.coords ? 'pointer' : 'default',
                    '&:hover': row.coords ? { bgcolor: alpha(theme.palette.primary.main, 0.05) } : {},
                    transition: 'background-color 0.12s',
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 34 }}>
                    <Avatar
                      sx={{
                        width: 24, height: 24, fontSize: 10, fontWeight: 900,
                        bgcolor: alpha(sevColor, 0.12),
                        color: sevColor,
                        border: `1px solid ${alpha(sevColor, 0.25)}`,
                      }}
                    >
                      {idx + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
                        {row.location}
                      </Typography>
                    }
                  />
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sevColor }} />
                    <Chip
                      size="small"
                      label={row.count}
                      sx={{
                        height: 18, fontSize: 10, fontWeight: 800,
                        bgcolor: alpha(sevColor, 0.1), color: sevColor, border: 'none',
                      }}
                    />
                  </Stack>
                </ListItem>
              )
            })
          )}
        </List>
      </Box>
    </Paper>
  )
}
