# Mapbox → MapLibre Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `mapbox-gl`, `@mapbox/mapbox-gl-geocoder`, and the Mapbox geocoding API with `maplibre-gl`, Martin vector tiles, and Photon geocoding — eliminating the Mapbox access token requirement entirely.

**Architecture:** The versatiles-neutrino style JSON is stored in `src/assets/map/neutrino/style.json` with three placeholder strings; a new `mapStyle.ts` utility fills them synchronously at runtime from `import.meta.env` using Vite's `?raw` import. All five map components swap their `mapbox-gl` import for `maplibre-gl` (API-compatible), drop token logic, and call `getMapStyle()` for the style object. Geocoding calls in two components are rewritten to hit the Photon REST API instead of the Mapbox geocoding API.

**Tech Stack:** MapLibre GL JS v4, Vite `?raw` import, Photon geocoding API, Martin vector tile server, VersaTiles neutrino style, Vitest, React Testing Library.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/assets/map/neutrino/style.json` | Versatiles-neutrino style template with placeholders |
| Create | `src/utils/mapStyle.ts` | Fill placeholders, return `StyleSpecification` |
| Create | `src/utils/mapStyle.test.ts` | Unit tests for placeholder replacement |
| Create | `src/utils/mapService.ts` | `MapService` class + Photon geocoding functions |
| Create | `src/utils/mapService.test.ts` | Unit tests for Photon geocoding |
| Delete | `src/utils/mapboxToken.ts` | No longer needed (no token) |
| Delete | `src/utils/mapbox.ts` | Replaced by mapService.ts |
| Delete | `src/types/mapbox.d.ts` | MapLibre ships its own types |
| Modify | `.env` + `.env.example` | Replace MAPBOX token var with new vars |
| Modify | `src/components/Common/AccidentLocationMap.tsx` | maplibre-gl + Photon geocoding |
| Modify | `src/components/Common/IncidentsMap.tsx` | maplibre-gl + Photon geocoding |
| Modify | `src/components/Common/OfficerTrackingMap.tsx` | maplibre-gl import/style/CSS only |
| Modify | `src/components/Common/AlertsMap.tsx` | maplibre-gl import/style/CSS only |
| Modify | `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx` | maplibre-gl import/style/CSS only |

---

## Task 1: Swap npm packages

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Uninstall Mapbox packages**

```bash
npm uninstall mapbox-gl @mapbox/mapbox-gl-geocoder @types/mapbox__mapbox-gl-geocoder
```

Expected: packages removed from `node_modules` and `package.json`.

- [ ] **Step 2: Install MapLibre GL**

```bash
npm install maplibre-gl
```

Expected: `"maplibre-gl"` appears in `package.json` dependencies.

- [ ] **Step 3: Verify TypeScript types ship with maplibre-gl**

```bash
ls node_modules/maplibre-gl/dist/maplibre-gl.d.ts
```

Expected: file exists (MapLibre ships its own types, no `@types/` package needed).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: replace mapbox-gl with maplibre-gl"
```

---

## Task 2: Add style asset + update env vars

**Files:** `src/assets/map/neutrino/style.json` (create), `.env`, `.env.example`

- [ ] **Step 1: Create the assets directory**

```bash
mkdir -p src/assets/map/neutrino
```

- [ ] **Step 2: Copy the versatiles-neutrino style template**

Create `src/assets/map/neutrino/style.json` with the full versatiles-neutrino style JSON (the one shared during design). It must contain these exact placeholder strings (do not replace them — they are filled at runtime):
- `__MARTIN_SOURCE_URL__`
- `__GLYPHS_URL__`
- `__SPRITE_BASICS_URL__`

The source block in the style must look like:
```json
"sources": {
  "versatiles-shortbread": {
    "attribution": "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
    "url": "__MARTIN_SOURCE_URL__",
    "type": "vector",
    "scheme": "xyz",
    "bounds": [ -180, -85.0511287798066, 180, 85.0511287798066 ],
    "minzoom": 0,
    "maxzoom": 14
  }
}
```

