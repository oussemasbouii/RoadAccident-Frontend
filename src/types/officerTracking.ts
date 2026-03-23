export interface OfficerLocation {
  id: string
  userId?: string
  officerId?: string
  name?: string
  role?: string
  status?: string
  latitude: number
  longitude: number
  updatedAt?: string
  lastSeen?: number
  serverTs?: number
  accuracy?: number
  source?: string
}
