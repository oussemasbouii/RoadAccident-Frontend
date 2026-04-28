import { Box, Chip, Divider, IconButton, Menu, MenuItem, Popover, Stack, TextField, Tooltip, Typography, alpha, useTheme } from '@mui/material'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import CallRoundedIcon from '@mui/icons-material/CallRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import MinimizeRoundedIcon from '@mui/icons-material/MinimizeRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'
import { useEffect, useMemo, useRef, useState } from 'react'
import NotificationsOffRoundedIcon from '@mui/icons-material/NotificationsOffRounded'
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded'
import AttachmentLightbox from '@/components/AttachmentLightbox'
import type { ChatContact, ChatMessage } from '@/types/chat'
import type { CallSession } from '@/types/call'
import { useChatComposer } from '@/features/communications/hooks/useChatComposer'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { clearMute, setMute, toggleReaction, loadPersistedMutes, cleanupExpiredMutes } from '@/features/chat/slices/chatSlice'
import { getAccessToken, getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket } from '@/services/socketClient'

type ChatWindowProps = {
  peer: ChatContact
  messages: ChatMessage[]
  currentUserId: string | null
  isMinimized: boolean
  isActive: boolean
  unreadCount: number
  typing: boolean
  onMinimize: () => void
  onClose: () => void
  onFocus: () => void
  onCall: (type: 'audio' | 'video') => void
}

const QUICK_REPLIES = ['On my way', 'Need backup', 'ETA 5 min', 'Scene secured', 'Call me']

const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡']

