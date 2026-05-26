import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Avatar, Box, Chip, List, ListItem, ListItemAvatar, ListItemText,
  Paper, Stack, Typography, alpha, useTheme,
} from '@mui/material'
import type { Incident } from '../../../incidents/slices/incidentsSlice'
import { getMapboxToken } from '@/utils/mapboxToken'
import { useTranslation } from '../../../../themeMode'

interface HotspotRow {
  location: string
  count: number
  avgLat: number | null
  avgLng: number | null
}

function buildHotspots(incidents: Incident[]): HotspotRow[] {
  const acc: Record<string, { location: string; count: number; lats: number[]; lngs: number[] }> = {}
  for (const inc of incidents) {
    const key = inc.location.trim().toLowerCase()
    if (!acc[key]) acc[key] = { location: inc.location.trim(), count: 0, lats: [], lngs: [] }
    acc[key].count += 1
    if (inc.latitude != null && inc.longitude != null) {
      acc[key].lats.push(inc.latitude)
      acc[key].lngs.push(inc.longitude)
    }
  }
  return Object.values(acc)
    .map((v) => ({
      location: v.location,
      count: v.count,
      avgLat: v.lats.length ? v.lats.reduce((a, b) => a + b, 0) / v.lats.length : null,
      avgLng: v.lngs.length ? v.lngs.reduce((a, b) => a + b, 0) / v.lngs.length : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function buildGeoJson(incidents: Incident[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: incidents
      .filter((i) => i.latitude != null && i.longitude != null)
      .map((i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [i.longitude!, i.latitude!] },
        properties: { id: i.id },
      })),
  }
}

export default function IncidentHeatmapPanel({ incidents }: { incidents: Incident[] }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const sourceLoaded = useRef(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const hotspots  = useMemo(() => buildHotspots(incidents), [incidents])
  const hasCoords = useMemo(() => incidents.some((i) => i.latitude != null && i.longitude != null), [incidents])

  useEffect(() => {
    const token = getMapboxToken()
    if (!token || !containerRef.current || mapRef.current) return
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
        map.addSource('incidents-heat', { type: 'geojson', data: buildGeoJson(incidents) })
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
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 18, 10, 35] as any,
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current || !sourceLoaded.current) return
    ;(mapRef.current.getSource('incidents-heat') as mapboxgl.GeoJSONSource | undefined)
      ?.setData(buildGeoJson(incidents))
  }, [incidents])

  const handleHotspotClick = (row: HotspotRow) => {
    if (!mapRef.current || row.avgLat == null || row.avgLng == null) return
    mapRef.current.flyTo({ center: [row.avgLng, row.avgLat], zoom: 10 })
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
      <Box sx={{ px: 2.25, pt: 2.25, pb: 1 }}>
        <Typography sx={{ fontWeight: 800 }}>{t('dashboard.heatmap_title')}</Typography>
      </Box>

      <Box sx={{ position: 'relative', height: 320, flexShrink: 0 }}>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
        {mapError && (
          <Box
            sx={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha(theme.palette.background.paper, 0.9),
            }}
          >
            <Typography variant="body2" color="text.secondary">{mapError}</Typography>
          </Box>
        )}
        {!hasCoords && !mapError && (
          <Box
            sx={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha(theme.palette.background.paper, 0.85),
            }}
          >
            <Typography variant="body2" color="text.secondary">{t('dashboard.no_location_data')}</Typography>
          </Box>
        )}
      </Box>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary">{t('dashboard.heatmap_low')}</Typography>
        <Box
          sx={{
            flex: 1, height: 5, borderRadius: 1,
            background: 'linear-gradient(to right, rgba(29,78,216,0.6), rgba(251,146,60,0.8), rgb(185,28,28))',
          }}
        />
        <Typography variant="caption" color="text.secondary">{t('dashboard.heatmap_high')}</Typography>
      </Stack>

      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, fontWeight: 700 }}>
          {t('dashboard.top_10_black_spot_locations')}
        </Typography>
        <List disablePadding dense sx={{ maxHeight: 220, overflow: 'auto', mt: 0.5 }}>
          {hotspots.length === 0 ? (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.no_hotspot_data_yet')}
              </Typography>
            </Box>
          ) : (
            hotspots.map((row, idx) => (
              <ListItem
                key={`${row.location}-${idx}`}
                onClick={() => handleHotspotClick(row)}
                sx={{
                  px: 1, py: 0.5, borderRadius: 2, cursor: 'pointer', mb: 0.25,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                }}
              >
                <ListItemAvatar sx={{ minWidth: 32 }}>
                  <Avatar
                    sx={{
                      width: 24, height: 24, fontSize: 10, fontWeight: 800,
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: 'primary.main',
                    }}
                  >
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
