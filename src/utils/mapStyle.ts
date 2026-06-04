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