function formatMessageTime(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(value?: string) {
  if (!value) return 'Unknown'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  const now = new Date()
  const diffMs = now.getTime() - parsed
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMinutes === 0) return 'now'
      return `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  }
  return new Date(parsed).toLocaleDateString()
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
  }
  if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatDuration(startedAt?: number, endedAt?: number) {
  if (!startedAt || !endedAt) return ''
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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


export default function ChatWindow({
  peer,
  messages,
  currentUserId,
  isMinimized,
  isActive,
  unreadCount,
  typing,
  onMinimize,
  onClose,
  onFocus,
  onCall,
}: ChatWindowProps) {
  const theme = useTheme()
  const dispatch = useAppDispatch()
  const muteByPeer = useAppSelector((state) => state.chat.muteByPeer)
  const activeCall = useAppSelector((state) => state.call.activeCall)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showNewPill, setShowNewPill] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const [muteAnchor, setMuteAnchor] = useState<null | HTMLElement>(null)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [openReactionFor, setOpenReactionFor] = useState<string | null>(null)
  const [reactionAnchor, setReactionAnchor] = useState<null | HTMLElement>(null)
  const reactionCloseTimer = useRef<any>(null)
  const callHistory = useAppSelector((state) => state.call.callHistory)

  if (activeCall) return null

  const selectedCallHistory = useMemo(() => {
    return callHistory.filter((call: CallSession) =>
      call.peer.id === peer.id || call.peer.officerId === peer.officerId
    )
  }, [callHistory, peer.id, peer.officerId])

  const sortedCallHistory = useMemo(() => {
    return [...selectedCallHistory].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
  }, [selectedCallHistory])

  const combinedItems = useMemo(() => {
    const messageItems = messages.map((message) => ({
      type: 'message' as const,
      data: message,
      timestamp: message.timestamp ? Date.parse(message.timestamp) : 0,
    }))
    const callItems = sortedCallHistory.map((call) => ({
      type: 'call' as const,
      data: call,
      timestamp: call.startedAt || 0,
    }))
    return [...messageItems, ...callItems].sort((a, b) => a.timestamp - b.timestamp)
  }, [messages, sortedCallHistory])

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
  } = useChatComposer({ peer, currentUserId, messages })

  const renderedItems = useMemo(() => {
    return combinedItems.reduce<React.ReactElement[]>((acc, item, index) => {
      const currentDateKey = getDateKey(item.timestamp)
      const prevItem = combinedItems[index - 1]
      const prevDateKey = prevItem ? getDateKey(prevItem.timestamp) : ''
      if (currentDateKey !== prevDateKey) {
        acc.push(
          <Box key={`date-${currentDateKey}`} sx={{ textAlign: 'center', my: 2 }}>
            <Chip label={formatDateHeader(item.timestamp)} size="small" variant="outlined" />
          </Box>
        )
      }
      if (item.type === 'call') {
        const call = item.data as CallSession
        acc.push(
          <Box
            key={`${call.callId}-${call.startedAt}`}
            sx={{
              alignSelf: 'center',
              maxWidth: '80%',
              p: 1.2,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              textAlign: 'center',
              mb: 1,
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="center">
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
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {call.callType === 'video' ? 'Video call' : 'Audio call'} {call.status === 'ended' ? 'ended' : call.status}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {call.startedAt ? formatRelativeTime(new Date(call.startedAt).toISOString()) : 'Unknown time'}
                  {call.endedAt && ` • ${formatDuration(call.startedAt, call.endedAt)}`}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )
      } else {
        const message = item.data as ChatMessage
        const isMe = message.senderId === currentUserId
        const reactionEntries = message.reactions
          ? Object.entries(message.reactions)
              .map(([emoji, users]) => ({ emoji, count: users.length }))
              .filter((entry) => entry.count > 0)
          : []
        const statusIcon =
          message.status === 'seen'
            ? <DoneAllRoundedIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
            : message.status === 'delivered'
              ? <DoneRoundedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
              : message.status === 'failed'
                ? <ErrorOutlineRoundedIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />
                : null

        acc.push(
          <Box
            key={message.id}
            sx={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%', mb: 1 }}
            onMouseEnter={() => setHoveredMessageId(message.id)}
            onMouseLeave={() => setHoveredMessageId((prev) => (prev === message.id ? null : prev))}
            onContextMenu={(e) => {
              e.preventDefault()
              setOpenReactionFor(message.id)
              setReactionAnchor(e.currentTarget as HTMLElement)
            }}
          >
            <Box
              sx={{
                p: 1.1,
                borderRadius: 2.2,
                bgcolor: isMe ? theme.palette.primary.main : alpha(theme.palette.action.active, 0.06),
                color: isMe ? theme.palette.primary.contrastText : 'text.primary',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                position: 'relative',
              }}
            >
              {message.attachment ? (
                <Stack spacing={0.6}>
                  {attachmentUrls[message.attachment.id] ? (
                    <Box
                      component="img"
                      src={message.attachment ? attachmentUrls[message.attachment.id] : ''}
                      alt={message.attachment?.filename || 'attachment'}
                      sx={{
                        width: 200,
                        maxWidth: '100%',
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                        cursor: 'pointer',
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
                        py: 0.5,
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
                    <Typography variant="body2">{message.text}</Typography>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2">{message.text}</Typography>
              )}
            </Box>
            {reactionEntries.length > 0 && (
              <Stack direction="row" spacing={0.3} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.3 }}>
                {reactionEntries.map((entry) => (
                  <Chip
                    key={entry.emoji}
                    label={`${entry.emoji} ${entry.count}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 24,
                      fontSize: 12,
                      '& .MuiChip-label': { px: 0.8, py: 0.2 },
                    }}
                  />
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.4 }}>
              <Typography variant="caption" color="text.secondary">
                {formatMessageTime(message.timestamp)}
              </Typography>
              {isMe && statusIcon}
            </Stack>
          </Box>
        )
      }
      return acc
    }, [])
  }, [combinedItems, currentUserId, attachmentUrls, theme.palette.primary.main, theme.palette.text.secondary, theme.palette.error.main])

  const lastMessage = useMemo(() => messages[messages.length - 1], [messages])
  const mutedUntil = muteByPeer[peer.id] || 0
  const isMuted = mutedUntil > Date.now()
  const muteTimeRemaining = isMuted ? formatMuteTimeRemaining(mutedUntil) : ''

  useEffect(() => {
    if (!isActive || isMinimized) return
    if (!peer?.id || !currentUserId) return
    
    // Auto-mark messages as seen when window is active
    const lastIncomingIndex = messages.length - 1
    let lastUnseenMessageId: string | null = null
    
    for (let i = lastIncomingIndex; i >= 0; i--) {
      const msg = messages[i]
      if (msg.senderId !== currentUserId && msg.status !== 'seen') {
        lastUnseenMessageId = msg.id
        break
      }
    }
    
    if (lastUnseenMessageId) {
      // Emit seen status after a small delay to ensure message is visible
      const timer = window.setTimeout(() => {
        const token = getRefreshToken() || getAccessToken()
        if (!token) return
        const socket = connectSharedSocket(token)
        if (!socket || socket.disconnected) return
        
        socket.emit(
          'request:message:seen',
          {
            messageId: lastUnseenMessageId,
            seen: { by: currentUserId, timestamp: new Date().toISOString() },
          },
          (ack: { acknowledged?: boolean; error?: string }) => {
            if (import.meta.env.DEV && !ack?.acknowledged) {
              console.warn('[ChatWindow] seen ack failed', ack?.error || 'unknown error', lastUnseenMessageId)
            }
          }
        )
      }, 300)
      
      return () => window.clearTimeout(timer)
    }
  }, [isActive, isMinimized, messages, peer?.id, currentUserId])

  useEffect(() => {
    if (!isActive || isMinimized) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isActive, isMinimized, onClose])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom) {
      el.scrollTop = el.scrollHeight
      setShowNewPill(false)
      setNewCount(0)
    } else {
      setShowNewPill(true)
      setNewCount((count) => count + 1)
    }
  }, [messages.length])

  // Initialize persisted mutes on component mount
  useEffect(() => {
    dispatch(loadPersistedMutes())
  }, [dispatch])

  // Cleanup expired mutes periodically
  useEffect(() => {
    const cleanup = () => dispatch(cleanupExpiredMutes())
    cleanup() // Run immediately
    const interval = setInterval(cleanup, 60000) // Run every minute
    return () => clearInterval(interval)
  }, [dispatch])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom) {
      setShowNewPill(false)
      setNewCount(0)
    }
  }

  const handleRetry = (message: ChatMessage) => {
    setDraft(message.text || '')
    if (message.attachment) {
      setPendingAttachment(message.attachment)
    }
    setTimeout(() => {
      handleSend()
    }, 50)
  }

  const handleToggleReaction = (message: ChatMessage, emoji: string) => {
    if (!currentUserId) return
    dispatch(
      toggleReaction({
        peerId: peer.id,
        messageId: message.id,
        emoji,
        userId: currentUserId,
      })
    )
  }

  // Memoize computed message data to prevent unnecessary recalculations
  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const isMe = message.senderId === currentUserId
      const statusIcon =
        message.status === 'seen'
          ? <DoneAllRoundedIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
          : message.status === 'delivered'
            ? <DoneRoundedIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
            : message.status === 'failed'
              ? <ErrorOutlineRoundedIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />
              : null

      // Determine if timestamp should be shown
      const prev = index > 0 ? messages[index - 1] : null
      const next = index < messages.length - 1 ? messages[index + 1] : null
      const showTimestamp = true // Always show timestamp for every message

      // Get reaction data
      const reactionEntries = message.reactions
        ? Object.entries(message.reactions).map(([emoji, userIds]) => ({
            emoji,
            count: userIds.length,
            hasCurrentUser: currentUserId ? userIds.includes(currentUserId) : false,
          }))
        : []

      return {
        message,
        isMe,
        statusIcon,
        showTimestamp,
        reactionEntries,
      }
    })
  }, [messages, currentUserId, theme.palette.primary.main, theme.palette.text.secondary, theme.palette.error.main])

  return (
    <Box
      sx={{
        width: 340,
        height: isMinimized ? 64 : 520,
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.paper, 0.98),
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        outline: isActive ? `2px solid ${alpha(theme.palette.primary.main, 0.35)}` : 'none',
        transition: 'height 0.2s ease, outline 0.2s ease',
      }}
      onClick={onFocus}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 1.8,
          py: 1.2,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.16),
              color: theme.palette.primary.main,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {peer.name[0]}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {peer.name}
            </Typography>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: peer.status === 'online' ? theme.palette.success.main : theme.palette.text.disabled,
                }}
              />
              <Typography variant="caption" color="text.secondary" noWrap>
                {peer.status === 'online' ? 'Online' : 'Offline'}
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.8}>
          <Tooltip title="Audio call">
            <IconButton
              size="small"
              onClick={() => onCall('audio')}
              sx={{
                borderRadius: 999,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                width: 30,
                height: 30,
                color: theme.palette.primary.main,
              }}
            >
              <CallRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Video call">
            <IconButton
              size="small"
              onClick={() => onCall('video')}
              sx={{
                borderRadius: 999,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                width: 30,
                height: 30,
                color: theme.palette.primary.main,
              }}
            >
              <VideocamRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isMuted ? `Muted (${muteTimeRemaining} remaining)` : 'Mute notifications'}>
            <IconButton
              size="small"
              onClick={(event) => setMuteAnchor(event.currentTarget)}
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                width: 30,
                height: 30,
                color: isMuted ? theme.palette.warning.main : theme.palette.text.secondary,
              }}
            >
              {isMuted ? <NotificationsOffRoundedIcon fontSize="small" /> : <NotificationsActiveRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          {isMuted && (
            <Tooltip title={muteTimeRemaining ? `Muted (${muteTimeRemaining} remaining)` : 'Muted'}>
              <Chip
                size="small"
                label="Muted"
                color="warning"
                sx={{ height: 30, ml: 1 }}
              />
            </Tooltip>
          )}
          <Tooltip title={isMinimized ? 'Open' : 'Minimize'}>
            <IconButton
              size="small"
              onClick={onMinimize}
              sx={{
                borderRadius: 999,
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                width: 30,
                height: 30,
              }}
            >
              <MinimizeRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                borderRadius: 999,
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                width: 30,
                height: 30,
              }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {unreadCount > 0 && (
            <Box
              sx={{
                ml: 0.4,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontSize: 11,
                fontWeight: 700,
                display: 'grid',
                placeItems: 'center',
                px: 0.6,
              }}
            >
              {unreadCount}
            </Box>
          )}
        </Stack>
      </Stack>
      <Menu
        anchorEl={muteAnchor}
        open={Boolean(muteAnchor)}
        onClose={() => setMuteAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disablePortal
        PaperProps={{ sx: { zIndex: 2601 } }}
      >
        <MenuItem
          onClick={() => {
            dispatch(setMute({ peerId: peer.id, until: Date.now() + 15 * 60 * 1000 }))
            setMuteAnchor(null)
          }}
        >
          Mute 15 min
        </MenuItem>
        <MenuItem
          onClick={() => {
            dispatch(setMute({ peerId: peer.id, until: Date.now() + 60 * 60 * 1000 }))
            setMuteAnchor(null)
          }}
        >
          Mute 1 hour
        </MenuItem>
        <MenuItem
          onClick={() => {
            dispatch(setMute({ peerId: peer.id, until: Date.now() + 8 * 60 * 60 * 1000 }))
            setMuteAnchor(null)
          }}
        >
          Mute 8 hours
        </MenuItem>
        <MenuItem
          onClick={() => {
            dispatch(clearMute({ peerId: peer.id }))
            setMuteAnchor(null)
          }}
        >
          Unmute
        </MenuItem>
      </Menu>

      {!isMinimized && (
        <>
          <Divider />
          <Stack
            spacing={1.2}
            sx={{ p: 1.6, flex: 1, overflowY: 'auto' }}
            ref={scrollRef}
            onScroll={handleScroll}
          >
            {renderedItems}
          </Stack>

          {typing && (
            <Box
              sx={{
                alignSelf: 'flex-start',
                mx: 1.5,
                mb: 0.8,
                px: 1,
                py: 0.4,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                '@keyframes dotPulse': {
                  '0%, 100%': { opacity: 0.2 },
                  '50%': { opacity: 1 },
                },
              }}
            >
              <FiberManualRecordRoundedIcon sx={{ fontSize: 8, animation: 'dotPulse 1s infinite' }} />
              <FiberManualRecordRoundedIcon sx={{ fontSize: 8, animation: 'dotPulse 1s infinite 0.2s' }} />
              <FiberManualRecordRoundedIcon sx={{ fontSize: 8, animation: 'dotPulse 1s infinite 0.4s' }} />
            </Box>
          )}

          {showNewPill && (
            <Box
              onClick={() => {
                const el = scrollRef.current
                if (!el) return
                el.scrollTop = el.scrollHeight
                setShowNewPill(false)
                setNewCount(0)
              }}
              sx={{
                alignSelf: 'center',
                mb: 0.6,
                px: 1.2,
                py: 0.4,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {newCount > 1 ? `${newCount} new messages` : 'New message'}
            </Box>
          )}

          <Box sx={{ px: 1.6, pb: 0.8 }}>
            <Box
              sx={{
                display: 'flex',
                gap: 0.6,
                flexWrap: 'wrap',
              }}
            >
              {QUICK_REPLIES.map((reply) => (
                <Box
                  key={reply}
                  onClick={() => setDraft(reply)}
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: 999,
                    cursor: 'pointer',
                    bgcolor: alpha(theme.palette.action.active, 0.05),
                    color: theme.palette.text.primary,
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                  }}
                >
                  {reply}
                </Box>
              ))}
            </Box>
          </Box>

          <Stack direction="row" spacing={0.8} alignItems="flex-end" sx={{ px: 1.6, pb: 1.4 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <TextField
              size="small"
              placeholder="Type a message..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
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
                  borderRadius: 2,
                },
              }}
            />
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Tooltip title="Attach">
                <IconButton
                  size="small"
                  onClick={handleFilePick}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    width: 34,
                    height: 34,
                  }}
                >
                  <AttachFileRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Send">
                <IconButton
                  size="small"
                  onClick={handleSend}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    width: 34,
                    height: 34,
                    color: theme.palette.primary.main,
                  }}
                >
                  <SendRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          {pendingAttachment && (
            <Box sx={{ px: 1.5, pb: 1.2 }}>
              <Chip
                size="small"
                label={`Ready: ${pendingAttachment.filename}`}
                onDelete={() => setPendingAttachment(null)}
              />
            </Box>
          )}
        </>
      )}

      {isMinimized && (
        <Box
          sx={{
            px: 1.8,
            pb: 1.2,
            color: theme.palette.text.secondary,
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lastMessage?.text || 'No messages yet'}
        </Box>
      )}

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
                if (!openReactionFor) return
                const message = messages.find((m) => m.id === openReactionFor)
                if (!message) return
                handleToggleReaction(message, emoji)
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
    </Box>
  )
}

