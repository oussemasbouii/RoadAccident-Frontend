import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, AudioTrack, VideoTrack } from 'livekit-client'
import type { CallType } from '@/types/call'

function resolveLiveKitUrl(rawUrl?: string) {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed.replace(/\/+$/, '')
  if (trimmed.startsWith('http://')) return trimmed.replace(/^http:\/\//, 'ws://').replace(/\/+$/, '')
  if (trimmed.startsWith('https://')) return trimmed.replace(/^https:\/\//, 'wss://').replace(/\/+$/, '')
  return `wss://${trimmed.replace(/\/+$/, '')}`
}

export function useLiveKitMedia(
  roomId: string | undefined,
  token: string | undefined,
  enabled: boolean,
  callType: CallType | undefined
) {
  const roomRef = useRef<Room | null>(null)
  const remoteAudioElsRef = useRef<HTMLAudioElement[]>([])
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null)
  const localVideoElRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoTrackRef = useRef<VideoTrack | null>(null)
  const localCameraTrackRef = useRef<VideoTrack | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraEnabled, setIsCameraEnabled] = useState(false)
  const [remoteAudioPlaying, setRemoteAudioPlaying] = useState(false)
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detachRemoteAudio = useCallback(() => {
    remoteAudioElsRef.current.forEach((el) => {
      try {
        el.pause()
        el.srcObject = null
        el.remove()
      } catch (e) {
        console.warn('[CallFlow] detach remote audio error:', e)
      }
    })
    remoteAudioElsRef.current = []
    setRemoteAudioPlaying(false)
  }, [])

  const detachRemoteVideo = useCallback(() => {
    const track = remoteVideoTrackRef.current
    const element = remoteVideoElRef.current
    try {
      if (track) {
        if (element) track.detach(element)
        else track.detach()
      }
    } catch (e) {
      console.warn('[CallFlow] detach remote video error:', e)
    }
    if (element) {
      try {
        element.pause()
        element.srcObject = null
      } catch (e) {
        console.warn('[CallFlow] clear remote video element error:', e)
      }
    }
    remoteVideoTrackRef.current = null
    setRemoteVideoPlaying(false)
  }, [])

  const detachLocalVideo = useCallback(() => {
    const track = localCameraTrackRef.current
    const element = localVideoElRef.current
    try {
      if (track) {
        if (element) track.detach(element)
        else track.detach()
      }
    } catch (e) {
      console.warn('[CallFlow] detach local video error:', e)
    }
    if (element) {
      try {
        element.pause()
        element.srcObject = null
      } catch (e) {
        console.warn('[CallFlow] clear local video element error:', e)
      }
    }
    localCameraTrackRef.current = null
    setIsCameraEnabled(false)
  }, [])

  const disconnect = useCallback(async () => {
    const room = roomRef.current
    if (room) {
      try {
        await room.disconnect()
      } catch (e) {
        console.warn('[CallFlow] disconnect error:', e)
      }
      roomRef.current = null
    }
    detachRemoteAudio()
    detachRemoteVideo()
    detachLocalVideo()
    setIsConnected(false)
    setError(null)
  }, [detachLocalVideo, detachRemoteAudio, detachRemoteVideo])

  const toggleMute = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      if (isMuted) {
        await room.localParticipant.setMicrophoneEnabled(true)
        setIsMuted(false)
      } else {
        await room.localParticipant.setMicrophoneEnabled(false)
        setIsMuted(true)
      }
    } catch (e) {
      console.warn('[CallFlow] toggleMute error:', e)
    }
  }, [isMuted])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      if (isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(false)
        detachLocalVideo()
        return
      }
      const publication = await room.localParticipant.setCameraEnabled(true)
      localCameraTrackRef.current = publication?.videoTrack ?? null
      setIsCameraEnabled(Boolean(publication?.videoTrack))
      console.log('[CallFlow] local camera enabled', {
        hasTrack: Boolean(publication?.videoTrack),
        callType,
        roomId,
      })
      if (publication?.videoTrack && localVideoElRef.current) {
        publication.videoTrack.attach(localVideoElRef.current)
        localVideoElRef.current.autoplay = true
        localVideoElRef.current.playsInline = true
        localVideoElRef.current.muted = true
      }
    } catch (e) {
      console.warn('[CallFlow] toggleCamera error:', e)
    }
  }, [detachLocalVideo, isCameraEnabled])

  const setRemoteVideoElement = useCallback((node: HTMLVideoElement | null) => {
    remoteVideoElRef.current = node
    if (node && remoteVideoTrackRef.current) {
      try {
        remoteVideoTrackRef.current.attach(node)
        node.autoplay = true
        node.playsInline = true
        node.muted = false
      } catch (e) {
        console.warn('[CallFlow] attach remote video element error:', e)
      }
    }
  }, [])

  const setLocalVideoElement = useCallback((node: HTMLVideoElement | null) => {
    localVideoElRef.current = node
    if (node && localCameraTrackRef.current) {
      try {
        localCameraTrackRef.current.attach(node)
        node.autoplay = true
        node.playsInline = true
        node.muted = true
      } catch (e) {
        console.warn('[CallFlow] attach local video element error:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || !roomId || !token) {
      disconnect()
      return
    }

    const wsUrl = resolveLiveKitUrl(import.meta.env.VITE_LIVEKIT_URL)
    if (!wsUrl) {
      setError('Missing VITE_LIVEKIT_URL for LiveKit media')
      disconnect()
      return
    }

    let cancelled = false

    const connect = async () => {
      try {
        const room = new Room({ adaptiveStream: true, dynacast: true })
        roomRef.current = room

        room.on(RoomEvent.Connected, () => {
          if (!cancelled) setIsConnected(true)
        })
        room.on(RoomEvent.Disconnected, () => {
          if (cancelled) return
          setIsConnected(false)
          detachRemoteAudio()
          detachRemoteVideo()
          detachLocalVideo()
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
                console.warn('[CallFlow] remote audio play failed', playErr)
              })
            }
            setRemoteAudioPlaying(true)
            return
          }

          if (track.kind === 'video') {
            const videoTrack = track as VideoTrack
            remoteVideoTrackRef.current = videoTrack
            console.log('[CallFlow] remote video subscribed', {
              roomId,
              kind: videoTrack.kind,
            })
            if (remoteVideoElRef.current) {
              try {
                videoTrack.attach(remoteVideoElRef.current)
                remoteVideoElRef.current.autoplay = true
                remoteVideoElRef.current.playsInline = true
                remoteVideoElRef.current.muted = false
              } catch (e) {
                console.warn('[CallFlow] attach remote video failed', e)
              }
            }
            setRemoteVideoPlaying(true)
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
                console.warn('[CallFlow] remove detached audio element error:', e)
              }
            })
            remoteAudioElsRef.current = remoteAudioElsRef.current.filter((el) => document.body.contains(el))
            setRemoteAudioPlaying(remoteAudioElsRef.current.length > 0)
            return
          }
          if (track.kind === 'video') {
            const videoTrack = track as VideoTrack
            try {
              if (remoteVideoElRef.current) videoTrack.detach(remoteVideoElRef.current)
              else videoTrack.detach()
            } catch (e) {
              console.warn('[CallFlow] detach remote video failed', e)
            }
            if (remoteVideoElRef.current) {
              try {
                remoteVideoElRef.current.pause()
                remoteVideoElRef.current.srcObject = null
              } catch (e) {
                console.warn('[CallFlow] clear remote video element error:', e)
              }
            }
            remoteVideoTrackRef.current = null
            setRemoteVideoPlaying(false)
          }
        })

        await room.connect(wsUrl, token)
        if (cancelled) return

        await room.localParticipant.setMicrophoneEnabled(true)
        setIsMuted(false)

        if (callType === 'video') {
          const publication = await room.localParticipant.setCameraEnabled(true)
          localCameraTrackRef.current = publication?.videoTrack ?? null
          setIsCameraEnabled(Boolean(publication?.videoTrack))
          console.log('[CallFlow] initial camera state', {
            hasTrack: Boolean(publication?.videoTrack),
            roomId,
            callType,
          })
          if (publication?.videoTrack && localVideoElRef.current) {
            publication.videoTrack.attach(localVideoElRef.current)
            localVideoElRef.current.autoplay = true
            localVideoElRef.current.playsInline = true
            localVideoElRef.current.muted = true
          }
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
  }, [callType, disconnect, detachLocalVideo, detachRemoteAudio, detachRemoteVideo, enabled, roomId, token])

  return {
    isConnected,
    isMuted,
    isCameraEnabled,
    toggleMute,
    toggleCamera,
    remoteAudioPlaying,
    remoteVideoPlaying,
    error,
    disconnect,
    setRemoteVideoElement,
    setLocalVideoElement,
  }
}
