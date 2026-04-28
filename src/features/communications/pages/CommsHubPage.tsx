import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Box,
  Chip,
  Divider,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material'

import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import CallRoundedIcon from '@mui/icons-material/CallRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import NotificationsOffRoundedIcon from '@mui/icons-material/NotificationsOffRounded'
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded'

import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import { Card, Button } from '@/components/Common'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'
import { clearMute, markRead, setActivePeer, setMute, toggleReaction } from '@/features/chat/slices/chatSlice'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { startOutgoingCall } from '@/features/calls/slices/callSlice'
import type { ChatContact, ChatMessage } from '@/types/chat'
import type { CallSession } from '@/types/call'
import AttachmentLightbox from '@/components/AttachmentLightbox'
import { useChatComposer } from '@/features/communications/hooks/useChatComposer'

const QUICK_REPLIES = ['On my way', 'Need backup', 'ETA 5 min', 'Scene secured', 'Call me']
const REACTION_OPTIONS = ['✅', '⚠️', '👀', '👍', '❗', '❓', '🙏']

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

function formatMessageTime(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

function getDateKey(timestamp: number) {
  const date = new Date(timestamp)
  return date.toDateString()
}

function formatDateHeader(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    return 'Today'
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }
}

function formatMuteTimeRemaining(until: number): string {
  const remaining = until - Date.now()
  if (remaining <= 0) return ''

  const minutes = Math.floor(remaining / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

function formatDuration(startedAt?: number, endedAt?: number) {
  if (!startedAt || !endedAt) return ''
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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
  const muteByPeer = useAppSelector((state) => state.chat.muteByPeer)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [openReactionFor, setOpenReactionFor] = useState<string | null>(null)
  const [reactionAnchor, setReactionAnchor] = useState<null | HTMLElement>(null)
  const reactionCloseTimer = useRef<number | null>(null)
  const callHistory = useAppSelector((state) => state.call.callHistory)
  const activeCall = useAppSelector((state) => state.call.activeCall)
  const [showCallHistory, setShowCallHistory] = useState(false)
  const [muteAnchorEl, setMuteAnchorEl] = useState<null | HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showNewPill, setShowNewPill] = useState(false)
  const [newCount, setNewCount] = useState(0)

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
      .filter((contact: ChatContact | undefined): contact is ChatContact => Boolean(contact))
    if (!query.trim()) return contactsState
    const needle = query.toLowerCase()
    return contactsState.filter((c: ChatContact) =>
      [c.name, c.officerId, c.role].some((value) => value.toLowerCase().includes(needle))
    )
  }, [chatState.contactIds, chatState.contacts, query])

  const selectedContact = contacts.find((c: ChatContact) => c.id === selectedId) || null
  const selectedMessages = chatState.messagesByPeer[selectedContact?.id || ''] || []
  const selectedCallHistory = useMemo(() => {
    if (!selectedContact) return []
    return callHistory.filter((call: CallSession) =>
      call.peer.id === selectedContact.id || call.peer.officerId === selectedContact.officerId
    )
  }, [callHistory, selectedContact])
  const sortedCallHistory = useMemo(() => {
    return [...selectedCallHistory].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
  }, [selectedCallHistory])
  const selectedCallStats = useMemo(() => {
    const total = sortedCallHistory.length
    const completed = sortedCallHistory.filter((call) => call.status === 'ended').length
    const missed = total - completed
    return {
      total,
      completed,
      missed,
      lastCall: sortedCallHistory[0] || null,
    }
  }, [sortedCallHistory])
  const mutedUntil = selectedContact ? (muteByPeer[selectedContact.id] || 0) : 0
  const isMuted = mutedUntil > Date.now()
  const muteTimeRemaining = isMuted ? formatMuteTimeRemaining(mutedUntil) : ''

  
  const combinedItems = useMemo(() => {
    if (!selectedContact) return []
    const messages = selectedMessages.map((msg: ChatMessage) => ({
      type: 'message' as const,
      data: msg,
      timestamp: Date.parse(msg.timestamp) || 0,
    }))
    const calls = selectedCallHistory.map((call: CallSession) => ({
      type: 'call' as const,
      data: call,
      timestamp: call.startedAt || 0,
    }))
    return [...messages, ...calls].sort((a, b) => a.timestamp - b.timestamp)
  }, [selectedMessages, selectedCallHistory, selectedContact])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom) {
      setShowNewPill(false)
      setNewCount(0)
    }
  }, [])

  const handleNewPillClick = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setShowNewPill(false)
    setNewCount(0)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom) {
      el.scrollTop = el.scrollHeight
      setShowNewPill(false)
      setNewCount(0)
    } else {
      setNewCount((prev) => prev + 1)
      setShowNewPill(true)
    }
  }, [combinedItems.length])
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
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {/* Organized call controls */}
                  <Tooltip title="Audio call">
                    <IconButton
                      size="small"
                      onClick={() => {
                        const roomId = crypto.randomUUID()
                        dispatch(startOutgoingCall({
                          peer: {
                            id: selectedContact!.id,
                            name: selectedContact!.name,
                            officerId: selectedContact!.officerId,
                            role: selectedContact!.role,
                          },
                          callType: 'audio',
                          roomId,
                        }))
                      }}
                      disabled={Boolean(activeCall)}
                      sx={{
                        borderRadius: '50%',
                        border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: theme.palette.primary.main,
                        width: 36,
                        height: 36,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.25),
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        },
                        '&.Mui-disabled': {
                          opacity: 0.4,
                          cursor: 'not-allowed',
                          boxShadow: 'none',
                        },
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <CallRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Video call">
                    <IconButton
                      size="small"
                      onClick={() => {
                        const roomId = crypto.randomUUID()
                        dispatch(startOutgoingCall({
                          peer: {
                            id: selectedContact!.id,
                            name: selectedContact!.name,
                            officerId: selectedContact!.officerId,
                            role: selectedContact!.role,
                          },
                          callType: 'video',
                          roomId,
                        }))
                      }}
                      disabled={Boolean(activeCall)}
                      sx={{
                        borderRadius: '50%',
                        border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: theme.palette.primary.main,
                        width: 36,
                        height: 36,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.25),
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        },
                        '&.Mui-disabled': {
                          opacity: 0.4,
                          cursor: 'not-allowed',
                          boxShadow: 'none',
                        },
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <VideocamRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  {/* Mute control */}
                  <Tooltip title={isMuted ? `Muted (${muteTimeRemaining} remaining)` : 'Mute notifications'}>
                    <IconButton
                      size="small"
                      onClick={(event) => setMuteAnchorEl(event.currentTarget)}
                      sx={{
                        borderRadius: '50%',
                        border: `2px solid ${isMuted ? alpha(theme.palette.warning.main, 0.5) : alpha(theme.palette.divider, 0.5)}`,
                        bgcolor: isMuted ? alpha(theme.palette.warning.main, 0.15) : alpha(theme.palette.background.paper, 0.9),
                        color: isMuted ? theme.palette.warning.main : theme.palette.text.secondary,
                        width: 36,
                        height: 36,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        '&:hover': {
                          bgcolor: alpha(isMuted ? theme.palette.warning.main : theme.palette.text.secondary, 0.25),
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        },
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {isMuted ? <NotificationsOffRoundedIcon fontSize="small" /> : <NotificationsActiveRoundedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  
                  {/* History */}
                  <Tooltip title="Call History">
                    <IconButton
                      size="small"
                      onClick={() => setShowCallHistory(true)}
                      sx={{
                        borderRadius: '50%',
                        border: `2px solid ${alpha(theme.palette.divider, 0.4)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.8),
                        color: theme.palette.text.secondary,
                        width: 36,
                        height: 36,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.15),
                          color: theme.palette.primary.main,
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        },
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <HistoryRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  {/* Compact Mute Chip */}
                  {isMuted && (
                    <Tooltip title={`Muted until ${new Date(mutedUntil).toLocaleTimeString()}`}>
                      <Chip 
                        size="small" 
                        label={muteTimeRemaining || "Muted"} 
                        color="warning" 
                        variant="outlined"
                        sx={{ 
                          height: 24, 
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 12,
                          minWidth: 48,
                        }} 
                      />
                    </Tooltip>
                  )}
                </Stack>

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

          <Stack ref={scrollRef} onScroll={handleScroll} spacing={2} sx={{ flex: 1, overflowY: 'auto', pr: 0.5, maxHeight: 400 }}>
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
            {selectedContact && combinedItems.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No messages or calls yet. Start the conversation.
              </Typography>
            )}
            {selectedContact && combinedItems.reduce((acc: React.ReactElement[], item, index) => {
              const currentDateKey = getDateKey(item.timestamp)
              const prevItem = combinedItems[index - 1]
              const prevDateKey = prevItem ? getDateKey(prevItem.timestamp) : null
              if (currentDateKey !== prevDateKey) {
                acc.push(
                  <Box key={`date-${currentDateKey}`} sx={{ textAlign: 'center', my: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {formatDateHeader(item.timestamp)}
                    </Typography>
                  </Box>
                )
              }
              if (item.type === 'message') {
                const message = item.data as ChatMessage
                const isMe = message.senderId === currentUserId
                const reactions = message.reactions || {}
                const reactionEntries = Object.entries(reactions)
                  .map(([emoji, users]) => ({ emoji, count: users.length }))
                  .filter((entry) => entry.count > 0)
                const statusIcon =
                  message.status === 'seen'
                    ? <DoneAllRoundedIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                    : message.status === 'sent'
                      ? <DoneRoundedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
                      : message.status === 'failed'
                        ? <ErrorOutlineRoundedIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />
                        : null
                acc.push(
                  <Box
                    key={message.id}
                    sx={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}
                    onMouseEnter={(event) => {
                      if (reactionCloseTimer.current) window.clearTimeout(reactionCloseTimer.current)
                      setHoveredMessageId(message.id)
                    }}
                    onMouseLeave={() => {
                      if (reactionCloseTimer.current) window.clearTimeout(reactionCloseTimer.current)
                      reactionCloseTimer.current = window.setTimeout(() => {
                        setHoveredMessageId(null)
                      }, 300)
                    }}
                  >
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
                        position: 'relative',
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
                              onClick={() => {
                                if (!message.attachment) return
                                setLightbox({
                                  url: attachmentUrls[message.attachment.id],
                                  filename: message.attachment.filename,
                                })
                              }}
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
                      {reactionEntries.length > 0 && (
                        <Stack direction="row" spacing={0.6} sx={{ mt: 0.35, flexWrap: 'wrap', alignItems: 'center' }}>
                          {reactionEntries.map((entry) => (
                            <Box
                              key={entry.emoji}
                              sx={{
                                px: 0.6,
                                py: 0.1,
                                borderRadius: 999,
                                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                                bgcolor: alpha(theme.palette.background.paper, 0.9),
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.4,
                              }}
                            >
                              <span>{entry.emoji}</span>
                              <span>{entry.count}</span>
                            </Box>
                          ))}
                        </Stack>
                      )}
                      {hoveredMessageId === message.id && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -10,
                            right: isMe ? 'auto' : '100%',
                            left: isMe ? '100%' : 'auto',
                            transform: isMe ? 'translateX(10px)' : 'translateX(-10px)',
                            zIndex: 10,
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              setOpenReactionFor(message.id)
                              setReactionAnchor(event.currentTarget)
                            }}
                            sx={{
                              bgcolor: alpha(theme.palette.background.paper, 0.9),
                              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                            }}
                          >
                            <ForumRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatMessageTime(message.timestamp)}
                      </Typography>
                      {isMe && statusIcon}
                    </Stack>
                  </Box>
                )
              } else if (item.type === 'call') {
                const call = item.data as CallSession
                acc.push(
                  <Box
                    key={`${call.callId}-${call.startedAt}`}
                    sx={{ alignSelf: 'center', maxWidth: '75%' }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        bgcolor: alpha(theme.palette.background.paper, 0.8),
                        border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                        textAlign: 'center',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 2,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        >
                          {call.callType === 'video' ? <VideocamRoundedIcon fontSize="small" /> : <CallRoundedIcon fontSize="small" />}
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {call.callType === 'video' ? 'Video call' : 'Audio call'} {call.direction === 'incoming' ? 'from' : 'to'} {selectedContact?.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {call.startedAt ? new Date(call.startedAt).toLocaleString() : 'Unknown time'}
                            {call.endedAt ? ` · ${formatDuration(call.startedAt, call.endedAt)}` : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                )
              }
              return acc
            }, [])}
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

          {showNewPill && selectedContact && (
            <Box
              onClick={handleNewPillClick}
              sx={{
                alignSelf: 'center',
                mb: 1,
                px: 2,
                py: 0.8,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.4)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                  transform: 'scale(1.02)',
                },
              }}
            >
              {newCount > 1 ? `${newCount} new messages` : 'New message'}
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

      
      <Menu
        anchorEl={muteAnchorEl}
        open={Boolean(muteAnchorEl)}
        onClose={() => setMuteAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disablePortal
        PaperProps={{ sx: { zIndex: 2601 } }}
      >
        <MenuItem
          onClick={() => {
            if (selectedContact) {
              dispatch(setMute({ peerId: selectedContact.id, until: Date.now() + 15 * 60 * 1000 }))
            }
            setMuteAnchorEl(null)
          }}
        >
          Mute 15 min
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedContact) {
              dispatch(setMute({ peerId: selectedContact.id, until: Date.now() + 60 * 60 * 1000 }))
            }
            setMuteAnchorEl(null)
          }}
        >
          Mute 1 hour
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedContact) {
              dispatch(setMute({ peerId: selectedContact.id, until: Date.now() + 8 * 60 * 60 * 1000 }))
            }
            setMuteAnchorEl(null)
          }}
        >
          Mute 8 hours
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedContact) {
              dispatch(clearMute({ peerId: selectedContact.id }))
            }
            setMuteAnchorEl(null)
          }}
        >
          Unmute
        </MenuItem>
      </Menu>
      <AttachmentLightbox lightbox={lightbox} onClose={() => setLightbox(null)} onDownload={handleDownloadImage} />

      <Popover
        open={Boolean(openReactionFor)}
        anchorEl={reactionAnchor}
        onClose={() => {
          setOpenReactionFor(null)
          setReactionAnchor(null)
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        disablePortal
        PaperProps={{
          onMouseEnter: () => {
            if (reactionCloseTimer.current) window.clearTimeout(reactionCloseTimer.current)
          },
          onMouseLeave: () => {
            if (reactionCloseTimer.current) window.clearTimeout(reactionCloseTimer.current)
            reactionCloseTimer.current = window.setTimeout(() => {
              setOpenReactionFor(null)
              setReactionAnchor(null)
            }, 450)
          },
          sx: {
            borderRadius: 999,
            px: 0.6,
            py: 0.4,
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            zIndex: 2601,
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.6 }}>
          {REACTION_OPTIONS.map((emoji) => (
            <Box
              key={emoji}
              onClick={() => {
                if (!openReactionFor || !selectedContact || !currentUserId) return
                dispatch(toggleReaction({ peerId: selectedContact.id, messageId: openReactionFor, emoji, userId: currentUserId }))
              }}
              sx={{
                width: 28,
                height: 28,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                fontSize: 16,
                border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
              }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
      </Popover>

      <Dialog open={showCallHistory} onClose={() => setShowCallHistory(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Call History
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedCallHistory.length} {selectedCallHistory.length === 1 ? 'call' : 'calls'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {selectedCallHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No call history for this officer yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {sortedCallHistory.map((call: CallSession) => (
                  <Box
                    key={`${call.callId}-${call.startedAt}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.background.paper, 0.92),
                      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 2,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        >
                          {call.callType === 'video' ? <VideocamRoundedIcon fontSize="small" /> : <CallRoundedIcon fontSize="small" />}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {call.callType === 'video' ? 'Video call' : 'Audio call'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {call.startedAt ? new Date(call.startedAt).toLocaleString() : 'Unknown time'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {call.endedAt ? (
                          <Typography variant="caption" color="text.secondary">
                            {formatDuration(call.startedAt, call.endedAt)}
                          </Typography>
                        ) : null}
                        <Chip
                          size="small"
                          label={call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                          color={call.status === 'ended' ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  )
}


