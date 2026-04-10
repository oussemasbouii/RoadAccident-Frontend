import { useEffect, useMemo, useRef } from 'react'
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
import type { ChatContact, ChatMessage } from '@/types/chat'
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
  const presenceIdsRef = useRef<string[]>([])
  const heartbeatTimerRef = useRef<number | null>(null)
  const typingTimersRef = useRef<Record<string, number>>({})
  const isChatRoute = location.pathname.includes('/communications')

  const currentUserId = useMemo(() => {
    return (
      me?.id ||
      decodeJwtSub(getRefreshToken()) ||
      decodeJwtSub(getAccessToken()) ||
      null
    )
  }, [me?.id])

  useEffect(() => {
    if (isChatRoute) {
      dispatch(clearPopups())
    }
  }, [isChatRoute, dispatch])

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
      if (!event.startsWith('action:')) return
      if (import.meta.env.DEV) {
        console.log('[Chat] socket event', event, args[0])
      }
    }

    socket.onAny(onAnyHandler)
    socket.on('connect', handleConnect)

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

      const normalized: ChatMessage = {
        id: message.id,
        senderId,
        receivers,
        text: message.content,
        timestamp: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: message.messageType === 'media' ? 'info' : undefined,
        status: isFromMe ? 'sent' : undefined,
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

      dispatch(addMessage({
        peerId,
        message: normalized,
        incoming: !isFromMe,
        forcePopup: !isFromMe && !isChatRoute,
      }))

      if (isFromMe) {
        dispatch(updateMessageStatus({ messageId: message.id, status: 'sent' }))
      }

      if (!isFromMe) {
        socket.emit(
          'request:message:delivered',
          {
            messageId: message.id,
            delivered: { to: currentUserId, timestamp: new Date().toISOString() },
          },
          (ack: { acknowledged?: boolean; error?: string }) => {
            if (import.meta.env.DEV && !ack?.acknowledged) {
              console.warn('[Chat] delivered ack failed', ack?.error || 'unknown error')
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
      dispatch(updateMessageStatus({ messageId: payload.messageId, status: 'seen' }))
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

  if (activePopups.length === 0 || isChatRoute) {
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
        {activePopups.map((id) => {
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
      </Box>
    </Portal>
  )
}
