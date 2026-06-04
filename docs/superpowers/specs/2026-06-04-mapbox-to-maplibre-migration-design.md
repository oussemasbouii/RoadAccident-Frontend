# Mapbox → MapLibre Migration Design

**Date:** 2026-06-04  
**Status:** Approved  

## Goal

Replace Mapbox GL JS and the Mapbox geocoding API with self-hosted equivalents:
- **MapLibre GL JS** as the rendering library (drop-in replacement)
- **Martin** (`https://martin.micladevops.com`) for vector tiles
- **Photon** (`https://photon.micladevops.com`) for forward and reverse geocoding
- **VersaTiles neutrino** style JSON as the map style template

No Mapbox account or access token will be needed after this migration.

---

## Scope

**In scope:**
- Replace `mapbox-gl` npm package with `maplibre-gl`
- Remove `@mapbox/mapbox-gl-geocoder` and its types package
- Replace all geocoding API calls (Mapbox → Photon)
- Replace map style URL with the versatiles-neutrino style (filled from env vars)
- Update all 5 map components and the map utility files
- Update environment variable names and `.env.example`

**Out of scope:**
- Valhalla routing (not used in the app today)
- Any changes to Redux slices, API service, or non-map code

---

## Services & Configuration

### Environment Variables (all require `VITE_` prefix for Vite)

| Variable | Value | Purpose |
|---|---|---|
| `VITE_MAP_STYLE_ASSET_PATH` | `map/neutrino/style.json` | Path to style template in `public/` |
| `VITE_MARTIN_BASE_URL` | `https://martin.micladevops.com` | Vector tile server |
| `VITE_MARTIN_TILESET_ID` | `basemap` | Tileset served by Martin |
| `VITE_PHOTON_BASE_URL` | `https://photon.micladevops.com` | Geocoding server |
| `VITE_VALHALLA_BASE_URL` | `https://valhalla.micladevops.com` | Routing server (reserved, unused) |
| `VITE_MAP_GLYPHS_URL` | `https://tiles.versatiles.org/assets/glyphs/{fontstack}/{range}.pbf` | Font glyphs for map labels |
| `VITE_MAP_SPRITE_BASICS_URL` | `https://tiles.versatiles.org/assets/sprites/basics/sprites` | Icon sprites |

### Map Style Template

The versatiles-neutrino style JSON is placed at `public/map/neutrino/style.json`. It contains three placeholders filled at runtime:

| Placeholder | Resolved value |
|---|---|
| `__MARTIN_SOURCE_URL__` | `${VITE_MARTIN_BASE_URL}/${VITE_MARTIN_TILESET_ID}` |
| `__GLYPHS_URL__` | `VITE_MAP_GLYPHS_URL` |
| `__SPRITE_BASICS_URL__` | `VITE_MAP_SPRITE_BASICS_URL` |

---

## Architecture

### Files Deleted
- `src/utils/mapboxToken.ts` — token management no longer needed
- `src/types/mapbox.d.ts` — MapLibre ships its own TypeScript types

### Files Renamed / Replaced

**`src/utils/mapbox.ts` → `src/utils/mapService.ts`**

Replaces the Mapbox-specific service class. Key changes:
- Import from `maplibre-gl` instead of `mapbox-gl`
- `MapboxService` → `MapService`, `mapboxService` → `mapService`
- `initMap()` awaits `getMapStyle()` instead of using a `mapbox://` style URL
- `geocodeAddress()` calls Photon forward geocoding
- `reverseGeocode()` calls Photon reverse geocoding

**`src/utils/mapStyle.ts` (new file)**

Responsible for building the resolved MapLibre style object:
1. Fetches `/map/neutrino/style.json` (static asset from `public/`)
2. Replaces the three placeholders via string replacement on the raw JSON
3. Parses the result with `JSON.parse()`
4. Caches the resolved style object in module scope so subsequent calls are synchronous

Exports:
- `getMapStyle(): Promise<maplibregl.StyleSpecification>` — first call fetches, subsequent calls return cache
- `getMapStyleSync(): maplibregl.StyleSpecification | null` — returns cached value or null if not yet loaded

### Geocoding API — Photon

**Forward geocoding** (address → coordinates):
```
GET https://photon.micladevops.com/api?q=<query>&limit=1
```
Returns a GeoJSON FeatureCollection. Extract `features[0].geometry.coordinates` as `[lng, lat]` and `features[0].properties.name` (plus `city`, `country`) to build a display string.

**Reverse geocoding** (coordinates → address):
```
GET https://photon.micladevops.com/reverse?lat=<lat>&lon=<lon>&limit=1
```
Same response shape. Build display string from `properties.name`, `properties.street`, `properties.city`.

Note: Photon does not return a structured admin hierarchy the way Mapbox does (region/district/place/neighborhood). The `adminContext` parsing in `AccidentLocationMap` will use Photon's `properties.state`, `properties.county`, `properties.city` as best-effort equivalents.

### 5 Map Components — Mechanical Changes

All components share the same set of changes:

1. `import mapboxgl from 'mapbox-gl'` → `import maplibregl from 'maplibre-gl'`
2. `import 'mapbox-gl/dist/mapbox-gl.css'` → `import 'maplibre-gl/dist/maplibre-gl.css'`
3. Remove `getMapboxToken()` / `getMapboxTokenError()` imports and usage
4. Map initialization: add `const style = await getMapStyle()` before `new maplibregl.Map({ style, ... })`
5. All `mapboxgl.*` references → `maplibregl.*`
6. CSS class names in MUI `sx` props: `mapboxgl-` → `maplibregl-`

**Component-specific notes:**

- `AccidentLocationMap.tsx` — replace `getAddress()` and `handleSearch()` to use Photon API
- `IncidentsMap.tsx` — replace the geocoding loop to use Photon forward geocoding
- `OfficerTrackingMap.tsx` — no geocoding calls; only the import/style/CSS changes apply
- `AlertsMap.tsx` — no geocoding calls; only the import/style/CSS changes apply
- `IncidentHeatmapPanel.tsx` — no geocoding calls; only the import/style/CSS changes apply

---

## Package Changes

```json
// Remove from dependencies:
"mapbox-gl": "^3.19.0",
"@mapbox/mapbox-gl-geocoder": "^5.1.2"

// Remove from devDependencies:
"@types/mapbox__mapbox-gl-geocoder": "^5.1.1"

// Add to dependencies:
"maplibre-gl": "^4.x"
```

---

## Error Handling

- If the style fetch fails, map components show the existing error UI (the `setError()` path already present in each component)
- If Photon returns no results, geocoding falls back to `null` (same behavior as current Mapbox fallback)
- If Photon is unreachable, a `console.error` is logged and `null` is returned (no user-visible crash)

---

## Testing

- The existing map component tests mock the map library at the module level; update mocks from `mapbox-gl` to `maplibre-gl`
- Manual smoke test: verify all 5 map views render tiles, markers display correctly, address search works in `AccidentLocationMap`, and the officer tracking layer updates in real time
