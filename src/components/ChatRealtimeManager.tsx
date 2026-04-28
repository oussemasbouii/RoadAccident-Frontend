import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Box, Chip, Stack, Typography, alpha, useTheme, Portal } from '@mui/material'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'
import { apiService } from '@/services/api'
import {
  addMessage,
  clearTyping,
  clearPopups,
  dismissPopup,
  openThread,
  setActivePeer,
  setContacts,
  setTyping,
  updateContact,
  updateMessageStatus,
} from '@/features/chat/slices/chatSlice'
import { receiveIncomingCall, setCallSession, setCallStatus, clearCall, markCallMissed } from '@/features/calls/slices/callSlice'
import type { ChatContact, ChatMessage } from '@/types/chat'
import type { CallPeer } from '@/types/call'
import { Card, Button } from '@/components/Common'


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

function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

function shortIdentifier(value?: string | null) {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed.length <= 8 ? trimmed : trimmed.slice(-6)
}

function formatOfficerLabel(value?: string | null) {
  if (!value) return 'Officer'
  const trimmed = value.trim()
  if (!trimmed) return 'Officer'
  if (/^office?r?$/i.test(trimmed)) return 'Officer'
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

async function requestMicrophonePermission(contextLabel: string) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.warn(`[CallFlow] ${contextLabel} - mediaDevices.getUserMedia is unavailable`)
    return false
  }

  console.log(`[CallFlow] ${contextLabel} - requesting microphone permission`)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    stream.getTracks().forEach((track) => track.stop())
    console.log(`[CallFlow] ${contextLabel} - microphone permission granted`)
    return true
  } catch (error) {
    console.error(`[CallFlow] ${contextLabel} - microphone permission denied`, error)
    return false
  }
}

function hasLiveKitUrl() {
  return Boolean(import.meta.env.VITE_LIVEKIT_URL?.trim())
}

function resolveCallDisplayName(candidateName?: string | null, candidateId?: string | null) {
  const safeName = candidateName?.trim()
  if (safeName && !isUuidLike(safeName)) return safeName
  const safeId = candidateId?.trim()
  if (safeId && !isUuidLike(safeId)) return safeId
  if (safeId) return `Officer ${shortIdentifier(safeId)}`
  return 'Officer'
}

