import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Avatar, Box, Chip, CircularProgress, List, ListItem, ListItemAvatar, ListItemText,
  Paper, Stack, Typography, alpha, useTheme,
} from '@mui/material'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'
import { useTranslation } from '../../../../themeMode'

type Coords = { lat: number; lng: number }

interface HotspotRow {
  location: string
  count: number
  coords: Coords | null
}

function parseCoords(location: string): Coords | null {
  const match = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function buildHotspots(incidents: Incident[], resolved: Record<string, Coords>): HotspotRow[] {
  const acc: Record<string, { location: string; count: number; coords: Coords | null }> = {}
  for (const inc of incidents) {
    const key = inc.location.trim().toLowerCase()
    if (!acc[key]) {
      const direct = (inc.latitude != null && inc.longitude != null)
        ? { lat: inc.latitude, lng: inc.longitude }
        : null
      acc[key] = { location: inc.location.trim(), count: 0, coords: direct ?? parseCoords(inc.location) ?? resolved[key] ?? null }
    }
    acc[key].count += 1
    if (!acc[key].coords) {
      const direct = (inc.latitude != null && inc.longitude != null)
        ? { lat: inc.latitude, lng: inc.longitude }
        : null
      acc[key].coords = direct ?? parseCoords(inc.location) ?? resolved[key] ?? null
    }
  }
  return Object.values(acc)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function buildGeoJson(incidents: Incident[], resolved: Record<string, Coords>): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const inc of incidents) {
    let coords: Coords | null = null
    if (inc.latitude != null && inc.longitude != null) {
      coords = { lat: inc.latitude, lng: inc.longitude }
    } else {
      const key = inc.location?.trim().toLowerCase() ?? ''
      coords = resolved[key] ?? parseCoords(inc.location ?? '') ?? null
    }
    if (coords) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        properties: { id: inc.id },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

export default function IncidentHeatmapPanel({ incidents }: { incidents: Incident[] }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<mapboxgl.Map | null>(null)
  const sourceLoaded  = useRef(false)
  const [mapError, setMapError]       = useState<string | null>(null)
  const [resolvedCoords, setResolvedCoords] = useState<Record<string, Coords>>({})
  const [geocoding, setGeocoding]     = useState(false)

  const token      = getMapboxToken()
  const tokenError = getMapboxTokenError(token)

  // Geocode location names that lack direct coordinates
  useEffect(() => {
    if (!token || tokenError) return

    const locationsToGeocode = [
      ...new Set(
        incidents
          .filter((i) => i.latitude == null && i.longitude == null)
          .map((i) => i.location?.trim())
          .filter((loc): loc is string => !!loc && !parseCoords(loc))
      ),
    ].slice(0, 25)

    if (locationsToGeocode.length === 0) return

    let cancelled = false
    setGeocoding(true)

    Promise.all(
      locationsToGeocode.map(async (loc) => {
        try {
          const res  = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(loc)}.json?access_token=${token}&country=tn&limit=1`
          )
          const data = await res.json()
          const center = data?.features?.[0]?.center
          if (!Array.isArray(center) || center.length < 2) return null
          return { key: loc.toLowerCase(), lng: Number(center[0]), lat: Number(center[1]) }
        } catch {
          return null
        }
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

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current || tokenError) return
    if (!token) { setMapError('Missing Mapbox token'); return }

    mapboxgl.accessToken = token
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [9.5615, 34.7678],
        zoom: 6,
      })
      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.on('load', () => {
        map.addSource('incidents-heat', {
          type: 'geojson',
          data: buildGeoJson(incidents, resolvedCoords),
        })
        map.addLayer({
          id: 'incidents-heat-layer',
          type: 'heatmap',
          source: 'incidents-heat',
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 2] as any,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(29,78,216,0)',
              0.2, 'rgba(29,78,216,0.6)',
              0.5, 'rgba(251,146,60,0.8)',
              0.8, 'rgba(239,68,68,0.9)',
              1,   'rgb(185,28,28)',
            ] as any,
            'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 5, 18, 10, 35] as any,
            'heatmap-opacity': 0.85,
          },
        })
        sourceLoaded.current = true
      })
      map.on('error', () => setMapError('Map failed to load'))
      mapRef.current = map
    } catch {
      setMapError('Map initialization failed')
    }

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      sourceLoaded.current = false
    }
  }, [token, tokenError]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update heatmap data when incidents or resolved coords change
  useEffect(() => {
    if (!mapRef.current || !sourceLoaded.current) return
    ;(mapRef.current.getSource('incidents-heat') as mapboxgl.GeoJSONSource | undefined)
      ?.setData(buildGeoJson(incidents, resolvedCoords))
  }, [incidents, resolvedCoords])

  const hotspots = useMemo(
    () => buildHotspots(incidents, resolvedCoords),
    [incidents, resolvedCoords]
  )

  const handleHotspotClick = (row: HotspotRow) => {
    if (!mapRef.current || !row.coords) return
    mapRef.current.flyTo({ center: [row.coords.lng, row.coords.lat], zoom: 10 })
  }

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
      <Box sx={{ px: 2.25, pt: 2.25, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 800, flex: 1 }}>{t('dashboard.heatmap_title')}</Typography>
        {geocoding && <CircularProgress size={14} />}
      </Box>

      <Box sx={{ position: 'relative', height: 380, flexShrink: 0 }}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />

        {(mapError || tokenError) && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.background.paper, 0.9) }}>
            <Typography variant="body2" color="text.secondary">{mapError ?? tokenError}</Typography>
          </Box>
        )}
      </Box>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary">{t('dashboard.heatmap_low')}</Typography>
        <Box sx={{ flex: 1, height: 5, borderRadius: 1, background: 'linear-gradient(to right, rgba(29,78,216,0.6), rgba(251,146,60,0.8), rgb(185,28,28))' }} />
        <Typography variant="caption" color="text.secondary">{t('dashboard.heatmap_high')}</Typography>
      </Stack>

      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, fontWeight: 700 }}>
          {t('dashboard.top_10_black_spot_locations')}
        </Typography>
        <List disablePadding dense sx={{ maxHeight: 220, overflow: 'auto', mt: 0.5 }}>
          {hotspots.length === 0 ? (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">{t('dashboard.no_hotspot_data_yet')}</Typography>
            </Box>
          ) : (
            hotspots.map((row, idx) => (
              <ListItem
                key={`${row.location}-${idx}`}
                onClick={() => handleHotspotClick(row)}
                sx={{
                  px: 1, py: 0.5, borderRadius: 2, cursor: row.coords ? 'pointer' : 'default', mb: 0.25,
                  '&:hover': row.coords ? { bgcolor: alpha(theme.palette.primary.main, 0.06) } : {},
                }}
              >
                <ListItemAvatar sx={{ minWidth: 32 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}>
                    {idx + 1}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
                      {row.location}
                    </Typography>
                  }
                />
                <Chip size="small" label={row.count} sx={{ height: 18, fontSize: 10 }} />
              </ListItem>
            ))
          )}
        </List>
      </Box>
    </Paper>
  )
}