- [ ] **Step 3: Update `.env`**

Replace the Mapbox token line and add the new vars:

```bash
# Remove this line:
# VITE_MAPBOX_ACCESS_TOKEN=pk.your_public_mapbox_token

# Add these lines:
VITE_MARTIN_BASE_URL=https://martin.micladevops.com
VITE_MARTIN_TILESET_ID=basemap
VITE_PHOTON_BASE_URL=https://photon.micladevops.com
VITE_VALHALLA_BASE_URL=https://valhalla.micladevops.com
VITE_MAP_GLYPHS_URL=https://tiles.versatiles.org/assets/glyphs/{fontstack}/{range}.pbf
VITE_MAP_SPRITE_BASICS_URL=https://tiles.versatiles.org/assets/sprites/basics/sprites
```

- [ ] **Step 4: Update `.env.example`** with the same new vars (without real values).

- [ ] **Step 5: Commit**

```bash
git add src/assets/map/neutrino/style.json .env.example
git commit -m "feat: add versatiles-neutrino style template and new map env vars"
```

---

## Task 3: Create `src/utils/mapStyle.ts`

**Files:** `src/utils/mapStyle.ts` (create), `src/utils/mapStyle.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/utils/mapStyle.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../assets/map/neutrino/style.json?raw', () => ({
  default: JSON.stringify({
    version: 8,
    glyphs: '__GLYPHS_URL__',
    sprite: [{ id: 'basics', url: '__SPRITE_BASICS_URL__' }],
    sources: {
      'versatiles-shortbread': { url: '__MARTIN_SOURCE_URL__', type: 'vector' },
    },
    layers: [],
  }),
}))

describe('getMapStyle', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MARTIN_BASE_URL', 'https://martin.example.com')
    vi.stubEnv('VITE_MARTIN_TILESET_ID', 'basemap')
    vi.stubEnv('VITE_MAP_GLYPHS_URL', 'https://glyphs.example.com/{fontstack}/{range}.pbf')
    vi.stubEnv('VITE_MAP_SPRITE_BASICS_URL', 'https://sprites.example.com/basics')
  })

  it('fills __MARTIN_SOURCE_URL__ placeholder', async () => {
    const { getMapStyle } = await import('./mapStyle')
    const style = getMapStyle()
    const src = (style.sources as Record<string, { url: string }>)['versatiles-shortbread']
    expect(src.url).toBe('https://martin.example.com/basemap')
  })

  it('fills __GLYPHS_URL__ placeholder', async () => {
    const { getMapStyle } = await import('./mapStyle')
    const style = getMapStyle()
    expect(style.glyphs).toBe('https://glyphs.example.com/{fontstack}/{range}.pbf')
  })

  it('fills __SPRITE_BASICS_URL__ placeholder', async () => {
    const { getMapStyle } = await import('./mapStyle')
    const style = getMapStyle()
    const sprites = style.sprite as Array<{ url: string }>
    expect(sprites[0].url).toBe('https://sprites.example.com/basics')
  })

  it('leaves no placeholder strings in output', async () => {
    const { getMapStyle } = await import('./mapStyle')
    const raw = JSON.stringify(getMapStyle())
    expect(raw).not.toContain('__MARTIN_SOURCE_URL__')
    expect(raw).not.toContain('__GLYPHS_URL__')
    expect(raw).not.toContain('__SPRITE_BASICS_URL__')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/utils/mapStyle.test.ts
```

Expected: FAIL — `mapStyle` module not found.

- [ ] **Step 3: Create `src/utils/mapStyle.ts`**

