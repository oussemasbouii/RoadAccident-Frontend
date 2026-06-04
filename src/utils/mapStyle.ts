import maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import styleTemplateRaw from '../assets/map/neutrino/style.json?raw'

// Enable Arabic/Hebrew/RTL label rendering — guard prevents duplicate calls on hot-reload
if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
  maplibregl.setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
    null,
    true,
  )
}

let cachedStyle: StyleSpecification | null = null

export function getMapStyle(): StyleSpecification {
  if (cachedStyle) return cachedStyle

  const base = import.meta.env.VITE_MARTIN_BASE_URL as string | undefined
  const id = import.meta.env.VITE_MARTIN_TILESET_ID as string | undefined
  if (!base || !id) throw new Error('VITE_MARTIN_BASE_URL and VITE_MARTIN_TILESET_ID must be set')
  const martinUrl = `${base.replace(/\/$/, '')}/${id}`
  const glyphsUrl = import.meta.env.VITE_MAP_GLYPHS_URL ?? 'https://tiles.versatiles.org/assets/glyphs/{fontstack}/{range}.pbf'
  const spriteUrl = import.meta.env.VITE_MAP_SPRITE_BASICS_URL ?? 'https://tiles.versatiles.org/assets/sprites/basics/sprites'

  const filled = styleTemplateRaw
    .replaceAll('__MARTIN_SOURCE_URL__', martinUrl)
    .replaceAll('__GLYPHS_URL__', glyphsUrl)
    .replaceAll('__SPRITE_BASICS_URL__', spriteUrl)

  cachedStyle = JSON.parse(filled) as StyleSpecification
  return cachedStyle
}
