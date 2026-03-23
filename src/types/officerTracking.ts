export interface OfficerLocation {
  id: string
  officerId?: string
  name?: string
  role?: string
  status?: string
  latitude: number
  longitude: number
  updatedAt?: string
  lastSeen?: number
  accuracy?: number
  source?: string
}