```typescript
import type { StyleSpecification } from 'maplibre-gl'
import styleTemplateRaw from '../assets/map/neutrino/style.json?raw'

let cachedStyle: StyleSpecification | null = null

export function getMapStyle(): StyleSpecification {
  if (cachedStyle) return cachedStyle

  const martinUrl = `${import.meta.env.VITE_MARTIN_BASE_URL}/${import.meta.env.VITE_MARTIN_TILESET_ID}`
  const glyphsUrl = import.meta.env.VITE_MAP_GLYPHS_URL ?? 'https://tiles.versatiles.org/assets/glyphs/{fontstack}/{range}.pbf'
  const spriteUrl = import.meta.env.VITE_MAP_SPRITE_BASICS_URL ?? 'https://tiles.versatiles.org/assets/sprites/basics/sprites'

  const filled = styleTemplateRaw
    .replace('__MARTIN_SOURCE_URL__', martinUrl)
    .replace('__GLYPHS_URL__', glyphsUrl)
    .replace('__SPRITE_BASICS_URL__', spriteUrl)

  cachedStyle = JSON.parse(filled) as StyleSpecification
  return cachedStyle
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/utils/mapStyle.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/mapStyle.ts src/utils/mapStyle.test.ts
git commit -m "feat: add mapStyle utility with placeholder replacement"
```

---

## Task 4: Create `src/utils/mapService.ts` (Photon geocoding)

**Files:** `src/utils/mapService.ts` (create), `src/utils/mapService.test.ts` (create)

- [ ] **Step 1: Write failing tests**

Create `src/utils/mapService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { geocodeAddress, reverseGeocode } from './mapService'

const PHOTON_BASE = 'https://photon.example.com'

beforeEach(() => {
  vi.stubEnv('VITE_PHOTON_BASE_URL', PHOTON_BASE)
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const makeFeatureCollection = (lng: number, lat: number, props = {}) => ({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { name: 'Test Place', city: 'Tunis', country: 'Tunisia', ...props },
  }],
})

describe('geocodeAddress', () => {
  it('returns lat/lng from Photon response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeFeatureCollection(10.18, 36.81),
    } as Response)

    const result = await geocodeAddress('Tunis')
    expect(result).toEqual({ lat: 36.81, lng: 10.18 })
    expect(global.fetch).toHaveBeenCalledWith(
      `${PHOTON_BASE}/api?q=Tunis&limit=1`
    )
  })

  it('returns null when no features returned', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    } as Response)

    const result = await geocodeAddress('nowhere')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))
    const result = await geocodeAddress('Tunis')
    expect(result).toBeNull()
  })
})

describe('reverseGeocode', () => {
  it('builds display string from Photon properties', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeFeatureCollection(10.18, 36.81, {
        name: 'Avenue Habib Bourguiba',
        street: 'Avenue Habib Bourguiba',
        city: 'Tunis',
        state: 'Tunis Governorate',
        country: 'Tunisia',
      }),
    } as Response)

    const result = await reverseGeocode(36.81, 10.18)
    expect(result).toBe('Avenue Habib Bourguiba, Tunis, Tunis Governorate, Tunisia')
    expect(global.fetch).toHaveBeenCalledWith(
      `${PHOTON_BASE}/reverse?lat=36.81&lon=10.18&limit=1`
    )
  })

  it('returns null when no features returned', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    } as Response)

    const result = await reverseGeocode(36.81, 10.18)
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))
    const result = await reverseGeocode(36.81, 10.18)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/utils/mapService.test.ts
```

Expected: FAIL — `mapService` module not found.

- [ ] **Step 3: Create `src/utils/mapService.ts`**

