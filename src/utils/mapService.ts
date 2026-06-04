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
    return [p.name, p.city, p.state, p.country].filter(Boolean).join(', ') || null
  } catch {
    return null
  }
}
