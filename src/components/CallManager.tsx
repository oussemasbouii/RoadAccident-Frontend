import { useEffect, useMemo, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { connectSharedSocket } from '@/services/socketClient'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { apiService } from '@/services/api'
import {
  clearCall,
  markCallMissed,
  setCallSession,
  setCallStatus,
} from '@/features/calls/slices/callSlice'
import CallOverlay from '@/components/CallOverlay'
import { useLiveKitAudio } from '@/hooks/useLiveKitAudio'
import { useCallRingtone } from '@/hooks/useCallRingtone'
import type { CallType } from '@/types/call'
import { decodeJwtSub, hasLiveKitUrl, requestMicrophonePermission } from '@/utils/callUtils'

export default function CallManager() {
  const dispatch = useAppDispatch()
  const call = useAppSelector((state) => state.call.activeCall)
  const me = useAppSelector((state) => state.auth.user)
  const initiatedCallRef = useRef<string | null>(null)
  const ringTimeoutRef = useRef<number | null>(null)
  const cleanupTimeoutRef = useRef<number | null>(null)
  const mediaFailureHandledRef = useRef(false)

  const currentUserId = useMemo(() => {
    return (
      me?.id ||
      decodeJwtSub(getRefreshToken()) ||
      decodeJwtSub(getAccessToken()) ||
      null
    )
  }, [me?.id])

  const isInCall = call?.status === 'in_call'
  useCallRingtone(call?.status === 'ringing')
  const { isConnected, isMuted, toggleMute, remoteAudioPlaying, error } = useLiveKitAudio(
    call?.roomId,
    call?.token,
    isInCall
  )

  useEffect(() => {
    if (!isInCall || !error) {
      mediaFailureHandledRef.current = false
      return
    }

    if (mediaFailureHandledRef.current) return
    mediaFailureHandledRef.current = true

    console.error('[CallFlow] LiveKit media failure detected', {
      callId: call?.callId,
      roomId: call?.roomId,
      error,
    })
    dispatch(setCallStatus({ status: 'failed', error: `Media server unavailable: ${error}` }))
    cleanupTimeoutRef.current = window.setTimeout(() => dispatch(clearCall()), 2500)
  }, [call?.callId, call?.roomId, dispatch, error, isInCall])

  const clearTimers = () => {
    if (ringTimeoutRef.current !== null) {
      window.clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
    if (cleanupTimeoutRef.current !== null) {
      window.clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
    }
  }

  const finalizeCall = (status: 'ended' | 'missed') => {
    clearTimers()
    if (status === 'missed') {
      dispatch(markCallMissed())
      return
    }
    dispatch(setCallStatus({ status: 'ended' }))
    cleanupTimeoutRef.current = window.setTimeout(() => dispatch(clearCall()), 800)
  }

  useEffect(() => {
    console.log('[CallFlow] CallManager render state', {
      callId: call?.callId,
      roomId: call?.roomId,
      status: call?.status,
      direction: call?.direction,
      hasToken: Boolean(call?.token),
      callType: call?.callType,
      isInCall,
    })
  }, [call?.callId, call?.roomId, call?.status, call?.direction, call?.token, call?.callType, isInCall])

  useEffect(() => {
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    const handleAccepted = (payload: any) => {
      console.log('[CallFlow] call accepted event received', payload)
      if (payload?.roomId && call?.roomId && payload.roomId !== call.roomId) return
      if (payload?.callId && call?.callId && payload.callId !== call.callId) return

      dispatch(setCallSession({
        callId: payload?.callId,
        roomId: payload?.roomId,
        token: payload?.token,
      }))
      dispatch(setCallStatus({ status: 'in_call' }))
      clearTimers()
    }

    const handleRejected = (payload: any) => {
      console.log('[CallFlow] call rejected event received', payload)
      if (payload?.callId && call?.callId && payload.callId !== call.callId) return
      finalizeCall('missed')
    }

    const handleEnded = (payload: any) => {
      console.log('[CallFlow] call ended event received', payload)
      if (payload?.callId && call?.callId && payload.callId !== call.callId) return
      if (call?.status === 'ringing' || call?.direction === 'incoming') {
        finalizeCall('missed')
        return
      }
      finalizeCall('ended')
    }

    socket.on('action:call:accepted', handleAccepted)
    socket.on('call_accepted', handleAccepted)
    socket.on('action:call:rejected', handleRejected)
    socket.on('call_rejected', handleRejected)
    socket.on('action:call:ended', handleEnded)
    socket.on('call_ended', handleEnded)
    socket.on('call:ended', handleEnded)
    socket.on('action:call:terminated', handleEnded)
    socket.on('call_terminated', handleEnded)
    socket.on('request:call:end', handleEnded)
    socket.on('request:call:terminate', handleEnded)

    return () => {
      socket.off('action:call:accepted', handleAccepted)
      socket.off('call_accepted', handleAccepted)
      socket.off('action:call:rejected', handleRejected)
      socket.off('call_rejected', handleRejected)
      socket.off('action:call:ended', handleEnded)
      socket.off('call_ended', handleEnded)
      socket.off('call:ended', handleEnded)
      socket.off('action:call:terminated', handleEnded)
      socket.off('call_terminated', handleEnded)
      socket.off('request:call:end', handleEnded)
      socket.off('request:call:terminate', handleEnded)
      clearTimers()
    }
  }, [call?.direction, call?.status, dispatch])

  const handleAccept = async () => {
    if (!call) return
    console.log('[CallFlow] Answer clicked', {
      callId: call.callId,
      roomId: call.roomId,
      status: call.status,
      hasToken: Boolean(call.token),
      callType: call.callType,
    })

    const micGranted = await requestMicrophonePermission('Answer flow')
    if (!micGranted) {
      dispatch(setCallStatus({ status: 'failed', error: 'Microphone permission is required to answer the call' }))
      setTimeout(() => dispatch(clearCall()), 1500)
      return
    }

    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return

    if (!hasLiveKitUrl()) {
      console.error('[CallFlow] Answer flow aborted - VITE_LIVEKIT_URL is missing')
      try {
        const socket = connectSharedSocket(authToken)
        socket?.emit('request:call:reject', {
          callId: call.callId,
          roomId: call.roomId,
        })
      } catch (error) {
        console.warn('[CallFlow] failed to emit reject after missing LiveKit URL', error)
      }
      dispatch(setCallStatus({ status: 'failed', error: 'LiveKit is not configured' }))
      setTimeout(() => dispatch(clearCall()), 1500)
      return
    }

    const socket = connectSharedSocket(authToken)
    if (!socket) return

    console.log('[CallFlow] emitting request:call:accept', {
      callId: call.callId,
      roomId: call.roomId,
    })

    socket.emit('request:call:accept', {
      callId: call.callId,
      roomId: call.roomId,
    }, (ack: any) => {
      console.log('[CallFlow] request:call:accept ack', { ack, callId: call.callId })
      if (ack?.error) {
        dispatch(setCallStatus({ status: 'failed', error: ack.error || 'Unable to accept call' }))
        return
      }
      dispatch(setCallStatus({ status: 'in_call' }))
    })
    dispatch(setCallStatus({ status: 'in_call' }))
  }

  const handleReject = () => {
    if (!call) return
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    console.log('[CallFlow] Reject clicked', {
      callId: call.callId,
      roomId: call.roomId,
      status: call.status,
    })
    console.log('[CallFlow] emitting request:call:reject', call.callId)

    socket.emit('request:call:reject', {
      callId: call.callId,
      roomId: call.roomId,
    }, (ack: any) => {
      console.log('[CallFlow] request:call:reject ack', { ack, callId: call.callId })
    })
    if (call.status === 'ringing' || call.direction === 'incoming') {
      finalizeCall('missed')
    } else {
      finalizeCall('ended')
    }
  }

  const handleEnd = () => {
    if (!call) return
    console.log('[CallFlow] End clicked', {
      callId: call.callId,
      roomId: call.roomId,
      status: call.status,
      direction: call.direction,
    })
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) {
      console.error('[CallFlow] End flow missing auth token, ending locally')
      finalizeCall('ended')
      return
    }
    const socket = connectSharedSocket(authToken)
    if (!socket) {
      console.error('[CallFlow] End flow missing socket, ending locally')
      finalizeCall('ended')
      return
    }

    console.log('[CallFlow] emitting request:call:end', { callId: call.callId, roomId: call.roomId })

    socket.emit('request:call:end', {
      callId: call.callId,
      roomId: call.roomId,
    }, (ack: any) => {
      console.log('[CallFlow] request:call:end ack', { ack, callId: call.callId })
    })
    finalizeCall('ended')
  }

  useEffect(() => {
    if (!call || !currentUserId) return
    if (!call.roomId || call.status !== 'outgoing') return

    // Guard on room + callee so a later setCallSession() update does not retrigger initiation.
    const callKey = `${call.roomId}:${call.peer.id}`
    if (initiatedCallRef.current === callKey) return
    initiatedCallRef.current = callKey

    console.log('[CallFlow] starting outgoing call API request', {
      callId: call.callId,
      roomId: call.roomId,
      calleeId: call.peer.id,
      callType: call.callType,
    })

    const payload = {
      calleeId: call.peer.id,
      roomId: call.roomId,
      callType: call.callType as CallType,
    }

    if (!hasLiveKitUrl()) {
      console.error('[CallFlow] Outgoing call aborted - VITE_LIVEKIT_URL is missing')
      dispatch(setCallStatus({ status: 'failed', error: 'LiveKit is not configured' }))
      setTimeout(() => dispatch(clearCall()), 1500)
      return
    }

    apiService.calls
      .initiate(payload)
      .then((resp) => {
        console.log('[CallFlow] API /calls/initiate response', resp.data)
        const data = resp.data?.data || resp.data || {}
        console.log('[CallFlow] extracted call data', data)
        if (data?.success === false || data?.error) {
          const errorMessage = data?.error || 'Call initiation failed'
          console.error('[CallFlow] call initiation failed', { errorMessage, data })
          dispatch(setCallStatus({ status: 'failed', error: errorMessage }))
          setTimeout(() => dispatch(clearCall()), 1500)
          return
        }

        if (!data?.token) {
          console.error('[CallFlow] backend did not return token', data)
          dispatch(setCallStatus({ status: 'failed', error: 'Missing call token from backend' }))
          setTimeout(() => dispatch(clearCall()), 1500)
          return
        }

        dispatch(setCallSession({ token: data.token, callId: data.callId, roomId: data.roomId }))
        console.log('[CallFlow] setCallSession dispatched for outgoing call')
      })
      .catch((error) => {
        initiatedCallRef.current = null
        console.error('[CallFlow] /calls/initiate ERROR', error.response?.data || error.message)
        dispatch(setCallStatus({ status: 'failed', error: error?.message || 'Call failed' }))
        setTimeout(() => dispatch(clearCall()), 1500)
      })
  }, [call, currentUserId, dispatch])

  useEffect(() => {
    if (!call) {
      initiatedCallRef.current = null
      clearTimers()
      return
    }
    if (call.status !== 'outgoing') {
      initiatedCallRef.current = null
    }

    if (call.status === 'ringing') {
      if (ringTimeoutRef.current !== null) {
        window.clearTimeout(ringTimeoutRef.current)
      }
      // Safety net: if the backend misses an end/hangup event, the receiver will not ring forever.
      ringTimeoutRef.current = window.setTimeout(() => {
        if (import.meta.env.DEV) console.warn('[Call] Ring timeout reached, marking as missed', call.callId)
        if (call.status === 'ringing') {
          finalizeCall('missed')
        }
      }, 45000)
    } else {
      if (ringTimeoutRef.current !== null) {
        window.clearTimeout(ringTimeoutRef.current)
        ringTimeoutRef.current = null
      }
    }
  }, [call])

  return (
    <CallOverlay
      onAccept={handleAccept}
      onReject={handleReject}
      onEnd={handleEnd}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      isConnected={isConnected}
      remoteAudioPlaying={remoteAudioPlaying}
      connectionError={error}
    />
  )
}
