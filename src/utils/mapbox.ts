import mapboxgl from 'mapbox-gl'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import { getMapboxToken, getMapboxTokenError } from './mapboxToken'

const MAPBOX_TOKEN = getMapboxToken()
const MAPBOX_TOKEN_ERROR = getMapboxTokenError(MAPBOX_TOKEN)
if (!MAPBOX_TOKEN_ERROR) {
  mapboxgl.accessToken = MAPBOX_TOKEN
}

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

export class MapboxService {
  private map: mapboxgl.Map | null = null
  private markers: mapboxgl.Marker[] = []
  private geocoder: MapboxGeocoder | null = null

  /**
   * Initialize the Mapbox map
   */
  initMap(container: string | HTMLElement, options?: mapboxgl.MapboxOptions): mapboxgl.Map {
    if (MAPBOX_TOKEN_ERROR) {
      throw new Error(MAPBOX_TOKEN_ERROR)
    }

    this.map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [9.5615, 34.7678], // Tunisia coordinates
      zoom: 7,
      ...options
    })

    // Add navigation controls
    this.map.addControl(new mapboxgl.NavigationControl())
    
    // Add geocoder - use type assertion for mapboxgl
    this.geocoder = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN,
      mapboxgl: mapboxgl as any,
      placeholder: 'Search for a location...',
      countries: 'tn', // Tunisia
      types: 'address,poi,place'
    })

    this.map.addControl(this.geocoder, 'top-left')

    // Add fullscreen control
    this.map.addControl(new mapboxgl.FullscreenControl())

    return this.map
  }

  /**
   * Get the current map instance
   */
  getMap(): mapboxgl.Map | null {
    return this.map
  }

  /**
   * Add a marker to the map
   */
  addMarker(marker: MapMarker): mapboxgl.Marker {
    if (!this.map) {
      throw new Error('Map not initialized')
    }

    const el = document.createElement('div')
    el.className = 'marker'
    el.style.backgroundImage = this.getMarkerIcon(marker.type)
    el.style.width = '30px'
    el.style.height = '30px'
    el.style.backgroundSize = '100%'
    el.style.cursor = 'pointer'

    const mapMarker = new mapboxgl.Marker(el)
      .setLngLat([marker.longitude, marker.latitude])
      .addTo(this.map)

    // Add popup for incidents
    if (marker.type === 'incident' && marker.title) {
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="padding: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px;">${marker.title}</h4>
            <p style="margin: 0; font-size: 12px;">${marker.description || ''}</p>
          </div>
        `)
      mapMarker.setPopup(popup)
    }

    this.markers.push(mapMarker)
    return mapMarker
  }

  /**
   * Remove all markers from the map
   */
  clearMarkers(): void {
    this.markers.forEach(marker => marker.remove())
    this.markers = []
  }

  /**
   * Fit map to bounds containing all markers
   */
  fitBounds(): void {
    if (!this.map || this.markers.length === 0) return

    const bounds = new mapboxgl.LngLatBounds()
    this.markers.forEach(marker => {
      const lngLat = marker.getLngLat()
      bounds.extend(lngLat)
    })

    this.map.fitBounds(bounds, { padding: 50, maxZoom: 15 })
  }

  /**
   * Set map center and zoom
   */
  setView(center: [number, number], zoom: number): void {
    if (!this.map) return
    this.map.flyTo({
      center,
      zoom,
      essential: true
    })
  }

  /**
   * Get marker icon based on type
   */
  private getMarkerIcon(type: string): string {
    const icons: Record<string, string> = {
      incident: 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)',
      selected: 'url(https://docs.mapbox.com/mapbox-gl-js/assets/marker.png)',
      search: 'url(https://docs.mapbox.com/mapbox-gl-js/assets/marker.png)'
    }
    return icons[type] || icons.incident
  }

  /**
   * Add click event listener
   */
  onClick(callback: (lngLat: mapboxgl.LngLat) => void): void {
    if (!this.map) return
    
    this.map.on('click', (e) => {
      callback(e.lngLat)
    })
  }

  /**
   * Add move event listener
   */
  onMove(callback: (lngLat: mapboxgl.LngLat) => void): void {
    if (!this.map) return
    
    this.map.on('moveend', () => {
      const center = this.map!.getCenter()
      callback(center)
    })
  }

  /**
   * Get geocoder instance
   */
  getGeocoder(): MapboxGeocoder | null {
    return this.geocoder
  }

  /**
   * Destroy the map instance
   */
  destroy(): void {
    this.clearMarkers()
    if (this.map) {
      this.map.remove()
      this.map = null
    }
  }
}

// Export singleton instance
export const mapboxService = new MapboxService()

// Geocoding function using Mapbox API
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!MAPBOX_TOKEN) {
    console.error('Missing VITE_MAPBOX_ACCESS_TOKEN')
    return null
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=tn`
    )
    const data = await response.json()
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center
      return { lat, lng }
    }
    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

// Reverse geocoding function
export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  if (!MAPBOX_TOKEN) {
    console.error('Missing VITE_MAPBOX_ACCESS_TOKEN')
    return null
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
    )
    const data = await response.json()
    
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name
    }
    return null
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return null
  }
}