export default function ChatRealtimeManager() {
  const theme = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const me = useAppSelector((state) => state.auth.user)
  const contacts = useAppSelector((state) => state.chat.contacts)
  const contactIds = useAppSelector((state) => state.chat.contactIds)
  const activePopups = useAppSelector((state) => state.chat.activePopups)
  const messagesByPeer = useAppSelector((state) => state.chat.messagesByPeer)
  const openThreads = useAppSelector((state) => state.chat.openThreads)
  const muteByPeer = useAppSelector((state) => state.chat.muteByPeer)
  const presenceIdsRef = useRef<string[]>([])
  const heartbeatTimerRef = useRef<number | null>(null)
  const typingTimersRef = useRef<Record<string, number>>({})
  const handledIncomingCallRef = useRef<string | null>(null)
  const isChatRoute = location.pathname.includes('/communications')

  const currentUserId = useMemo(() => {
    return (
      me?.id ||
      decodeJwtSub(getRefreshToken()) ||
      decodeJwtSub(getAccessToken()) ||
      null
    )
  }, [me?.id])

  const call = useAppSelector((state) => state.call.activeCall)

  useEffect(() => {
    if (!call) {
      handledIncomingCallRef.current = null
    }
  }, [call])

  useEffect(() => {
    // Add global function for testing incoming calls
    if (import.meta.env.DEV) {
      (window as any).simulateIncomingCall = (callerId: string = 'test-user-123', callerName: string = 'Test Officer') => {
        console.log('[TEST] Simulating incoming call from', callerId, callerName)
        dispatch(
          receiveIncomingCall({
            peer: {
              id: callerId,
              name: callerName,
              officerId: callerId,
              role: 'officer',
            },
            callType: 'audio',
            callId: `call-${Date.now()}-${crypto.randomUUID()}`,
            roomId: `room-${Date.now()}-${crypto.randomUUID()}`,
          })
        )
      }
      ;(window as any).getCallState = () => {
        console.log('[TEST] Current call state:', call)
        return call
      }
      ;(window as any).simulateCallAccepted = () => {
        if (!call) {
          console.log('[TEST] No active call to accept')
          return
        }
        console.log('[TEST] Simulating call accepted')
        dispatch(setCallSession({
          callId: call.callId,
          roomId: call.roomId,
          token: 'test-token-123',
        }))
        dispatch(setCallStatus({ status: 'in_call' }))
      }
      ;(window as any).simulateCallEnded = () => {
        if (!call) {
          console.log('[TEST] No active call to end')
          return
        }
        console.log('[TEST] Simulating call ended')
        dispatch(setCallStatus({ status: 'ended' }))
        setTimeout(() => dispatch(clearCall()), 2000)
      }
    }
  }, [dispatch, call])

  useEffect(() => {
    if (!currentUserId) return
    apiService.users
      .list({ page: 1, limit: 100 })
      .then((resp) => {
        const payload = resp.data?.data || resp.data || {}
        const users = payload.users || payload
        if (!Array.isArray(users)) return

        const mapped: ChatContact[] = users
          .filter((user: any) => String(user.id) !== currentUserId)
          .map((user: any) => ({
            id: String(user.id),
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.officerId || 'Officer',
            officerId: user.officerId || user.id,
            role: user.role || 'officer',
            status: 'offline',
            lastSeen: 'Unknown',
          }))

        dispatch(setContacts({ contacts: mapped }))

        const userIds = mapped.map((user) => user.id)
        if (userIds.length) {
          apiService.chat
            .status(userIds)
            .then((statusResp) => {
              const statuses = statusResp.data?.data?.statuses || statusResp.data?.statuses || {}
              mapped.forEach((contact) => {
                const status = statuses?.[contact.id]
                if (!status) return
                dispatch(
                  updateContact({
                    id: contact.id,
                    changes: {
                      status: status.online ? 'online' : 'offline',
                      lastSeen: status.lastSeen
                        ? new Date(status.lastSeen).toLocaleString()
                        : contact.lastSeen,
                    },
                  })
                )
              })
            })
            .catch(() => undefined)
        }
      })
      .catch(() => undefined)
  }, [currentUserId, dispatch])

  useEffect(() => {
    if (!currentUserId) return
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    const handleConnect = () => {
      const ids = presenceIdsRef.current
      if (ids.length) {
        socket.emit('request:presence:subscribe', { userIds: ids })
      }
      socket.emit('request:heartbeat', {})
    }

    const onAnyHandler = (event: string, ...args: any[]) => {
      if (import.meta.env.DEV) {
        console.log('[Chat] socket event', event, args[0])
      }
    }

    socket.onAny(onAnyHandler)
    socket.on('connect', handleConnect)
    
    // Add diagnostic listener for all events
    if (import.meta.env.DEV) {
      ;(window as any).getSocketEvents = () => {
        console.log('[DIAGNOSTIC] Socket listeners:', Object.keys((socket as any)._events || {}))
        return (socket as any)._events
      }
      ;(window as any).testCallEvents = () => {
        console.log('[DIAGNOSTIC] Testing call event emission')
        socket.emit('action:call:incoming', {
          from: { id: 'test-caller', name: 'Test', officerId: 'TEST' },
          callId: `test-${Date.now()}`,
          roomId: `test-${Date.now()}`,
          callType: 'audio',
        })
        socket.emit('incoming_call', {
          callerId: 'test-caller',
          callerName: 'Test',
          callId: `test-${Date.now()}`,
          roomId: `test-${Date.now()}`,
          callType: 'audio',
          token: 'test-token',
        })
      }
    }

    socket.on('action:presence:update', (payload: { userId: string; status: 'online' | 'offline'; timestamp?: number }) => {
      dispatch(updateContact({
        id: payload.userId,
        changes: {
          status: payload.status,
          lastSeen: payload.timestamp
            ? new Date(payload.timestamp).toLocaleString()
            : payload.status === 'offline'
              ? new Date().toLocaleString()
              : undefined,
        },
      }))
    })

    socket.on('action:message:send', (payload: { message: any }) => {
      const message = payload?.message
      if (!message) return
      const senderId = String(message.senderId)
      const receivers = Array.isArray(message.receivers) ? message.receivers.map((r: any) => String(r)) : []
      const isFromMe = senderId === String(currentUserId || '')
      const peerId = isFromMe ? receivers[0] : senderId
      if (!peerId) return
      const mutedUntil = muteByPeer[peerId] || 0
      const isMuted = mutedUntil > Date.now()

      const normalized: ChatMessage = {
        id: message.id,
        senderId,
        receivers,
        text: message.content,
        timestamp: message.timestamp
          ? new Date(message.timestamp).toISOString()
          : new Date().toISOString(),
        type: message.messageType === 'media' ? 'info' : undefined,
        status: isFromMe ? 'sent' : 'delivered',
        attachment: message.attachment
          ? {
              id: message.attachment.id,
              type: message.attachment.type,
              filename: message.attachment.filename,
              mimeType: message.attachment.mimeType,
              size: message.attachment.size,
            }
          : undefined,
      }

      if (import.meta.env.DEV) {
        console.log('[Chat] message received', {
          id: message.id,
          from: senderId,
          to: peerId,
          isFromMe,
          status: normalized.status,
        })
      }

      dispatch(addMessage({
        peerId,
        message: normalized,
        incoming: !isFromMe,
        forcePopup: !isFromMe && !isChatRoute && openThreads.length === 0 && !isMuted,
      }))

      if (isFromMe) {
        dispatch(updateMessageStatus({ messageId: message.id, status: 'sent' }))
      }

      if (!isFromMe) {
        // Auto-acknowledge delivery immediately
        socket.emit(
          'request:message:delivered',
          {
            messageId: message.id,
            delivered: { to: currentUserId, timestamp: new Date().toISOString() },
          },
          (ack: { acknowledged?: boolean; error?: string }) => {
            if (import.meta.env.DEV) {
              if (ack?.acknowledged) {
                console.log('[Chat] delivered ack received', message.id)
              } else {
                console.warn('[Chat] delivered ack failed', ack?.error || 'unknown error', message.id)
              }
            }
          }
        )
      }
    })

    socket.on('action:typing', (payload: { senderId: string; timestamp: number }) => {
      const senderId = payload.senderId
      dispatch(setTyping({ peerId: senderId, timestamp: payload.timestamp }))
      if (typingTimersRef.current[senderId]) {
        window.clearTimeout(typingTimersRef.current[senderId])
      }
      typingTimersRef.current[senderId] = window.setTimeout(() => {
        dispatch(clearTyping({ peerId: senderId }))
      }, 2500)
    })

    socket.on('action:message:seen', (payload: { messageId: string; seen?: { by: string; timestamp: string } }) => {
      if (!payload?.messageId) return
      if (import.meta.env.DEV) {
        console.log('[Chat] message:seen received', {
          messageId: payload.messageId,
          by: payload.seen?.by,
          timestamp: payload.seen?.timestamp,
        })
      }
      dispatch(updateMessageStatus({ messageId: payload.messageId, status: 'seen' }))
    })

    const handleIncomingCallPayload = (payload: any) => {
      console.log('[CallFlow] incoming call payload received', payload)

      const incomingFrom = payload?.from || payload?.callerId ? {
        id: payload?.from?.id || payload?.callerId,
        name: payload?.from?.name || payload?.callerName || payload?.callerId,
        officerId: payload?.from?.officerId || payload?.callerId,
        role: payload?.from?.role || payload?.callerRole,
      } : null

      if (!incomingFrom) {
        console.error('[CallFlow] incoming call payload missing caller information', payload)
        return
      }

      const incomingPayload = {
        from: incomingFrom,
        callId: payload?.callId,
        roomId: payload?.roomId,
        callType: payload?.callType,
        token: payload?.token,
      }

      const dedupeKey = `${incomingPayload.callId || 'no-call-id'}:${incomingPayload.roomId || 'no-room-id'}`
      if (handledIncomingCallRef.current === dedupeKey) {
        if (import.meta.env.DEV) console.log('[Call] Duplicate incoming call ignored', dedupeKey)
        return
      }

      const callerId = String(incomingPayload.from?.id || incomingPayload.from)
      const isMuted = (muteByPeer[callerId] || 0) > Date.now()
      const callId = incomingPayload.callId || `call-${Date.now()}-${crypto.randomUUID()}`
      const roomId = incomingPayload.roomId || `room-${Date.now()}-${crypto.randomUUID()}`

      console.log('[CallFlow] processing incoming call', {
        callerId,
        callId,
        roomId,
        callType: incomingPayload.callType,
        isMuted,
        hasToken: Boolean(incomingPayload.token),
      })

      const caller: CallPeer = {
        id: callerId,
        name: resolveCallDisplayName(
          contacts[incomingPayload.from?.id || callerId]?.name ||
            incomingPayload.from?.name ||
            payload?.callerName,
          callerId
        ),
        officerId: contacts[incomingPayload.from?.id || callerId]?.officerId ||
          incomingPayload.from?.officerId ||
          callerId,
        role: formatOfficerLabel(
          contacts[incomingPayload.from?.id || callerId]?.role ||
            incomingPayload.from?.role ||
            'Officer'
        ),
      }

      dispatch(
        receiveIncomingCall({
          peer: caller,
          callType: incomingPayload.callType || 'audio',
          callId,
          roomId,
          token: incomingPayload.token,
        })
      )
      handledIncomingCallRef.current = dedupeKey

      console.log('[CallFlow] receiveIncomingCall dispatched', {
        peerId: caller.id,
        callId,
        roomId,
        callType: incomingPayload.callType || 'audio',
      })
    }

    socket.on('action:call:incoming', (payload: any) => {
      handleIncomingCallPayload(payload)
    })

    socket.on('incoming_call', (payload: any) => {
      console.log('[SOCKET] incoming_call payload:', payload)
      handleIncomingCallPayload({
        callerId: payload.callerId,
        callerName: payload.callerName,
        callId: payload.callId,
        roomId: payload.roomId,
        callType: payload.callType as 'audio' | 'video',
        token: payload.token,
      })
    })

    if (heartbeatTimerRef.current === null) {
      heartbeatTimerRef.current = window.setInterval(() => {
        socket.emit('request:heartbeat', {})
      }, 20000)
    }

    return () => {
      socket.offAny(onAnyHandler)
      socket.off('connect', handleConnect)
      socket.off('action:presence:update')
      socket.off('action:message:send')
      socket.off('action:typing')
      socket.off('action:message:seen')
      socket.off('action:call:incoming')
      socket.off('incoming_call')
      Object.values(typingTimersRef.current).forEach((timer) => window.clearTimeout(timer))
      typingTimersRef.current = {}
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }
  }, [currentUserId, dispatch, isChatRoute])

  useEffect(() => {
    if (!currentUserId) return
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return

    const nextIds = contactIds
    const prevIds = presenceIdsRef.current
    if (prevIds.length) {
      socket.emit('request:presence:unsubscribe', { userIds: prevIds })
    }
    if (nextIds.length) {
      socket.emit('request:presence:subscribe', { userIds: nextIds })
    }
    presenceIdsRef.current = nextIds

    return () => {
      const ids = presenceIdsRef.current
      if (ids.length) {
        socket.emit('request:presence:unsubscribe', { userIds: ids })
      }
      presenceIdsRef.current = []
    }
  }, [contactIds, currentUserId])

  const showCallNotification = call?.status === 'ringing' && !isChatRoute

  const handleCallAccept = useCallback(async () => {
    if (!call?.callId || !call?.roomId) {
      console.error('[CallFlow] Cannot accept - missing callId or roomId', call)
      return
    }
    console.log('[CallFlow] answer clicked', {
      callId: call.callId,
      roomId: call.roomId,
      status: call.status,
      callType: call.callType,
      hasToken: Boolean(call.token),
    })

    const micGranted = await requestMicrophonePermission('Incoming answer flow')
    if (!micGranted) {
      dispatch(setCallStatus({ status: 'failed', error: 'Microphone permission is required to answer the call' }))
      setTimeout(() => dispatch(clearCall()), 1500)
      return
    }

    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) {
      console.error('[CallFlow] No auth token available')
      dispatch(markCallMissed())
      return
    }
    const socket = connectSharedSocket(authToken)
    if (!socket) {
      console.error('[CallFlow] Socket not connected')
      dispatch(markCallMissed())
      return
    }

    if (!hasLiveKitUrl()) {
      console.error('[CallFlow] Incoming answer aborted - VITE_LIVEKIT_URL is missing')
      try {
        socket.emit('request:call:reject', {
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

    console.log('[CallFlow] emitting request:call:accept', { callId: call.callId, roomId: call.roomId })

    socket.emit('request:call:accept', {
      callId: call.callId,
      roomId: call.roomId,
    }, (ack: any) => {
      console.log('[CallFlow] request:call:accept ack', ack)
      if (ack?.error) return
      dispatch(setCallStatus({ status: 'in_call' }))
    })
    dispatch(setCallStatus({ status: 'in_call' }))
  }, [call, dispatch])

  const handleCallReject = useCallback(() => {
    if (!call?.callId || !call?.roomId) {
      console.error('[CallFlow] Cannot reject - missing callId or roomId', call)
      return
    }
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) {
      console.error('[CallFlow] No auth token available')
      dispatch(markCallMissed())
      return
    }
    const socket = connectSharedSocket(authToken)
    if (!socket) {
      console.error('[CallFlow] Socket not connected')
      dispatch(markCallMissed())
      return
    }

    console.log('[CallFlow] rejecting incoming call', { callId: call.callId, roomId: call.roomId })

    socket.emit('request:call:reject', {
      callId: call.callId,
      roomId: call.roomId,
    }, (ack: any) => {
      console.log('[CallFlow] request:call:reject ack', ack)
    })
    dispatch(markCallMissed())
  }, [call])

  if (activePopups.length === 0 && !showCallNotification) {
    return null
  }

  if (isChatRoute && openThreads.length > 0) {
    return null
  }

  return (
    <Portal>
      <Box
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          zIndex: 2000,
        }}
      >
        {activePopups.map((id: string) => {
          const contact = contacts[id]
          if (!contact) return null
          const lastMessage = (messagesByPeer[id] || []).slice(-1)[0]
          const statusTone = contact.status === 'online' ? theme.palette.success.main : theme.palette.text.disabled
          return (
            <Card
              key={contact.id}
              sx={{
                width: 290,
                p: 1.4,
                borderRadius: 2.5,
                boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
                bgcolor: alpha(theme.palette.background.paper, 0.98),
                border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  px: 1,
                  py: 0.8,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  animation: 'chatPulse 1.6s ease-in-out infinite',
                  '@keyframes chatPulse': {
                    '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.35)}` },
                    '70%': { boxShadow: `0 0 0 6px ${alpha(theme.palette.primary.main, 0)}` },
                    '100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}` },
                  },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2.2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: theme.palette.primary.main,
                    fontWeight: 700,
                  }}
                >
                  {contact.name[0]}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {contact.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {contact.officerId}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={contact.status === 'online' ? 'Online' : 'Offline'}
                  sx={{
                    bgcolor: alpha(statusTone, 0.12),
                    color: statusTone,
                    fontWeight: 600,
                  }}
                />
              </Stack>
              <Box
                sx={{
                  mt: 1,
                  p: 0.9,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.action.active, 0.06),
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {lastMessage?.text || 'No messages yet'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="sm"
                  onClick={() => {
                    dispatch(openThread({ peerId: contact.id }))
                    dispatch(setActivePeer({ peerId: contact.id }))
                  }}
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    dispatch(openThread({ peerId: contact.id }))
                    dispatch(setActivePeer({ peerId: contact.id }))
                    navigate('/communications')
                    dispatch(dismissPopup({ peerId: contact.id }))
                  }}
                >
                  Full Chat
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => dispatch(dismissPopup({ peerId: contact.id }))}
                >
                  Dismiss
                </Button>
              </Stack>
            </Card>
          )
        })}
        {showCallNotification && call && (
          <Card
            key={`call-${call.peer.id}`}
            sx={{
              width: 290,
              p: 1.4,
              borderRadius: 2.5,
              boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              border: `2px solid ${theme.palette.primary.main}`,
              animation: 'callRing 0.6s ease-in-out infinite',
              '@keyframes callRing': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.02)' },
                '100%': { transform: 'scale(1)' },
              },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2.2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {call.peer.name[0]}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {call.peer.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {call.callType === 'video' ? 'Video Call' : 'Audio Call'}
                </Typography>
              </Box>
            </Stack>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                textAlign: 'center',
                mb: 1.2,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                {call.status === 'ringing' ? `Incoming ${call.callType === 'video' ? 'Video' : 'Audio'} Call...` : 'Connecting...'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Box sx={{ flex: 1 }}>
                <Button
                  size="sm"
                  onClick={handleCallAccept}
                  style={{
                    width: '100%',
                    backgroundColor: theme.palette.success.main,
                    color: theme.palette.success.contrastText,
                  }}
                >
                  Answer
                </Button>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCallReject}
                  style={{ width: '100%' }}
                >
                  Reject
                </Button>
              </Box>
            </Stack>
          </Card>
        )}
      </Box>
    </Portal>
  )
}