```typescript
import maplibregl from 'maplibre-gl'
import { getMapStyle } from './mapStyle'

export interface MapLocation {
  latitude: number
  longitude: number
  description?: string
  roadReference?: string
  kilometerMarker?: string
}

export interface MapMarker {
  id: string
  latitude: number
  longitude: number
  type: 'incident' | 'selected' | 'search'
  description?: string
  title?: string
}

export class MapService {
  private map: maplibregl.Map | null = null
  private markers: maplibregl.Marker[] = []

  initMap(container: string | HTMLElement, options?: Partial<maplibregl.MapOptions>): maplibregl.Map {
    this.map = new maplibregl.Map({
      container,
      style: getMapStyle(),
      center: [9.5615, 34.7678],
      zoom: 7,
      ...options,
    })
    this.map.addControl(new maplibregl.NavigationControl())
    return this.map
  }

  getMap(): maplibregl.Map | null {
    return this.map
  }

  addMarker(marker: MapMarker): maplibregl.Marker {
    if (!this.map) throw new Error('Map not initialized')

    const el = document.createElement('div')
    el.className = 'marker'
    el.style.width = '30px'
    el.style.height = '30px'
    el.style.cursor = 'pointer'

    const mapMarker = new maplibregl.Marker(el)
      .setLngLat([marker.longitude, marker.latitude])
      .addTo(this.map)

    if (marker.type === 'incident' && marker.title) {
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="padding:8px"><h4 style="margin:0 0 8px;font-size:14px">${marker.title}</h4><p style="margin:0;font-size:12px">${marker.description ?? ''}</p></div>`
      )
      mapMarker.setPopup(popup)
    }

    this.markers.push(mapMarker)
    return mapMarker
  }

  clearMarkers(): void {
    this.markers.forEach((m) => m.remove())
    this.markers = []
  }

  fitBounds(): void {
    if (!this.map || this.markers.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    this.markers.forEach((m) => bounds.extend(m.getLngLat()))
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 15 })
  }

  setView(center: [number, number], zoom: number): void {
    this.map?.flyTo({ center, zoom, essential: true })
  }

  onClick(callback: (lngLat: maplibregl.LngLat) => void): void {
    this.map?.on('click', (e) => callback(e.lngLat))
  }

  destroy(): void {
    this.clearMarkers()
    this.map?.remove()
    this.map = null
  }
}

