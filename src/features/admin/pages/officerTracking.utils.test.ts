import { describe, expect, it } from 'vitest'
import {
  applyLocationUpdate,
  buildStateFromSnapshot,
  normalizeTrackingPayload,
} from './officerTracking.utils'

describe('officerTracking.utils', () => {
  it('normalizes payload using userId as canonical id and server timestamp', () => {
    const result = normalizeTrackingPayload({
      userId: 'officer-1',
      lat: 36.8065,
      lng: 10.1815,
      ts: 1710590000000,
      accuracy: 9.4,
      officerName: 'John Doe',
    })

    expect(result).toBeTruthy()
    expect(result?.id).toBe('officer-1')
    expect(result?.userId).toBe('officer-1')
    expect(result?.name).toBe('John Doe')
    expect(result?.serverTs).toBe(1710590000000)
    expect(result?.lastSeen).toBe(1710590000000)
  })

  it('builds snapshot state by replacing full tracked set', () => {
    const snapshot = buildStateFromSnapshot([
      { userId: 'one', lat: 1, lng: 1, ts: 1000 },
      { userId: 'two', lat: 2, lng: 2, ts: 2000 },
    ])

    expect(Object.keys(snapshot.officerMap)).toEqual(['one', 'two'])
    expect(snapshot.tsMap.get('one')).toBe(1000)
    expect(snapshot.tsMap.get('two')).toBe(2000)
  })

  it('ignores out-of-order updates and applies newer updates', () => {
    const snapshot = buildStateFromSnapshot([
      { userId: 'one', lat: 1, lng: 1, ts: 2000, officerName: 'Officer One' },
    ])

    const older = applyLocationUpdate(snapshot.officerMap, snapshot.tsMap, {
      userId: 'one',
      lat: 5,
      lng: 5,
      ts: 1500,
    })
    expect(older.applied).toBe(false)
    expect(older.officerMap.one.latitude).toBe(1)

    const newer = applyLocationUpdate(snapshot.officerMap, snapshot.tsMap, {
      userId: 'one',
      lat: 9,
      lng: 9,
      ts: 3000,
    })
    expect(newer.applied).toBe(true)
    expect(newer.officerMap.one.latitude).toBe(9)
    expect(newer.officerMap.one.name).toBe('Officer One')
    expect(snapshot.tsMap.get('one')).toBe(3000)
  })

  it('rejects payloads without stable identity', () => {
    const normalized = normalizeTrackingPayload({ lat: 36.8, lng: 10.1, ts: 1710590000000 })
    expect(normalized).toBeNull()
  })
})
