import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  Avatar, Box, Chip, IconButton,
  List, ListItem, ListItemAvatar, ListItemText,
  Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, alpha, useTheme,
} from '@mui/material'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import ZoomOutMapRoundedIcon from '@mui/icons-material/ZoomOutMapRounded'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecord'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { getMapStyle } from '@/utils/mapStyle'
import { geocodeAddress } from '@/utils/mapService'
import { getMapControlSx } from '@/utils/mapControlSx'
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

interface Props {
  incidents: Incident[]
  viewMode?: 'pins' | 'heatmap'
  onViewModeChange?: (mode: 'pins' | 'heatmap') => void
}

export default function IncidentHeatmapPanel({ incidents, viewMode: propViewMode, onViewModeChange }: Props) {
  const theme    = useTheme()
  const { t }    = useTranslation()

  const isDark = theme.palette.mode === 'dark'

  const containerRef     = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<maplibregl.Map | null>(null)
  const sourceLoaded     = useRef(false)
  const popupRef         = useRef<maplibregl.Popup | null>(null)
  const isDarkRef        = useRef(isDark)
  // Refs to avoid stale closures inside map callbacks
  const incidentsRef     = useRef(incidents)
  const resolvedRef      = useRef<Record<string, Coords>>({})
  const fittedRef        = useRef(false)

  const [mapError, setMapError]               = useState<string | null>(null)
  const [resolvedCoords, setResolvedCoords]   = useState<Record<string, Coords>>({})
  const [pointCount, setPointCount]           = useState(0)
  const [internalViewMode, setInternalViewMode] = useState<'pins' | 'heatmap'>('pins')
  const viewMode = propViewMode ?? internalViewMode
  const setViewMode = (mode: 'pins' | 'heatmap') => {
    setInternalViewMode(mode)
    onViewModeChange?.(mode)
  }
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null)

  // Keep refs in sync
  incidentsRef.current = incidents
  resolvedRef.current  = resolvedCoords
  isDarkRef.current    = isDark

  // ── Geocode place-name locations so every incident is mapped by default ──────
  // Incidents that already carry lat/lng or a "lat,lng" string are handled by
  // resolveCoords(); the rest (named places) are geocoded here — once per unique
  // location — and cached in resolvedCoords, which repaints the map layers.
  useEffect(() => {
    let active = true
    const run = async () => {
      const pending = new Map<string, string>() // lowercased key -> original query
      for (const inc of incidents) {
        if (inc.latitude != null && inc.longitude != null) continue
        const raw = inc.location?.trim() ?? ''
        if (!raw || parseCoords(raw)) continue
        const key = raw.toLowerCase()
        if (resolvedRef.current[key]) continue
        if (!pending.has(key)) pending.set(key, raw)
      }
      if (pending.size === 0) return

      const results = await Promise.all(
        Array.from(pending.entries()).map(async ([key, query]) => {
          try {
            const c = await geocodeAddress(query)
            return c ? ([key, { lat: c.lat, lng: c.lng }] as const) : null
          } catch {
            return null
          }
        })
      )
      if (!active) return
      const additions: Record<string, Coords> = {}
      for (const r of results) if (r) additions[r[0]] = r[1]
      if (Object.keys(additions).length > 0) {
        setResolvedCoords((prev) => ({ ...prev, ...additions }))
      }
    }
    run()
    return () => { active = false }
  }, [incidents])

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
      new maplibregl.LngLatBounds(coords[0], coords[0])
    )
    mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 1000 })
  }

  // ── Initialise map once ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getMapStyle(),
        center: [9.5615, 34.7678],
        zoom: 6,
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

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
          layout: { visibility: 'none' },
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
          layout: { visibility: 'visible' },
          paint: {
            // Visible at every zoom (was hidden below zoom 8, which left the map
            // looking empty at the default country-level view).
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 8, 6, 14, 13] as any,
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
            'circle-opacity': 0.88,
          },
        })

        // ── Popups ─────────────────────────────────────────────
        map.on('click', 'incidents-circles', (e) => {
          const feat = e.features?.[0] as any
          if (!feat) return
          const [lng, lat] = feat.geometry.coordinates
          const { location, severity, status } = feat.properties ?? {}
          const dark = isDarkRef.current
          const bg = dark ? '#1e293b' : '#ffffff'
          const textMain = dark ? '#f1f5f9' : '#0f172a'
          const textSub  = dark ? '#94a3b8' : '#64748b'
          const sevColor = SEV_COLORS[severity] ?? '#64748b'
          popupRef.current?.remove()
          popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .setHTML(
              `<div style="font-family:ui-sans-serif,system-ui,sans-serif;background:${bg};padding:10px 12px 9px;border-radius:8px;min-width:160px">` +
              `<div style="font-size:12px;font-weight:700;color:${textMain};margin-bottom:6px;line-height:1.35">${location ?? 'Unknown'}</div>` +
              `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">` +
              `<span style="font-size:10px;font-weight:700;color:${sevColor};background:${sevColor}20;padding:2px 7px;border-radius:999px;border:1px solid ${sevColor}40;text-transform:capitalize">${severity ?? '—'}</span>` +
              `<span style="font-size:10px;color:${textSub};text-transform:capitalize">${status ?? '—'}</span>` +
              `</div></div>`
            )
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

    const ro = new ResizeObserver(() => mapRef.current?.resize())
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      popupRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
      sourceLoaded.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update data when incidents / resolved coords change ─────
  useEffect(() => {
    if (!mapRef.current || !sourceLoaded.current) return
    const geo = buildGeoJson(incidents, resolvedCoords)
    setPointCount(geo.features.length)
    ;(mapRef.current.getSource('incidents-heat') as maplibregl.GeoJSONSource | undefined)?.setData(geo)
    // Frame the incidents the first time any are mapped, so they're clearly visible
    // without the user having to zoom or click a black-spot.
    if (!fittedRef.current && geo.features.length > 0) {
      fittedRef.current = true
      handleFitBounds()
    }
  }, [incidents, resolvedCoords])

  // ── Toggle layer visibility when viewMode changes ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sourceLoaded.current) return
    const circleLayerId = 'incidents-circles'
    if (viewMode === 'heatmap') {
      if (map.getLayer(circleLayerId)) map.setLayoutProperty(circleLayerId, 'visibility', 'none')
      if (map.getLayer('incidents-heatmap')) map.setLayoutProperty('incidents-heatmap', 'visibility', 'visible')
    } else {
      if (map.getLayer(circleLayerId)) map.setLayoutProperty(circleLayerId, 'visibility', 'visible')
      if (map.getLayer('incidents-heatmap')) map.setLayoutProperty('incidents-heatmap', 'visibility', 'none')
    }
  }, [viewMode])

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
        {!propViewMode && (
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => { if (v) setViewMode(v) }}
            size="small"
            sx={{ ml: 1 }}
          >
            <ToggleButton value="pins" sx={{ px: 1.5, py: 0.5, fontSize: 11, textTransform: 'none' }}>
              <FiberManualRecordRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> Pins
            </ToggleButton>
            <ToggleButton value="heatmap" sx={{ px: 1.5, py: 0.5, fontSize: 11, textTransform: 'none' }}>
              <LayersRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> Heatmap
            </ToggleButton>
          </ToggleButtonGroup>
        )}
        <Tooltip title="Fit map to all incidents">
          <span>
            <IconButton size="small" onClick={handleFitBounds} disabled={pointCount === 0}>
              <ZoomOutMapRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Map */}
      <Box sx={{ position: 'relative', height: 'clamp(460px, 58vh, 600px)', flexShrink: 0 }}>
        <Box
          ref={containerRef}
          sx={{
            width: '100%', height: '100%',
            ...getMapControlSx(theme),
            '& .maplibregl-popup-content': {
              padding: '0 !important',
              borderRadius: '10px !important',
              border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, isDark ? 0.35 : 0.14)}`,
              backgroundColor: `${isDark ? '#1e293b' : '#ffffff'} !important`,
              overflow: 'hidden',
            },
            '& .maplibregl-popup-close-button': {
              top: 5, right: 5, width: 20, height: 20, borderRadius: '50%',
              fontSize: '13px', lineHeight: '19px',
              color: isDark ? '#94a3b8' : '#64748b',
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
            },
            '& .maplibregl-popup-tip': {
              borderTopColor: `${isDark ? '#1e293b' : '#ffffff'} !important`,
              borderBottomColor: `${isDark ? '#1e293b' : '#ffffff'} !important`,
            },
          }}
        />

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

        {mapError && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.background.paper, 0.92) }}>
            <Typography variant="body2" color="text.secondary">{mapError}</Typography>
          </Box>
        )}
      </Box>

      {/* Hotspot list */}
      <Box sx={{ px: 1.75, pb: 1.75, pt: 1.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, fontWeight: 700, display: 'block', mb: 0.75 }}>
          {t('dashboard.top_10_black_spot_locations')}
        </Typography>
        {selectedHotspot && (
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Chip
              label={`Viewing: ${selectedHotspot}`}
              onDelete={() => setSelectedHotspot(null)}
              size="small"
              color="primary"
              sx={{ fontSize: 11, maxWidth: '100%' }}
            />
          </Box>
        )}
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
                    const next = selectedHotspot === row.location ? null : row.location
                    setSelectedHotspot(next)
                    if (next && row.coords && mapRef.current) {
                      mapRef.current.flyTo({ center: [row.coords.lng, row.coords.lat], zoom: 12, duration: 900 })
                    }
                  }}
                  sx={{
                    px: 1, py: 0.625, borderRadius: 1.5, mb: 0.25,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    bgcolor: selectedHotspot === row.location
                      ? alpha(theme.palette.primary.main, 0.08)
                      : 'transparent',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
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
                    {selectedHotspot === row.location && (
                      <Chip
                        label={`${row.count} incident${row.count !== 1 ? 's' : ''}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: 11, fontWeight: 700 }}
                      />
                    )}
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
