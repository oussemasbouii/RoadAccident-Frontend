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
    vi.resetModules()
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

  it('throws when VITE_MARTIN_BASE_URL is not set', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_MARTIN_BASE_URL', '')
    vi.stubEnv('VITE_MARTIN_TILESET_ID', 'basemap')
    vi.stubEnv('VITE_MAP_GLYPHS_URL', 'https://g.example.com/{fontstack}/{range}.pbf')
    vi.stubEnv('VITE_MAP_SPRITE_BASICS_URL', 'https://s.example.com/basics')
    const { getMapStyle } = await import('./mapStyle')
    expect(() => getMapStyle()).toThrow('VITE_MARTIN_BASE_URL and VITE_MARTIN_TILESET_ID must be set')
  })
})