export const mapService = new MapService()

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  const base = import.meta.env.VITE_PHOTON_BASE_URL
  try {
    const res = await fetch(`${base}/api?q=${encodeURIComponent(address)}&limit=1`)
    const data = await res.json()
    if (!data.features?.length) return null
    const [lng, lat] = data.features[0].geometry.coordinates
    return { lat: Number(lat), lng: Number(lng) }
  } catch {
    return null
  }
}

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  const base = import.meta.env.VITE_PHOTON_BASE_URL
  try {
    const res = await fetch(`${base}/reverse?lat=${lat}&lon=${lng}&limit=1`)
    const data = await res.json()
    if (!data.features?.length) return null
    const p = data.features[0].properties as Record<string, string | undefined>
    return [p.name, p.street, p.city, p.state, p.country].filter(Boolean).join(', ') || null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/utils/mapService.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/mapService.ts src/utils/mapService.test.ts
git commit -m "feat: add MapService and Photon geocoding (replaces Mapbox)"
```

---

## Task 5: Migrate `AccidentLocationMap.tsx`

**Files:** `src/components/Common/AccidentLocationMap.tsx`

This component has the most changes: geocoding calls, address search, and admin hierarchy extraction all switch from Mapbox to Photon.

- [ ] **Step 1: Replace the entire file content**

`src/components/Common/AccidentLocationMap.tsx`:

```typescript
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

    new maplibregl.Popup({ offset: 25 })
      .setHTML(`<div style="padding:4px"><strong>Collision Location</strong><br/><small>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</small></div>`)
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
```

- [ ] **Step 2: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all previously passing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/Common/AccidentLocationMap.tsx
git commit -m "feat: migrate AccidentLocationMap to MapLibre + Photon geocoding"
```

---

## Task 6: Migrate `IncidentsMap.tsx`

**Files:** `src/components/Common/IncidentsMap.tsx`

- [ ] **Step 1: Replace imports and geocoding in the file**

Change the top of the file:
```typescript
// REMOVE:
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'

// ADD:
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMapStyle } from '@/utils/mapStyle'
import { geocodeAddress } from '@/utils/mapService'
```

- [ ] **Step 2: Update type annotations and refs**

```typescript
// CHANGE every occurrence of:
mapboxgl.Map  → maplibregl.Map
mapboxgl.Marker → maplibregl.Marker

// In the component:
const mapRef = useRef<maplibregl.Map | null>(null)
const markersRef = useRef<maplibregl.Marker[]>([])
```

- [ ] **Step 3: Update map initialization effect**

Replace the token-guard block and map init:
```typescript
// REMOVE:
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
  } catch (err) { ... }
  mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
  mapRef.current.on('error', () => setError(t('maps.failed_to_load_map')))
  return () => { ... }
}, [token, tokenError])

// REPLACE WITH:
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
  return () => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    mapRef.current?.remove()
    mapRef.current = null
  }
}, [])
```

- [ ] **Step 4: Replace the geocoding effect**

Replace the Mapbox geocoding fetch inside the `resolve` function:
```typescript
// REMOVE the inner fetch:
const response = await fetch(
  `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=tn&limit=1`
)
const data = await response.json()
const center = data?.features?.[0]?.center
if (!Array.isArray(center) || center.length < 2) return null
return { id, coords: { lng: Number(center[0]), lat: Number(center[1]) } }

// REPLACE WITH:
const coords = await geocodeAddress(query)
if (!coords) return null
return { id, coords: { lng: coords.lng, lat: coords.lat } }
```

Also remove the `token` and `tokenError` dependencies from the geocoding effect's dependency array, and remove the early `if (tokenError) return` guard.

- [ ] **Step 5: Update marker creation**

```typescript
// CHANGE:
const marker = new mapboxgl.Marker({ element: createIncidentMarkerElement(incident.severity) })
  .setLngLat([coords.lng, coords.lat])
  .setPopup(popup)
  .addTo(mapRef.current!)

// TO:
const marker = new maplibregl.Marker({ element: createIncidentMarkerElement(incident.severity) })
  .setLngLat([coords.lng, coords.lat])
  .setPopup(popup)
  .addTo(mapRef.current!)
```

- [ ] **Step 6: Update bounds and popup**

```typescript
// CHANGE:
const bounds = new mapboxgl.LngLatBounds()
// ...
const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(...)

// TO:
const bounds = new maplibregl.LngLatBounds()
// ...
const popup = new maplibregl.Popup({ offset: 20 }).setHTML(...)
```

- [ ] **Step 7: Update CSS class names in the `sx` prop**

```typescript
// CHANGE in the Box sx prop:
'& .mapboxgl-popup-content': { ... }
'& .mapboxgl-popup-tip': { ... }

// TO:
'& .maplibregl-popup-content': { ... }
'& .maplibregl-popup-tip': { ... }
```

- [ ] **Step 8: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/Common/IncidentsMap.tsx
git commit -m "feat: migrate IncidentsMap to MapLibre + Photon geocoding"
```

---

## Task 7: Migrate `OfficerTrackingMap.tsx`

**Files:** `src/components/Common/OfficerTrackingMap.tsx`

No geocoding in this component — only import/style/CSS changes.

- [ ] **Step 1: Replace imports**

```typescript
// REMOVE:
import mapboxgl from 'mapbox-gl'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'

// ADD:
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMapStyle } from '@/utils/mapStyle'
```

- [ ] **Step 2: Replace all `mapboxgl.` references with `maplibregl.`**

```bash
# Verify what needs changing:
grep -n "mapboxgl\." src/components/Common/OfficerTrackingMap.tsx
```

Apply these replacements throughout the file:
- `mapboxgl.Map` → `maplibregl.Map`
- `mapboxgl.NavigationControl` → `maplibregl.NavigationControl`
- `mapboxgl.Popup` → `maplibregl.Popup`
- `mapboxgl.GeoJSONSource` → `maplibregl.GeoJSONSource`
- `mapboxgl.MapMouseEvent` → `maplibregl.MapMouseEvent`
- Any other `mapboxgl.*` types

- [ ] **Step 3: Remove token guard and update map initialization**

Find the map init block (in the main `useEffect`) and:
```typescript
// REMOVE lines like:
const token = getMapboxToken()
mapboxgl.accessToken = token
if (tokenError) { setError(...); return }

