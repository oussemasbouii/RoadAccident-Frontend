import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Box,
  Chip,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import CallRoundedIcon from '@mui/icons-material/CallRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { Card, Button } from '@/components/Common'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'
import { markRead, setActivePeer } from '@/features/chat/slices/chatSlice'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { startOutgoingCall } from '@/features/calls/slices/callSlice'
import type { ChatContact, ChatMessage } from '@/types/chat'
import AttachmentLightbox from '@/components/AttachmentLightbox'
import { useChatComposer } from '@/features/communications/hooks/useChatComposer'

const QUICK_REPLIES = ['On my way', 'Need backup', 'ETA 5 min', 'Scene secured', 'Call me']

function formatRelativeTime(value?: string) {
  if (!value) return 'Unknown'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  const diffMs = Date.now() - parsed
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

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

export default function CommsHubPage() {
  const theme = useTheme()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const me = useAppSelector((state) => state.auth.user)
  const chatState = useAppSelector((state) => state.chat)
  const activePeerId = useAppSelector((state) => state.chat.activePeerId)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const typingByPeer = useAppSelector((state) => state.chat.typingByPeer)
  const currentUserId = useMemo(() => {
    return (
      me?.id ||
      decodeJwtSub(getRefreshToken()) ||
      decodeJwtSub(getAccessToken()) ||
      null
    )
  }, [me?.id])
  const isChatRoute = location.pathname.includes('/communications')

  const contacts = useMemo<ChatContact[]>(() => {
    const contactsState = chatState.contactIds
      .map((id: string) => chatState.contacts[id] as ChatContact | undefined)
      .filter((contact): contact is ChatContact => Boolean(contact))
    if (!query.trim()) return contactsState
    const needle = query.toLowerCase()
    return contactsState.filter((c: ChatContact) =>
      [c.name, c.officerId, c.role].some((value) => value.toLowerCase().includes(needle))
    )
  }, [chatState.contactIds, chatState.contacts, query])

  const selectedContact = contacts.find((c: ChatContact) => c.id === selectedId) || null
  const selectedMessages = chatState.messagesByPeer[selectedContact?.id || ''] || []
  const totalUnread = useMemo(
    () => chatState.contactIds.reduce((sum: number, id: string) => sum + (chatState.unreadByPeer[id] || 0), 0),
    [chatState.contactIds, chatState.unreadByPeer]
  )

  const {
    draft,
    setDraft,
    pendingAttachment,
    setPendingAttachment,
    attachmentUrls,
    lightbox,
    setLightbox,
    fileInputRef,
    handleFilePick,
    handleFileChange,
    handleSend,
    emitTyping,
    handleDownloadImage,
  } = useChatComposer({
    peer: selectedContact,
    currentUserId,
    messages: selectedMessages,
  })

  useEffect(() => {
    if (!currentUserId) return
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) {
      if (import.meta.env.DEV) console.warn('[Chat] Missing auth token for socket')
      return
    }
    const socket = connectSharedSocket(authToken)
    if (!socket) {
      if (import.meta.env.DEV) console.warn('[Chat] Socket not available for listeners')
      return
    }
    if (import.meta.env.DEV) {
      socket.on('connect', () => console.log('[Chat] socket connected', { id: socket.id, currentUserId }))
      socket.on('connect_error', (err) => console.warn('[Chat] socket connect_error', err?.message))
      socket.on('disconnect', (reason) => console.warn('[Chat] socket disconnected', reason))
    }

    const onAnyHandler = (event: string, ...args: any[]) => {
      if (!event.startsWith('action:')) return
      if (import.meta.env.DEV) {
        console.log('[Chat] socket event', event, args[0])
      }
    }
    socket.onAny(onAnyHandler)

    return () => {
      socket.offAny(onAnyHandler)
    }
  }, [currentUserId])

  useEffect(() => {
    if (!activePeerId) return
    if (!contacts.some((c: ChatContact) => c.id === activePeerId)) return
    setSelectedId(activePeerId)
  }, [activePeerId, contacts])

  useEffect(() => {
    if (!isChatRoute) return
    if (!selectedId || !currentUserId) return
    dispatch(markRead({ peerId: selectedId }))
    dispatch(setActivePeer({ peerId: selectedId }))
    const authToken = getRefreshToken() || getAccessToken()
    if (!authToken) return
    const socket = connectSharedSocket(authToken)
    if (!socket) return
    const peerMessages = chatState.messagesByPeer[selectedId] || []
    const lastIncoming = [...peerMessages].reverse().find((msg) => msg.senderId !== currentUserId)
    if (lastIncoming) {
      socket.emit(
        'request:message:seen',
        {
          messageId: lastIncoming.id,
          seen: { by: currentUserId, timestamp: new Date().toISOString() },
        },
        (ack: { acknowledged?: boolean; error?: string }) => {
          if (import.meta.env.DEV && !ack?.acknowledged) {
            console.warn('[Chat] seen ack failed', ack?.error || 'unknown error')
          }
        }
      )
    }
  }, [selectedId, currentUserId, chatState.messagesByPeer, dispatch, isChatRoute])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 2.4fr' }, gap: 2.5 }}>
        <Card
          sx={{
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minHeight: 540,
            bgcolor: alpha(theme.palette.background.paper, 0.9),
            border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
            boxShadow: '0 18px 50px rgba(0,0,0,0.06)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                }}
              >
                <ForumRoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Officer Directory
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {contacts.length} contacts
                </Typography>
              </Box>
            </Stack>
            {totalUnread > 0 && (
              <Chip size="small" label={`${totalUnread} new`} color="primary" />
            )}
          </Stack>

          <TextField
            size="small"
            placeholder="Search officers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Stack spacing={1} sx={{ overflowY: 'auto' }}>
            {contacts.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No users found.
              </Typography>
            )}
            {contacts.map((contact: ChatContact) => {
              const isActive = contact.id === selectedId
              const statusColor =
                contact.status === 'online' ? theme.palette.success.main : contact.status === 'busy'
                  ? theme.palette.warning.main
                  : theme.palette.text.disabled
              return (
                <Box
                  key={contact.id}
                  onClick={() => {
                    setSelectedId(contact.id)
                    dispatch(setActivePeer({ peerId: contact.id }))
                  }}
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    border: `1px solid ${isActive ? alpha(theme.palette.primary.main, 0.6) : alpha(theme.palette.divider, 0.5)}`,
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Badge variant="dot" overlap="circular" sx={{ '& .MuiBadge-badge': { bgcolor: statusColor } }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.2), color: 'primary.main' }}>
                        {contact.name[0]}
                      </Avatar>
                    </Badge>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {contact.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {contact.officerId} · {contact.role}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary">
                        {contact.status === 'online' ? 'Online' : contact.lastSeen}
                      </Typography>
                      {chatState.unreadByPeer[contact.id] ? (
                        <Chip size="small" label={chatState.unreadByPeer[contact.id]} color="primary" sx={{ mt: 0.5 }} />
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              )
            })}
          </Stack>
        </Card>

        <Card
          sx={{
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minHeight: 540,
            bgcolor: alpha(theme.palette.background.paper, 0.9),
            border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
            boxShadow: '0 18px 50px rgba(0,0,0,0.06)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {selectedContact ? (
              <>
                <Badge
                  variant="dot"
                  overlap="circular"
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: selectedContact.status === 'online'
                        ? theme.palette.success.main
                        : theme.palette.text.disabled,
                    },
                  }}
                >
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.2), color: 'primary.main' }}>
                    {selectedContact.name[0]}
                  </Avatar>
                </Badge>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{selectedContact.name}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mt: 0.2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {selectedContact.officerId}
                    </Typography>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: theme.palette.divider }} />
                    <Typography variant="caption" color="text.secondary">
                      {selectedContact.role}
                    </Typography>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: theme.palette.divider }} />
                    <Typography variant="caption" color="text.secondary">
                      {selectedContact.status === 'online'
                        ? 'Online'
                        : `Last seen ${formatRelativeTime(selectedContact.lastSeen)}`}
                    </Typography>
                  </Stack>
                </Box>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CallRoundedIcon fontSize="small" />}
                  onClick={() => {
                    const roomId = crypto.randomUUID()
                    dispatch(startOutgoingCall({
                      peer: {
                        id: selectedContact.id,
                        name: selectedContact.name,
                        officerId: selectedContact.officerId,
                        role: selectedContact.role,
                      },
                      callType: 'audio',
                      roomId,
                    }))
                  }}
                >
                  Call
                </Button>
              </>
            ) : (
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>Select a conversation</Typography>
                <Typography variant="caption" color="text.secondary">
                  Choose an officer to start chatting.
                </Typography>
              </Box>
            )}
          </Stack>

          <Divider />

          <Stack spacing={2} sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
            {!selectedContact && (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 240,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: theme.palette.text.secondary,
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No conversation selected</Typography>
                  <Typography variant="body2">
                    Pick an officer from the list to view messages.
                  </Typography>
                </Box>
              </Box>
            )}
            {selectedContact && selectedMessages.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No messages yet. Start the conversation.
              </Typography>
            )}
            {selectedContact && selectedMessages.map((message: ChatMessage) => {
              const isMe = message.senderId === currentUserId
              const statusIcon =
                message.status === 'seen'
                  ? <DoneAllRoundedIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                  : message.status === 'sent'
                    ? <DoneRoundedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
                    : message.status === 'failed'
                      ? <ErrorOutlineRoundedIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />
                      : null
              return (
                <Box key={message.id} sx={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: isMe ? theme.palette.primary.main : alpha(theme.palette.action.active, 0.06),
                      color: isMe ? theme.palette.primary.contrastText : 'text.primary',
                      boxShadow: isMe ? `0 8px 16px ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
                      border: message.type === 'alert' ? `1px solid ${alpha(theme.palette.warning.main, 0.6)}` : 'none',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {message.attachment ? (
                      <Stack spacing={0.8}>
                        {attachmentUrls[message.attachment.id] ? (
                          <Box
                            component="img"
                            src={attachmentUrls[message.attachment.id]}
                            alt={message.attachment.filename}
                            sx={{
                              width: 220,
                              maxWidth: '100%',
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                              '&:hover': {
                                transform: 'scale(1.01)',
                                boxShadow: `0 10px 22px ${alpha(theme.palette.common.black, 0.18)}`,
                              },
                            }}
                            onClick={() =>
                              setLightbox({
                                url: attachmentUrls[message.attachment.id],
                                filename: message.attachment.filename,
                              })
                            }
                          />
                        ) : (
                          <Box
                            sx={{
                              alignSelf: 'flex-start',
                              px: 1,
                              py: 0.6,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.primary.main, 0.12),
                              color: isMe ? theme.palette.primary.contrastText : theme.palette.primary.main,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Loading attachment...
                          </Box>
                        )}
                        {message.text && (
                          <Typography variant="body2">
                            {message.text}
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2">{message.text}</Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {message.timestamp}
                    </Typography>
                    {isMe && statusIcon}
                  </Stack>
                </Box>
              )
            })}
          </Stack>

          {selectedContact && typingByPeer[selectedContact.id] && (
            <Box
              sx={{
                alignSelf: 'flex-start',
                px: 1.1,
                py: 0.4,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.2,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: theme.palette.primary.main,
                }}
              />
              Typing…
            </Box>
          )}

          {selectedContact && (
            <>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {QUICK_REPLIES.map((reply) => (
                  <Chip key={reply} label={reply} onClick={() => setDraft(reply)} />
                ))}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="flex-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Button
                  variant="secondary"
                  icon={<AttachFileRoundedIcon fontSize="small" />}
                  onClick={handleFilePick}
                >
                  Attach
                </Button>
                <TextField
                  size="small"
                  placeholder="Type a message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  fullWidth
                  multiline
                  minRows={1}
                  maxRows={5}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    } else {
                      emitTyping()
                    }
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      alignItems: 'flex-start',
                    },
                  }}
                />
                <Button icon={<SendRoundedIcon fontSize="small" />} onClick={handleSend}>Send</Button>
              </Stack>
              {pendingAttachment && (
                <Chip
                  size="small"
                  label={`Ready to send: ${pendingAttachment.filename}`}
                  onDelete={() => setPendingAttachment(null)}
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
            </>
          )}
        </Card>
      </Box>

      
      <AttachmentLightbox lightbox={lightbox} onClose={() => setLightbox(null)} onDownload={handleDownloadImage} />
    </Box>
  )
}


