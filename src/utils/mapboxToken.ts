
function normalizeToken(value: string | undefined | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function getMapboxToken(): string {
  const envToken = normalizeToken(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN)
  const storageToken = normalizeToken(
    localStorage.getItem('VITE_MAPBOX_ACCESS_TOKEN') ||
    localStorage.getItem('mapboxAccessToken')
  )
  const token = envToken || storageToken

  if (token && !storageToken) {
    localStorage.setItem('mapboxAccessToken', token)
  }

  return token
}

export function getMapboxTokenError(token: string): string | null {
  if (!token) return 'Missing VITE_MAPBOX_ACCESS_TOKEN'
  if (!token.startsWith('pk.')) {
    if (token.startsWith('sk.')) {
      return 'Invalid Mapbox token: use a public token (pk.*), not a secret token (sk.*).'
    }
    return 'Invalid Mapbox token format: expected a public token starting with pk.'
  }
  return null
}
