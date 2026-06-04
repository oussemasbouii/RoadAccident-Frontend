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

  it('returns null when Photon returns a non-2xx status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response)

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