// CHANGE map init style from:
style: 'mapbox://styles/mapbox/streets-v12'
// TO:
style: getMapStyle()
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Common/OfficerTrackingMap.tsx
git commit -m "feat: migrate OfficerTrackingMap to MapLibre"
```

---

## Task 8: Migrate `AlertsMap.tsx`

**Files:** `src/components/Common/AlertsMap.tsx`

No geocoding — import/style/CSS changes only.

- [ ] **Step 1: Replace imports**

```typescript
// REMOVE:
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'

// ADD:
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMapStyle } from '@/utils/mapStyle'
```

- [ ] **Step 2: Replace all `mapboxgl.` references**

Apply globally in this file:
- `mapboxgl.Map` → `maplibregl.Map`
- `mapboxgl.Marker` → `maplibregl.Marker`
- `mapboxgl.Popup` → `maplibregl.Popup`
- `mapboxgl.NavigationControl` → `maplibregl.NavigationControl`
- `mapboxgl.LngLatBounds` → `maplibregl.LngLatBounds`

- [ ] **Step 3: Remove token guard, update map style**

```typescript
// REMOVE token lines, CHANGE style to:
style: getMapStyle()
```

- [ ] **Step 4: Update CSS class names in `sx` props**

```typescript
'& .mapboxgl-popup-content' → '& .maplibregl-popup-content'
'& .mapboxgl-popup-tip'     → '& .maplibregl-popup-tip'
```

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run
git add src/components/Common/AlertsMap.tsx
git commit -m "feat: migrate AlertsMap to MapLibre"
```

---

## Task 9: Migrate `IncidentHeatmapPanel.tsx`

**Files:** `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx`

No geocoding — import/style/CSS changes only.

- [ ] **Step 1: Replace imports**

```typescript
// REMOVE:
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getMapboxToken, getMapboxTokenError } from '@/utils/mapboxToken'

// ADD:
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMapStyle } from '@/utils/mapStyle'
```

- [ ] **Step 2: Replace all `mapboxgl.` references**

Apply globally:
- `mapboxgl.Map` → `maplibregl.Map`
- `mapboxgl.Marker` → `maplibregl.Marker`
- `mapboxgl.Popup` → `maplibregl.Popup`
- `mapboxgl.NavigationControl` → `maplibregl.NavigationControl`
- `mapboxgl.LngLatBounds` → `maplibregl.LngLatBounds`

- [ ] **Step 3: Remove token guard, update style**

```typescript
style: getMapStyle()
```

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run
git add src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx
git commit -m "feat: migrate IncidentHeatmapPanel to MapLibre"
```

---

## Task 10: Final cleanup and verification

**Files:** All source files (read-only scan), `src/utils/mapboxToken.ts`, `src/utils/mapbox.ts`, `src/types/mapbox.d.ts`

- [ ] **Step 1: Confirm no remaining Mapbox references in source**

```bash
grep -rn "mapbox" src --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Expected: zero matches. If any remain, fix them before continuing.

- [ ] **Step 2: Delete obsolete Mapbox files**

```bash
rm -f src/utils/mapboxToken.ts src/utils/mapbox.ts src/types/mapbox.d.ts
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass, zero failures.

- [ ] **Step 4: TypeScript clean check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Confirm maplibre-gl CSS is not loading both old and new**

```bash
grep -rn "mapbox-gl/dist" src --include="*.tsx" --include="*.ts"
```

Expected: zero matches.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: remove obsolete Mapbox files, verify clean migration to MapLibre"
```

---

## Manual Smoke Test Checklist

After all tasks complete, verify in the browser (`npm run dev`):

- [ ] Dashboard heatmap panel renders map tiles (not a blank screen or error)
- [ ] Incidents page map shows incident markers with popups
- [ ] Alerts page map shows alert pins
- [ ] Officer tracking page map shows officer dots and updates live
- [ ] `AccidentLocationMap` (in incident creation form) — click on map sets location marker
- [ ] `AccidentLocationMap` — type an address in the search box and press Enter, map pans to result
- [ ] No browser console errors mentioning `mapbox`, access token, or 401 errors
- [ ] No browser console errors about missing glyphs or sprites
