import { useEffect, useRef, useState, useCallback } from 'react'
import { Room, RoomEvent, AudioTrack } from 'livekit-client'

function resolveLiveKitUrl(rawUrl?: string) {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed.replace(/\/+$/, '')
  if (trimmed.startsWith('http://')) return trimmed.replace(/^http:\/\//, 'ws://').replace(/\/+$/, '')
  if (trimmed.startsWith('https://')) return trimmed.replace(/^https:\/\//, 'wss://').replace(/\/+$/, '')
  return `wss://${trimmed.replace(/\/+$/, '')}`
}

export function useLiveKitAudio(roomId: string | undefined, token: string | undefined, enabled: boolean) {
  const roomRef = useRef<Room | null>(null)
  const remoteAudioElsRef = useRef<HTMLAudioElement[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [remoteAudioPlaying, setRemoteAudioPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detachRemoteAudio = useCallback(() => {
    remoteAudioElsRef.current.forEach((el) => {
      try {
        el.pause()
        el.srcObject = null
        el.remove()
      } catch (e) {
        console.warn('[LiveKit] detach audio element error:', e)
      }
    })
    remoteAudioElsRef.current = []
    setRemoteAudioPlaying(false)
  }, [])

  const disconnect = useCallback(async () => {
    const room = roomRef.current
    if (room) {
      try {
        await room.disconnect()
      } catch (e) {
        console.warn('[LiveKit] disconnect error:', e)
      }
      roomRef.current = null
    }
    detachRemoteAudio()
    setIsConnected(false)
    setError(null)
  }, [detachRemoteAudio])

  const toggleMute = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      const localPub = room.localParticipant
      if (isMuted) {
        await localPub.setMicrophoneEnabled(true)
        setIsMuted(false)
      } else {
        await localPub.setMicrophoneEnabled(false)
        setIsMuted(true)
      }
    } catch (e) {
      console.warn('[LiveKit] toggleMute error:', e)
    }
  }, [isMuted])

  useEffect(() => {
    console.log('[CallFlow] LiveKit effect', {
      enabled,
      roomId,
      hasToken: Boolean(token),
    })

    if (!enabled || !roomId || !token) {
      if (enabled) {
        console.warn('[CallFlow] LiveKit skipped - missing enabled/roomId/token', {
          enabled,
          roomId,
          hasToken: Boolean(token),
        })
      }
      disconnect()
      return
    }

    const wsUrl = resolveLiveKitUrl(import.meta.env.VITE_LIVEKIT_URL)
    if (!wsUrl) {
      console.error('[CallFlow] LiveKit URL missing or invalid. Set VITE_LIVEKIT_URL.')
      setError('Missing VITE_LIVEKIT_URL for LiveKit audio')
      disconnect()
      return
    }

    let cancelled = false

    const connect = async () => {
      try {
        console.log('[CallFlow] LiveKit connecting', { roomId, wsUrl })
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        })
        roomRef.current = room

        room.on(RoomEvent.Connected, () => {
          if (cancelled) return
          setIsConnected(true)
          console.log('[CallFlow] LiveKit connected', { roomId, wsUrl })
        })

        room.on(RoomEvent.Disconnected, () => {
          if (cancelled) return
          setIsConnected(false)
          detachRemoteAudio()
          console.log('[CallFlow] LiveKit disconnected', { roomId })
        })

        room.on(RoomEvent.TrackSubscribed, (track: any) => {
          if (cancelled) return
          if (track.kind === 'audio') {
            const audioTrack = track as AudioTrack
            const element = audioTrack.attach() as HTMLAudioElement | undefined
            if (element) {
              element.autoplay = true
              element.controls = false
              element.muted = false
              element.style.display = 'none'
              document.body.appendChild(element)
              remoteAudioElsRef.current.push(element)
              void element.play().catch((playErr) => {
                console.warn('[CallFlow] LiveKit remote audio play failed', playErr)
              })
            }
            setRemoteAudioPlaying(true)
            console.log('[CallFlow] LiveKit remote audio subscribed')
          }
        })

        room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
          if (track.kind === 'audio') {
            const audioTrack = track as AudioTrack
            const elements = audioTrack.detach() as Array<HTMLAudioElement | null | undefined>
            elements?.forEach((el) => {
              if (!el) return
              try {
                el.pause()
                el.srcObject = null
                el.remove()
              } catch (e) {
                console.warn('[LiveKit] remove detached audio element error:', e)
              }
            })
            remoteAudioElsRef.current = remoteAudioElsRef.current.filter((el) => document.body.contains(el))
            setRemoteAudioPlaying(remoteAudioElsRef.current.length > 0)
            console.log('[CallFlow] LiveKit remote audio unsubscribed')
          }
        })

        await room.connect(wsUrl, token)
        console.log('[CallFlow] LiveKit room.connect resolved', { roomId, wsUrl })

        if (!cancelled) {
          console.log('[CallFlow] LiveKit requesting microphone enable')
          await room.localParticipant.setMicrophoneEnabled(true)
          setIsMuted(false)
          console.log('[CallFlow] LiveKit microphone enabled')
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[CallFlow] LiveKit connection error', err)
          setError(err?.message || 'Failed to connect to call')
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      disconnect()
    }
  }, [enabled, roomId, token, disconnect, detachRemoteAudio])

  return {
    isConnected,
    isMuted,
    toggleMute,
    remoteAudioPlaying,
    error,
    disconnect,
  }
}

