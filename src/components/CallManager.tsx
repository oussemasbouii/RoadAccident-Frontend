import { useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { connectSharedSocket } from '@/services/socketClient'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { apiService } from '@/services/api'
import {
  clearCall,
  setCallSession,
  setCallStatus,
} from '@/features/calls/slices/callSlice'
import CallOverlay from '@/components/CallOverlay'
import type { CallType } from '@/types/call'

function decodeJwtSub(token?: string | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[1]))
    return payload?.sub ? String(payload.sub) : null
  } catch {
    return null
  }
}

export default function CallManager() {
  const dispatch = useAppDispatch()
  const call = useAppSelector((state) => state.call.activeCall)
  const me = useAppSelector((state) => state.auth.user)

  const currentUserId = useMemo(() => {
    return (
      me?.id ||
      decodeJwtSub(getRefreshToken()) ||
      decodeJwtSub(getAccessToken()) ||
      null
    )
  }, [me?.id])

  useEffect(() => {
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    socket.on('action:call:accepted', (payload: any) => {
      if (import.meta.env.DEV) console.log('[Call] accepted', payload)
      dispatch(setCallSession({
        callId: payload?.callId,
        roomId: payload?.roomId,
        token: payload?.token,
      }))
      dispatch(setCallStatus({ status: 'in_call' }))
    })

    socket.on('action:call:rejected', (payload: any) => {
      if (import.meta.env.DEV) console.log('[Call] rejected', payload)
      dispatch(setCallStatus({ status: 'ended' }))
      setTimeout(() => dispatch(clearCall()), 1200)
    })

    socket.on('action:call:ended', (payload: any) => {
      if (import.meta.env.DEV) console.log('[Call] ended', payload)
      dispatch(setCallStatus({ status: 'ended' }))
      setTimeout(() => dispatch(clearCall()), 1200)
    })

    return () => {
      socket.off('action:call:accepted')
      socket.off('action:call:rejected')
      socket.off('action:call:ended')
    }
  }, [dispatch])

  const handleAccept = () => {
    if (!call) return
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    socket.emit('request:call:accept', {
      callId: call.callId,
      roomId: call.roomId,
    })
    dispatch(setCallStatus({ status: 'in_call' }))
  }

  const handleReject = () => {
    if (!call) return
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    socket.emit('request:call:reject', {
      callId: call.callId,
      roomId: call.roomId,
    })
    dispatch(setCallStatus({ status: 'ended' }))
    setTimeout(() => dispatch(clearCall()), 800)
  }

  const handleEnd = () => {
    if (!call) return
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    socket.emit('request:call:end', {
      callId: call.callId,
      roomId: call.roomId,
    })
    dispatch(setCallStatus({ status: 'ended' }))
    setTimeout(() => dispatch(clearCall()), 800)
  }

  useEffect(() => {
    if (!call || !currentUserId) return
    if (!call.roomId || call.callId || call.status !== 'outgoing') return

    const payload = {
      calleeId: call.peer.id,
      roomId: call.roomId,
      callType: call.callType as CallType,
    }

    apiService.calls
      .initiate(payload)
      .then((resp) => {
        const data = resp.data?.data || resp.data || {}
        if (data?.token) {
          dispatch(setCallSession({ token: data.token, callId: data.callId, roomId: data.roomId }))
        }
      })
      .catch((error) => {
        dispatch(setCallStatus({ status: 'failed', error: error?.message || 'Call failed' }))
        setTimeout(() => dispatch(clearCall()), 1500)
      })
  }, [call, currentUserId, dispatch])

  return <CallOverlay onAccept={handleAccept} onReject={handleReject} onEnd={handleEnd} />
}
