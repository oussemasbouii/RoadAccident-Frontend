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
import { apiService } from '@/services/api'
import { clearMute, markRead, mergeMessages, setActivePeer, setMute } from '@/features/chat/slices/chatSlice'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { startOutgoingCall } from '@/features/calls/slices/callSlice'
import type { ChatContact, ChatMessage } from '@/types/chat'
import type { CallSession } from '@/types/call'
import AttachmentLightbox from '@/components/AttachmentLightbox'
import { useChatComposer } from '@/features/communications/hooks/useChatComposer'
import { decodeJwtSub } from '@/utils/callUtils'
import { useTranslation } from '@/themeMode'

function formatRelativeTime(value?: string, locale = 'en', unknownLabel = 'Unknown') {
  if (!value) return unknownLabel
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  const diffMs = Date.now() - parsed
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diffMs < 60_000) return formatter.format(-Math.max(1, Math.round(diffMs / 1000)), 'second')
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return formatter.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  return formatter.format(-days, 'day')
}

function formatMessageTime(value?: string, locale = 'en') {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function getDateKey(timestamp: number) {
  const date = new Date(timestamp)
  return date.toDateString()
}

function formatDateHeader(timestamp: number, locale = 'en', todayLabel = 'Today', yesterdayLabel = 'Yesterday') {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) {
    return todayLabel
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return yesterdayLabel
  } else {
    return date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })
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
  const { t, locale } = useTranslation()
  const rowDirection = theme.direction === 'rtl' ? 'row-reverse' : 'row'
  const me = useAppSelector((state) => state.auth.user)
  const chatState = useAppSelector((state) => state.chat)
  const activePeerId = useAppSelector((state) => state.chat.activePeerId)
  const [query, setQuery] = useState('')
  const historyFetchedRef = useRef<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const typingByPeer = useAppSelector((state) => state.chat.typingByPeer)
  const muteByPeer = useAppSelector((state) => state.chat.muteByPeer)
  const callHistory = useAppSelector((state) => state.call.callHistory)
  const activeCall = useAppSelector((state) => state.call.activeCall)
  const [showCallHistory, setShowCallHistory] = useState(false)
  const [muteAnchorEl, setMuteAnchorEl] = useState<null | HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [showNewPill, setShowNewPill] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const quickReplies = useMemo(
    () => [
      t('comms.reply_on_my_way'),
      t('comms.reply_need_backup'),
      t('comms.reply_eta_5_min'),
      t('comms.reply_scene_secured'),
      t('comms.reply_call_me'),
    ],
    [t],
  )

  const currentUserId = useMemo(() => {
    return (
      me?.id ||
      decodeJwtSub(getRefreshToken()) ||
      decodeJwtSub(getAccessToken()) ||
      null
    )
  }, [me?.id])
  const isChatRoute = location.pathname.includes('/communications')

  const allContacts = useMemo<ChatContact[]>(() => {
    return chatState.contactIds
      .map((id: string) => chatState.contacts[id] as ChatContact | undefined)
      .filter((contact: ChatContact | undefined): contact is ChatContact => Boolean(contact))
  }, [chatState.contactIds, chatState.contacts])

  const contacts = useMemo<ChatContact[]>(() => {
    if (!query.trim()) return allContacts
    const needle = query.toLowerCase()
    return allContacts.filter((c: ChatContact) =>
      [c.name, c.officerId, c.role].some((value) => value.toLowerCase().includes(needle))
    )
  }, [allContacts, query])

  const selectedContact = allContacts.find((c: ChatContact) => c.id === selectedId) || null
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
    atBottomRef.current = atBottom
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

  // Jump to the latest message when switching conversations. Declared before the
  // new-message effect so atBottomRef is reset before that effect reads it.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !selectedId) return
    el.scrollTop = el.scrollHeight
    atBottomRef.current = true
    setShowNewPill(false)
    setNewCount(0)
  }, [selectedId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Use the scroll position captured BEFORE this item grew the list (measuring here
    // would be wrong — scrollHeight already includes the new message). Always follow
    // your own outgoing message to the bottom.
    const lastItem = combinedItems[combinedItems.length - 1]
    const lastIsMine =
      lastItem?.type === 'message' && (lastItem.data as ChatMessage).senderId === currentUserId
    if (atBottomRef.current || lastIsMine) {
      el.scrollTop = el.scrollHeight
      atBottomRef.current = true
      setShowNewPill(false)
      setNewCount(0)
    } else {
      setNewCount((prev) => prev + 1)
      setShowNewPill(true)
    }
  }, [combinedItems.length, currentUserId])
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

  // Clear the active peer when leaving the chat page, so new messages from the
  // last-open conversation resume counting toward the unread badge.
  useEffect(() => {
    return () => {
      dispatch(setActivePeer({ peerId: null }))
    }
  }, [dispatch])

  // Load 1:1 conversation history once per peer (per session) when a thread is opened.
  // Merges beneath any live messages (dedup by id, chronological) so nothing is lost.
  useEffect(() => {
    if (!selectedId || !currentUserId) return
    if (historyFetchedRef.current.has(selectedId)) return
    historyFetchedRef.current.add(selectedId)
    const peerId = selectedId
    const meId = String(currentUserId)
    apiService.chat
      .messages(peerId, { limit: 30 })
      .then((resp) => {
        const raw = resp.data?.messages ?? resp.data?.data?.messages ?? []
        if (!Array.isArray(raw) || raw.length === 0) return
        const mapped: ChatMessage[] = raw.map((m: any) => {
          const senderId = String(m.senderId)
          const isFromMe = senderId === meId
          const status: ChatMessage['status'] = m.read ? 'seen' : m.delivered ? 'delivered' : 'sent'
          // Guard against a malformed timestamp — new Date('bad').toISOString() throws,
          // which would abort the whole history load.
          const parsedTs = m.timestamp ? new Date(m.timestamp) : new Date()
          const timestamp = Number.isNaN(parsedTs.getTime()) ? new Date().toISOString() : parsedTs.toISOString()
          return {
            id: String(m.id),
            senderId,
            receivers: [isFromMe ? peerId : meId],
            text: m.content ?? '',
            timestamp,
            type: m.messageType === 'media' ? 'info' : undefined,
            status,
            attachment: m.attachment
              ? {
                  id: m.attachment.id,
                  type: m.attachment.type,
                  filename: m.attachment.filename,
                  mimeType: m.attachment.mimeType,
                  size: m.attachment.size,
                }
              : undefined,
          }
        })
        dispatch(mergeMessages({ peerId, messages: mapped }))
      })
      .catch(() => {
        // Allow a retry the next time this thread is opened if the fetch failed.
        historyFetchedRef.current.delete(peerId)
      })
  }, [selectedId, currentUserId, dispatch])

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
                  {t('comms.contacts')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {query.trim()
                    ? `${contacts.length} / ${allContacts.length} ${t('comms.contacts').toLowerCase()}`
                    : `${contacts.length} ${t('comms.contacts').toLowerCase()}`}
                </Typography>
              </Box>
            </Stack>
            {totalUnread > 0 && (
              <Chip size="small" label={`${totalUnread} new`} color="primary" />
            )}
          </Stack>

          <TextField
            size="small"
            placeholder={t('comms.search_contacts')}
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

          <Stack spacing={1} sx={{ overflowY: 'auto', flex: 1, minHeight: 0, maxHeight: 520, pr: 0.5 }}>
            {contacts.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('comms.no_contacts')}
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
                    <Box sx={{ textAlign: 'end' }}>
                      <Typography variant="caption" color="text.secondary">
                        {contact.status === 'online'
                          ? t('comms.online')
                          : formatRelativeTime(contact.lastSeen, locale, t('comms.unknown_time'))}
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
                <Stack direction={rowDirection} spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mt: 0.2 }}>
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
                        ? t('comms.online')
                        : t('comms.last_seen', { time: formatRelativeTime(selectedContact.lastSeen, locale, t('comms.unknown_time')) })}
                    </Typography>
                  </Stack>
                </Box>
                <Stack direction={rowDirection} spacing={0.75} alignItems="center">
                  {/* Organized call controls */}
                  <Tooltip title={t('comms.audio_call')}>
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
                  <Tooltip title={t('comms.video_call')}>
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
                  <Tooltip title={isMuted ? `${t('comms.muted')} (${muteTimeRemaining} ${t('comms.remaining')})` : t('comms.mute_notifications')}>
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
                  <Tooltip title={t('comms.call_history')}>
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
                    <Tooltip title={`${t('comms.muted_until')} ${new Date(mutedUntil).toLocaleTimeString()}`}>
                      <Chip 
                        size="small" 
                        label={muteTimeRemaining || t('comms.muted')} 
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
                <Typography sx={{ fontWeight: 700 }}>{t('comms.contacts')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('comms.subtitle')}
                </Typography>
              </Box>
            )}
          </Stack>

          <Divider />

          <Stack ref={scrollRef} onScroll={handleScroll} spacing={2} sx={{ flex: 1, overflowY: 'auto', paddingInlineEnd: 4, minHeight: 0, maxHeight: 520 }}>
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
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t('comms.contacts')}</Typography>
                  <Typography variant="body2">
                    {t('comms.start_conversation')}
                  </Typography>
                </Box>
              </Box>
            )}
            {selectedContact && combinedItems.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('comms.start_conversation')}
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
                      {formatDateHeader(item.timestamp, locale, t('comms.today'), t('comms.yesterday'))}
                    </Typography>
                  </Box>
                )
              }
              if (item.type === 'message') {
                const message = item.data as ChatMessage
                const isMe = message.senderId === currentUserId
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
                              {t('comms.loading_attachment')}
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
                        {formatMessageTime(message.timestamp, locale)}
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
                            {call.callType === 'video' ? t('comms.video_call') : t('comms.audio_call')} {call.direction === 'incoming' ? t('comms.from') : t('comms.to')} {selectedContact?.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {call.startedAt ? new Date(call.startedAt).toLocaleString(locale) : t('comms.unknown_time')}
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
              {t('comms.typing')}
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
              {newCount > 1 ? `${newCount} ${t('comms.new_messages')}` : t('comms.new_message')}
            </Box>
          )}

          {selectedContact && (
            <>
              <Stack direction={rowDirection} spacing={1} sx={{ flexWrap: 'wrap' }}>
                {quickReplies.map((reply) => (
                  <Chip key={reply} label={reply} onClick={() => setDraft(reply)} />
                ))}
              </Stack>

              <Stack direction={rowDirection} spacing={1} alignItems="flex-end">
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
                  {t('comms.attach')}
                </Button>
                <TextField
                  size="small"
                  placeholder={t('comms.new_message')}
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
                <Button icon={<SendRoundedIcon fontSize="small" />} onClick={handleSend}>{t('comms.send')}</Button>
              </Stack>
              {pendingAttachment && (
                <Chip
                  size="small"
                  label={`${t('comms.ready_to_send')}: ${pendingAttachment.filename}`}
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
          {t('comms.mute_15_min')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedContact) {
              dispatch(setMute({ peerId: selectedContact.id, until: Date.now() + 60 * 60 * 1000 }))
            }
            setMuteAnchorEl(null)
          }}
        >
          {t('comms.mute_1_hour')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedContact) {
              dispatch(setMute({ peerId: selectedContact.id, until: Date.now() + 8 * 60 * 60 * 1000 }))
            }
            setMuteAnchorEl(null)
          }}
        >
          {t('comms.mute_8_hours')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedContact) {
              dispatch(clearMute({ peerId: selectedContact.id }))
            }
            setMuteAnchorEl(null)
          }}
        >
          {t('comms.unmute')}
        </MenuItem>
      </Menu>
      <AttachmentLightbox lightbox={lightbox} onClose={() => setLightbox(null)} onDownload={handleDownloadImage} />

      <Dialog open={showCallHistory} onClose={() => setShowCallHistory(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction={rowDirection} justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t('comms.call_history')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedCallHistory.length} {t('comms.completed_calls')}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {selectedCallHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('comms.no_call_history')}
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
                    <Stack direction={rowDirection} alignItems="center" justifyContent="space-between" spacing={1}>
                      <Stack direction={rowDirection} spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
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
                            {call.callType === 'video' ? t('comms.video_call') : t('comms.audio_call')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {call.startedAt ? new Date(call.startedAt).toLocaleString() : t('comms.unknown_time')}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction={rowDirection} spacing={1} alignItems="center">
                        {call.endedAt ? (
                          <Typography variant="caption" color="text.secondary">
                            {formatDuration(call.startedAt, call.endedAt)}
                          </Typography>
                        ) : null}
                        <Chip
                          size="small"
                          label={call.direction === 'incoming' ? t('comms.incoming') : t('comms.outgoing')}
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

