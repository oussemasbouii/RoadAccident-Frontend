import type { OfficerLocation } from '@/types/officerTracking'

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeTrackingPayload(payload: any, receivedAt = Date.now()): OfficerLocation | null {
  const data = payload?.data || payload?.location || payload || {}
  const latitude = toFiniteNumber(data?.lat ?? data?.latitude)
  const longitude = toFiniteNumber(data?.lng ?? data?.longitude)

  if (latitude === null || longitude === null) return null

  const canonicalUserId = data?.userId
  const fallbackId = data?.officerId || data?.id || data?._id
  const stableId = canonicalUserId || fallbackId
  if (!stableId) return null
  const id = String(stableId)

  const parsedTs = toFiniteNumber(data?.ts)
  const serverTs = parsedTs ?? undefined
  const lastSeen = serverTs ?? receivedAt
  const updatedAt = new Date(lastSeen).toISOString()
  const officerName = typeof data?.officerName === 'string' ? data.officerName.trim() : undefined
  const name = officerName || data?.name
  const phoneNumber = data?.phoneNumber || data?.phone

  return {
    id,
    userId: canonicalUserId ? String(canonicalUserId) : undefined,
    officerId: data?.officerId,
    name,
    phoneNumber,
    role: data?.role,
    status: data?.status,
    latitude,
    longitude,
    updatedAt,
    lastSeen,
    serverTs,
    accuracy: toFiniteNumber(data?.accuracy) ?? undefined,
    source: data?.source,
  }
}

export function buildStateFromSnapshot(locations: any[], receivedAt = Date.now()) {
  const officerMap: Record<string, OfficerLocation> = {}
  const tsMap = new Map<string, number>()

  locations.forEach((location) => {
    const normalized = normalizeTrackingPayload(location, receivedAt)
    if (!normalized) return

    officerMap[normalized.id] = normalized
    if (typeof normalized.serverTs === 'number') {
      tsMap.set(normalized.id, normalized.serverTs)
    }
  })

  return { officerMap, tsMap }
}

export function applyLocationUpdate(
  prevOfficerMap: Record<string, OfficerLocation>,
  tsMap: Map<string, number>,
  payload: any,
  receivedAt = Date.now()
) {
  const normalized = normalizeTrackingPayload(payload, receivedAt)
  if (!normalized) {
    return { applied: false, officerMap: prevOfficerMap }
  }

  if (typeof normalized.serverTs === 'number') {
    const lastTs = tsMap.get(normalized.id) ?? -Infinity
    if (normalized.serverTs <= lastTs) {
      return { applied: false, officerMap: prevOfficerMap }
    }
    tsMap.set(normalized.id, normalized.serverTs)
  }

  const previous = prevOfficerMap[normalized.id]
  const merged: OfficerLocation = previous
    ? {
        ...previous,
        ...normalized,
        name: normalized.name || previous.name,
        officerId: normalized.officerId || previous.officerId,
        role: normalized.role || previous.role,
        status: normalized.status || previous.status,
      }
    : normalized

  return {
    applied: true,
    officerMap: {
      ...prevOfficerMap,
      [normalized.id]: merged,
    },
    updatedId: normalized.id,
  }
}
