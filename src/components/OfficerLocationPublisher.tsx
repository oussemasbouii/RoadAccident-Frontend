import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppSelector } from '@/store/store'
import { getAccessToken, getDeviceId, getRefreshToken } from '@/utils/tokenStore'

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || 'https://micladevops.com'
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/api/v2/socket.io'
const LOCATION_EVENT = 'request:location:update'

const LOCATION_INTERVAL_MS = 5000
const MIN_EMIT_INTERVAL_MS = 3000
const MIN_DISTANCE_METERS = 20
const MAX_ACCURACY_METERS = 50
const MAX_LOCATION_AGE_MS = 30000

export default function OfficerLocationPublisher() {
  const token = useAppSelector((state) => state.auth.token)
  const user = useAppSelector((state) => state.auth.user)

  const socketRef = useRef<Socket | null>(null)
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!token) return
    // Publish for all authenticated users

    const refreshToken = getRefreshToken()
    const effectiveToken = refreshToken || getAccessToken() || token

    const socket = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      auth: {
        token: effectiveToken,
        accessToken: getAccessToken(),
        refreshToken,
        deviceId: getDeviceId(),
      },
    })
    socketRef.current = socket
    if (import.meta.env.DEV) {
      socket.on('connect', () => console.log('[OfficerLocation] socket connected'))
      socket.on('connect_error', (err) => console.log('[OfficerLocation] socket error', err?.message))
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

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: false,
      maximumAge: 10000,
      timeout: 10000,
    })

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      socket.disconnect()
      socketRef.current = null
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
