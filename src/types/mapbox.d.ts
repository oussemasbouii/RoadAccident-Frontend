// Extend mapbox-gl module to include accessToken property
declare global {
  namespace mapboxgl {
    let accessToken: string | null | undefined
  }
}

export {}
