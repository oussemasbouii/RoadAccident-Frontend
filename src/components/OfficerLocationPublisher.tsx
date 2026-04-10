import { useEffect, useRef } from 'react'
import { useAppSelector } from '@/store/store'
import { getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'

const LOCATION_EVENT = 'request:location:update'

const MIN_EMIT_INTERVAL_MS = 2000
const MIN_DISTANCE_METERS = 5
const MAX_ACCURACY_METERS = 150
const MAX_LOCATION_AGE_MS = 30000

export default function OfficerLocationPublisher() {
  const token = useAppSelector((state) => state.auth.token)
  const user = useAppSelector((state) => state.auth.user)

  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!token) return
    // Publish for all authenticated users

    const refreshToken = getRefreshToken()
    if (!refreshToken) return

    const socket = connectSharedSocket(refreshToken)
    if (!socket) return

    const onConnect = () => console.log('[OfficerLocation] socket connected')
    const onConnectError = (err: Error) => console.log('[OfficerLocation] socket error', err?.message)

    if (import.meta.env.DEV) {
      socket.on('connect', onConnect)
      socket.on('connect_error', onConnectError)
    }

    const canUseGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator
    if (!canUseGeo) {
      if (import.meta.env.DEV) console.log('[OfficerLocation] geolocation not available')
      return
    }

    const handlePosition = (position: GeolocationPosition) => {
      const now = Date.now()
      const { latitude, longitude, accuracy } = position.coords
      const age = now - position.timestamp
      if (age > MAX_LOCATION_AGE_MS) return
      if (!Number.isFinite(accuracy) || accuracy > MAX_ACCURACY_METERS) return

      const last = lastSentRef.current
      if (last && now - last.at < MIN_EMIT_INTERVAL_MS) return
      if (last) {
        const distance = haversineMeters(last.lat, last.lng, latitude, longitude)
        if (distance < MIN_DISTANCE_METERS) return
      }

      const payload = { lat: latitude, lng: longitude, ts: now, accuracy }
      socket.emit(LOCATION_EVENT, payload)
      if (import.meta.env.DEV) console.log('[OfficerLocation] emit', payload)
      lastSentRef.current = { lat: latitude, lng: longitude, at: now }
    }

    const handleError = (err: GeolocationPositionError) => {
      if (import.meta.env.DEV) console.log('[OfficerLocation] geolocation error', err?.message)
    }

    const requestOnce = () => {
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      })
    }

    requestOnce()
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    })

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (import.meta.env.DEV) {
        socket.off('connect', onConnect)
        socket.off('connect_error', onConnectError)
      }
    }
  }, [token, user?.role])

  return null
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
