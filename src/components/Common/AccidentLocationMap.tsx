import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { alpha, Box, TextField, Typography, Paper, IconButton, CircularProgress, useTheme } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useTranslation } from '@/themeMode'
import { getMapStyle } from '@/utils/mapStyle'
import { reverseGeocode, geocodeAddress } from '@/utils/mapService'

interface Location {
  latitude: number
  longitude: number
  description?: string
  adminContext?: {
    governorate?: string
    delegation?: string
    municipality?: string
    sector?: string
  }
}

interface AccidentLocationMapProps {
  initialLocation?: Location
  onLocationChange?: (location: Location) => void
  height?: string | number
  showSearch?: boolean
  readOnly?: boolean
  showInstructions?: boolean
  markerVariant?: 'accident' | 'alert'
}

export default function AccidentLocationMap({
  initialLocation = { latitude: 34.7678, longitude: 9.5615 },
  onLocationChange,
  height = '400px',
  showSearch = true,
  readOnly = false,
  showInstructions = true,
  markerVariant = 'accident',
}: AccidentLocationMapProps) {
  const theme = useTheme()
  const { t } = useTranslation()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: getMapStyle(),
        center: [initialLocation.longitude, initialLocation.latitude],
        zoom: 12,
        attributionControl: false,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(`Failed to initialize map.${msg ? ` (${msg})` : ''}`)
      setLoading(false)
      return
    }

    map.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right')

    if (!readOnly) {
      const geolocate = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserHeading: false,
        showAccuracyCircle: true,
      })
      geolocate.on('error', (evt: { code?: number }) => {
        setError(evt?.code === 1
          ? 'Location permission denied. Enable location access to use this feature.'
          : 'Unable to retrieve your location right now.')
      })
      map.current.addControl(geolocate, 'top-right')

      map.current.on('click', (e) => {
        updateLocation(e.lngLat.lat, e.lngLat.lng)
      })
    }

    if (initialLocation.latitude && initialLocation.longitude) {
      addMarker(initialLocation.latitude, initialLocation.longitude)
    }

    map.current.on('load', () => setLoading(false))
    map.current.on('error', () => {
      setError('Failed to load map style or tiles.')
      setLoading(false)
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  const addMarker = (lat: number, lng: number) => {
    if (!map.current) return
    marker.current?.remove()

    const el = document.createElement('div')
    el.className = markerVariant === 'alert' ? 'alert-marker' : 'collision-marker'
    el.style.cssText = 'width:44px;height:54px;cursor:pointer;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 14px rgba(0,0,0,0.35))'
    el.innerHTML = markerVariant === 'alert'
      ? "<svg viewBox='0 0 44 54' width='44' height='54'><defs><linearGradient id='alertPinGrad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#2563eb'/><stop offset='100%' stop-color='#1d4ed8'/></linearGradient></defs><path d='M22 2C11.5 2 3 10.5 3 21c0 12.4 14.1 24.8 17.9 27.7.7.5 1.5.5 2.2 0C26.9 45.8 41 33.4 41 21 41 10.5 32.5 2 22 2z' fill='url(#alertPinGrad)' stroke='#ffffff' stroke-width='2'/><circle cx='22' cy='21' r='11.2' fill='#ffffff'/><path fill='#1d4ed8' d='M22 12.2a4.8 4.8 0 00-4.8 4.8v2.1l-.9 1.6a1.2 1.2 0 001.05 1.8h9.44a1.2 1.2 0 001.05-1.8l-.9-1.6V17a4.8 4.8 0 00-4.8-4.8zm0 14.6a2.3 2.3 0 002.2-1.7h-4.4a2.3 2.3 0 002.2 1.7z'/></svg>"
      : "<svg viewBox='0 0 44 54' width='44' height='54'><defs><linearGradient id='accidentPinGrad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#ef4444'/><stop offset='70%' stop-color='#dc2626'/><stop offset='100%' stop-color='#991b1b'/></linearGradient></defs><path d='M22 2C11.5 2 3 10.5 3 21c0 12.4 14.1 24.8 17.9 27.7.7.5 1.5.5 2.2 0C26.9 45.8 41 33.4 41 21 41 10.5 32.5 2 22 2z' fill='url(#accidentPinGrad)' stroke='#ffffff' stroke-width='2'/><circle cx='22' cy='21' r='11.2' fill='#ffffff'/><g transform='translate(12.3,11.3) scale(0.8)'><path fill='#b91c1c' d='M18 1c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5m.5 6h-1V3h1zm0 1v1h-1V8zm-.59 5c.06.16.09.33.09.5 0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5c0-.39.15-.74.39-1.01-1.63-.66-2.96-1.91-3.71-3.49H5.81l1.04-3H11c0-.69.1-1.37.29-2H5.41L3 11v9h3v-2h12v2h3v-7.68c-1.05.51-2.16.69-3.09.68M7.5 15c-.83 0-1.5-.67-1.5-1.5S6.67 12 7.5 12s1.5.67 1.5 1.5S8.33 15 7.5 15'/></g></svg>"

    marker.current = new maplibregl.Marker(el)
      .setLngLat([lng, lat])
      .addTo(map.current)

    marker.current.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
      `<div style="padding:4px"><strong>Collision Location</strong><br/><small>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</small></div>`
    ))
  }

  const updateLocation = (lat: number, lng: number, description?: string) => {
    addMarker(lat, lng)
    map.current?.flyTo({ center: [lng, lat], zoom: 15, essential: true })
    onLocationChange?.({ latitude: lat, longitude: lng, description })

    if (!description) {
      reverseGeocode(lat, lng).then((placeName) => {
        if (!placeName) return
        setAddress(placeName)
        onLocationChange?.({ latitude: lat, longitude: lng, description: placeName })
      })
    } else {
      setAddress(description)
    }
  }

  const handleSearch = async () => {
    if (!address.trim()) return
    setLoading(true)
    const result = await geocodeAddress(address.trim())
    setLoading(false)
    if (!result) {
      setError('Location not found')
      return
    }
    updateLocation(result.lat, result.lng)
  }

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 2.5,
        overflow: 'hidden',
        isolation: 'isolate',
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        boxShadow: `0 14px 34px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.45 : 0.14)}`,
      }}
    >
      <Box
        ref={mapContainer}
        sx={{
          width: '100%',
          height: '100%',
          '& .maplibregl-ctrl-top-right': { top: { xs: 90, sm: 16 }, right: 12, zIndex: 6 },
          '& .maplibregl-ctrl-group': {
            border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            borderRadius: 1.75,
            overflow: 'hidden',
            boxShadow: `0 12px 26px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.42 : 0.2)}`,
          },
          '& .maplibregl-ctrl-group button': {
            width: 38, height: 38,
            backgroundColor: theme.palette.mode === 'dark' ? '#1f2937' : '#ffffff',
            transition: 'background-color 120ms ease',
            '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#374151' : '#f8fafc' },
          },
          '& .maplibregl-ctrl-group button + button': { borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}` },
          '& .maplibregl-ctrl-attrib': {
            margin: 8, borderRadius: 10,
            border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
            backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.86) : alpha(theme.palette.common.white, 0.9),
            color: theme.palette.text.secondary,
            backdropFilter: 'blur(6px)',
            fontSize: '11px',
          },
          '& .maplibregl-ctrl-attrib a': { color: theme.palette.text.primary },
        }}
      />

      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.62) : alpha(theme.palette.common.white, 0.7), backdropFilter: 'blur(2px)', zIndex: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Paper sx={{ position: 'absolute', bottom: 16, left: 16, right: 16, p: 1.2, bgcolor: alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.86 : 0.92), color: theme.palette.error.contrastText, borderRadius: 2, zIndex: 5 }}>
          <Typography variant="caption">{error}</Typography>
        </Paper>
      )}

      {!readOnly && showSearch && (
        <Box sx={{ position: 'absolute', top: 16, left: 16, right: { xs: 16, sm: 88 }, display: 'flex', gap: 1, zIndex: 5, p: 1, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.85)}`, backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.86) : alpha(theme.palette.common.white, 0.9), backdropFilter: 'blur(8px)', boxShadow: `0 10px 26px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.36 : 0.12)}` }}>
          <TextField
            fullWidth size="small" placeholder="Search address..."
            value={address} onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.72) : alpha(theme.palette.common.white, 0.98) } }}
          />
          <IconButton onClick={handleSearch} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', borderRadius: 1.5, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.18) } }}>
            <SearchIcon />
          </IconButton>
        </Box>
      )}

      {!readOnly && showInstructions && (
        <Paper sx={{ position: 'absolute', bottom: 16, insetInlineStart: 16, p: 1.1, paddingInlineEnd: 10, borderRadius: 2, color: theme.palette.text.primary, border: `1px solid ${alpha(theme.palette.divider, 0.82)}`, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.86) : alpha(theme.palette.common.white, 0.9), backdropFilter: 'blur(6px)', zIndex: 5 }}>
          <Typography variant="caption">{t('maps.select_location')}</Typography>
        </Paper>
      )}
    </Box>
  )
}
