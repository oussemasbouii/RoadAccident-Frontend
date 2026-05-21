import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Avatar, Box, Chip, IconButton, Stack, Typography, alpha, useTheme } from '@mui/material'
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded'
import MicRoundedIcon from '@mui/icons-material/MicRounded'
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'
import PictureInPictureAltRoundedIcon from '@mui/icons-material/PictureInPictureAltRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import { useAppSelector } from '@/store/store'
import { Button } from '@/components/Common'
import { useCallTimer } from '@/hooks/useCallTimer'
import type { CallPeer, CallStatus } from '@/types/call'
import { isUuidLike, shortIdentifier } from '@/utils/callUtils'
import { useTranslation } from '@/themeMode'

type Props = {
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
  localDisplayName?: string
  isMuted?: boolean
  onToggleMute?: () => void
  isConnected?: boolean
  isCameraEnabled?: boolean
  remoteAudioPlaying?: boolean
  remoteVideoPlaying?: boolean
  connectionError?: string | null
  onToggleCamera?: () => void
  remoteVideoRef?: (node: HTMLVideoElement | null) => void
  localVideoRef?: (node: HTMLVideoElement | null) => void
}

const TERMINAL_STATUSES: CallStatus[] = ['ended', 'failed', 'missed']

function formatRole(value?: string | null, officerLabel = 'Officer') {
  const role = (value || officerLabel).trim()
  if (!role) return officerLabel
  if (/^office?r?$/i.test(role)) return officerLabel
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function resolvePeerName(peer: CallPeer, officerLabel = 'Officer') {
  if (peer.name && !isUuidLike(peer.name)) return peer.name
  if (peer.officerId && !isUuidLike(peer.officerId)) return peer.officerId
  if (peer.officerId) return `${officerLabel} ${shortIdentifier(peer.officerId)}`
  return officerLabel
}

function resolvePeerMeta(peer: CallPeer, labels = { officer: 'Officer', idLabel: 'ID' }) {
  const role = formatRole(peer.role, labels.officer)
  const officerId = peer.officerId || peer.id
  if (!officerId) return role
  if (isUuidLike(officerId)) return `ID ${shortIdentifier(officerId)} · ${role}`
  return `${officerId} · ${role}`
}

function getInitial(value?: string | null, fallback = 'O') {
  const trimmed = String(value || '').trim()
  return (trimmed[0] || fallback).toUpperCase()
}

function Badge({
  label,
  tone,
  icon,
}: {
  label: string
  tone: string
  icon?: ReactElement
}) {
  return (
    <Chip
      size="small"
      label={label}
      icon={icon}
      sx={{
        height: 24,
        fontWeight: 700,
        bgcolor: alpha(tone, 0.12),
        color: tone,
        border: `1px solid ${alpha(tone, 0.18)}`,
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  )
}

type Point = { x: number; y: number }

export default function CallOverlay({
  onAccept,
  onReject,
  onEnd,
  localDisplayName,
  isMuted = false,
  onToggleMute,
  isConnected = false,
  isCameraEnabled = false,
  remoteAudioPlaying = false,
  remoteVideoPlaying = false,
  connectionError = null,
  onToggleCamera,
  remoteVideoRef,
  localVideoRef,
}: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const call = useAppSelector((state) => state.call.activeCall)

  const isIncoming = call?.status === 'ringing'
  const isOutgoing = call?.status === 'outgoing'
  const isActive = call?.status === 'in_call'
  const isVideoCall = call?.callType === 'video'
  const peerName = call ? resolvePeerName(call.peer, t('calls.officer')) : ''
  const peerMeta = call ? resolvePeerMeta(call.peer, { officer: t('calls.officer'), idLabel: t('calls.id_label') }) : ''
  const peerInitial = useMemo(() => getInitial(peerName, 'C'), [peerName])
  const localInitial = useMemo(() => getInitial(localDisplayName, 'U'), [localDisplayName])
  const tone = isIncoming
    ? theme.palette.warning.main
    : isActive
      ? theme.palette.success.main
      : theme.palette.primary.main

  const { formatted: timerText } = useCallTimer(isActive ? call?.startedAt : undefined)

  const [isPip, setIsPip] = useState(false)
  const [isPipHovered, setIsPipHovered] = useState(false)
  const [pipPos, setPipPos] = useState<Point>({ x: 0, y: 0 })
  const previousCallIdRef = useRef<string | undefined>(undefined)
  const dragRef = useRef<{
    dragging: boolean
    offsetX: number
    offsetY: number
  }>({ dragging: false, offsetX: 0, offsetY: 0 })

  const pipSize = useMemo(
    () => ({
      width: isVideoCall ? 412 : 356,
      height: isVideoCall ? 312 : 226,
    }),
    [isVideoCall]
  )

  const title = isIncoming
    ? t('calls.incoming_call')
    : isOutgoing
      ? t('calls.calling')
      : t('calls.call_connected')

  useEffect(() => {
    if (!call?.callId) {
      previousCallIdRef.current = undefined
      setIsPip(false)
      setIsPipHovered(false)
      return
    }

    if (previousCallIdRef.current && previousCallIdRef.current !== call.callId) {
      setIsPip(false)
      setIsPipHovered(false)
    }

    previousCallIdRef.current = call.callId
  }, [call?.callId, call?.status])

  const placePipBottomRight = () => {
    if (typeof window === 'undefined') return
    const margin = 16
    const x = Math.max(margin, window.innerWidth - pipSize.width - margin)
    const y = Math.max(margin, window.innerHeight - pipSize.height - margin)
    setPipPos({ x, y })
  }

  useEffect(() => {
    if (!isPip) return
    placePipBottomRight()
  }, [isPip, pipSize.width, pipSize.height])

  useEffect(() => {
    if (!isPip || typeof window === 'undefined') return

    const clampPosition = (next: Point) => {
      const margin = 8
      const maxX = Math.max(margin, window.innerWidth - pipSize.width - margin)
      const maxY = Math.max(margin, window.innerHeight - pipSize.height - margin)
      return {
        x: Math.min(Math.max(margin, next.x), maxX),
        y: Math.min(Math.max(margin, next.y), maxY),
      }
    }

    const onMove = (event: PointerEvent) => {
      if (!dragRef.current.dragging) return
      event.preventDefault()
      setPipPos(
        clampPosition({
          x: event.clientX - dragRef.current.offsetX,
          y: event.clientY - dragRef.current.offsetY,
        })
      )
    }

    const onUp = () => {
      dragRef.current.dragging = false
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isPip, pipSize.height, pipSize.width])

  if (!call || TERMINAL_STATUSES.includes(call.status) || call.status === 'idle') return null

  const startDrag = (event: React.PointerEvent) => {
    if (!isPip || typeof window === 'undefined') return
    dragRef.current.dragging = true
    dragRef.current.offsetX = event.clientX - pipPos.x
    dragRef.current.offsetY = event.clientY - pipPos.y
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  const stopDrag = (event: React.PointerEvent) => {
    if (!isPip) return
    dragRef.current.dragging = false
    try {
      ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }

  const openPiP = () => {
    if (typeof window !== 'undefined') placePipBottomRight()
    setIsPip(true)
    setIsPipHovered(false)
  }

  const restoreModal = () => {
    setIsPip(false)
    setIsPipHovered(false)
  }

  const renderActions = () => (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.2}
      sx={{
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        '& > *': {
          flex: 1,
          minWidth: { xs: '100%', sm: 118 },
        },
      }}
    >
      {isIncoming && (
        <>
          <Button
            size="lg"
            icon={<PhoneInTalkRoundedIcon fontSize="small" />}
            onClick={onAccept}
            style={{
              background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
              color: theme.palette.success.contrastText,
              boxShadow: '0 12px 28px rgba(46, 125, 50, 0.22)',
            }}
          >
            {t('calls.answer')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            icon={<CallEndRoundedIcon fontSize="small" />}
            onClick={onReject}
          >
            {t('calls.reject')}
          </Button>
        </>
      )}

      {isOutgoing && (
        <Button
          size="lg"
          variant="secondary"
          icon={<CallEndRoundedIcon fontSize="small" />}
          onClick={onEnd}
        >
          {t('calls.cancel')}
        </Button>
      )}

      {isActive && (
        <>
          {isVideoCall && (
            <Button
              size="lg"
              icon={isCameraEnabled ? <VideocamRoundedIcon fontSize="small" /> : <VideocamOffRoundedIcon fontSize="small" />}
              onClick={onToggleCamera}
              variant={isCameraEnabled ? 'primary' : 'secondary'}
              disabled={!isConnected || Boolean(connectionError)}
            >
              {isCameraEnabled ? t('calls.camera_off') : t('calls.camera_on')}
            </Button>
          )}
          <Button
            size="lg"
            icon={isMuted ? <MicRoundedIcon fontSize="small" /> : <MicOffRoundedIcon fontSize="small" />}
            onClick={onToggleMute}
            variant={isMuted ? 'primary' : 'secondary'}
            disabled={!isConnected || Boolean(connectionError)}
          >
            {isMuted ? t('calls.unmute') : t('calls.mute')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            icon={<CallEndRoundedIcon fontSize="small" />}
            onClick={onEnd}
          >
            {t('calls.end_call')}
          </Button>
        </>
      )}
    </Stack>
  )

  const renderVideoArea = () => (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        bgcolor: theme.palette.common.black,
        minHeight: { xs: 260, sm: 320 },
        aspectRatio: '16 / 10',
      }}
    >
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: remoteVideoPlaying ? 'block' : 'none',
          backgroundColor: theme.palette.common.black,
        }}
      />

      {!remoteVideoPlaying && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.common.black, 0.9),
          }}
        >
          <Stack spacing={1} alignItems="center" sx={{ color: theme.palette.common.white }}>
            <Avatar
              sx={{
                width: 68,
                height: 68,
                bgcolor: alpha(theme.palette.common.white, 0.12),
                color: theme.palette.common.white,
                fontWeight: 800,
              }}
            >
              {peerInitial}
            </Avatar>
            <Typography variant="body2" sx={{ opacity: 0.84 }}>
              {isConnected ? t('calls.waiting_for_video') : t('calls.connecting')}
            </Typography>
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          left: 12,
          top: 12,
          display: 'flex',
          gap: 0.75,
          flexWrap: 'wrap',
        }}
      >
        <Badge
          label={isConnected ? (remoteAudioPlaying ? t('calls.live') : t('calls.audio')) : t('calls.connecting')}
          tone={theme.palette.common.white}
          icon={isConnected ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
        />
        <Badge
          label={isCameraEnabled ? t('calls.camera_on') : t('calls.camera_off')}
          tone={theme.palette.common.white}
          icon={isCameraEnabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          width: { xs: 72, sm: 88 },
          aspectRatio: '3 / 4',
          borderRadius: 3,
          overflow: 'hidden',
          border: `2px solid ${alpha(theme.palette.common.white, 0.3)}`,
          boxShadow: '0 10px 28px rgba(0,0,0,0.42)',
          bgcolor: alpha(theme.palette.common.black, 0.82),
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isCameraEnabled ? 'block' : 'none',
          }}
        />
        {!isCameraEnabled && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.common.black, 0.8),
            }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: alpha(theme.palette.common.white, 0.12),
                color: theme.palette.common.white,
                fontWeight: 800,
              }}
            >
              {peerInitial}
            </Avatar>
          </Box>
        )}
      </Box>
    </Box>
  )

  const modalBody = (
    <Box
      sx={{
        width: { xs: '100%', sm: 560 },
        maxWidth: '100%',
        borderRadius: 5,
        overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.paper, 0.98),
        border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
        boxShadow: '0 28px 80px rgba(0,0,0,0.28)',
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.75 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge label={title} tone={tone} />
          <Stack direction="row" spacing={0.5}>
            {isActive && (
              <IconButton
                size="small"
                onClick={openPiP}
                  sx={{
                    border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                  }}
                >
                  <PictureInPictureAltRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Stack>

          {isVideoCall ? renderVideoArea() : (
            <Stack spacing={1.5} alignItems="center">
              <Avatar
                sx={{
                  width: 88,
                  height: 88,
                  fontSize: 32,
                  fontWeight: 800,
                  bgcolor: alpha(tone, 0.12),
                  color: tone,
                  boxShadow: `0 0 0 10px ${alpha(tone, 0.08)}`,
                  animation: isIncoming ? 'avatarPulse 1.4s ease-in-out infinite' : 'none',
                  '@keyframes avatarPulse': {
                    '0%, 100%': { boxShadow: `0 0 0 10px ${alpha(tone, 0.08)}` },
                    '50%': { boxShadow: `0 0 0 18px ${alpha(tone, 0)}` },
                  },
                }}
              >
                {peerInitial}
              </Avatar>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {peerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {peerMeta}
                </Typography>
              </Box>
            </Stack>
          )}

          <Box sx={{ textAlign: 'center', px: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: isIncoming ? tone : theme.palette.text.secondary,
              }}
            >
              {title}
            </Typography>
            {isActive && (
              <Typography
                variant="h3"
                sx={{
                  mt: 0.75,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: theme.palette.success.main,
                  letterSpacing: 1,
                }}
              >
                {timerText}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Badge
              label={call.callType === 'video' ? t('comms.video_call') : t('calls.voice_call')}
              tone={tone}
              icon={call.callType === 'video' ? <VideocamRoundedIcon /> : <PhoneInTalkRoundedIcon />}
            />
            {isActive && (
              <Badge
                label={isConnected ? (remoteAudioPlaying ? t('calls.connected') : t('calls.connecting_audio')) : t('calls.no_connection')}
                tone={tone}
                icon={isConnected ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
              />
            )}
            {isActive && (
              <Badge
                label={isMuted ? t('calls.muted') : t('calls.mic_on')}
                tone={tone}
                icon={isMuted ? <MicOffRoundedIcon /> : <MicRoundedIcon />}
              />
            )}
          </Stack>

          {isActive && connectionError && (
            <Box
              sx={{
                p: 1.25,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.error.main, 0.22)}`,
                bgcolor: alpha(theme.palette.error.main, 0.08),
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 800, color: theme.palette.error.main, textAlign: 'center' }}
              >
                {t('calls.media_server_unavailable')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {connectionError}
              </Typography>
            </Box>
          )}

          {renderActions()}
        </Stack>
      </Box>
    </Box>
  )

  const renderPipControls = () => (
    <Box
      sx={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        display: 'flex',
        justifyContent: 'center',
        opacity: isPipHovered ? 1 : 0,
        transform: isPipHovered ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 160ms ease, transform 160ms ease',
        pointerEvents: isPipHovered ? 'auto' : 'none',
        zIndex: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 1,
          borderRadius: 999,
          bgcolor: alpha(theme.palette.common.black, 0.52),
          backdropFilter: 'blur(14px)',
          boxShadow: '0 12px 28px rgba(0,0,0,0.26)',
        }}
      >
        {isActive && (
          <>
            <IconButton
              size="small"
              onClick={onToggleMute}
              disabled={!isConnected || Boolean(connectionError)}
              sx={{
                color: theme.palette.common.white,
                bgcolor: alpha(theme.palette.common.white, 0.12),
                '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.2) },
              }}
            >
              {isMuted ? <MicOffRoundedIcon fontSize="small" /> : <MicRoundedIcon fontSize="small" />}
            </IconButton>
            {isVideoCall && (
              <IconButton
                size="small"
                onClick={onToggleCamera}
                disabled={!isConnected || Boolean(connectionError)}
                sx={{
                  color: theme.palette.common.white,
                  bgcolor: alpha(theme.palette.common.white, 0.12),
                  '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.2) },
                }}
              >
                {isCameraEnabled ? <VideocamRoundedIcon fontSize="small" /> : <VideocamOffRoundedIcon fontSize="small" />}
              </IconButton>
            )}
          </>
        )}
        <IconButton
          size="small"
          onClick={restoreModal}
          sx={{
            color: theme.palette.common.white,
            bgcolor: alpha(theme.palette.common.white, 0.12),
            '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.2) },
          }}
        >
          <FullscreenRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={onEnd}
          sx={{
            color: theme.palette.common.white,
            bgcolor: alpha(theme.palette.error.main, 0.9),
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 1) },
          }}
        >
          <CallEndRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )

  const pipBody = (
    <Box
      sx={{
        position: 'fixed',
        left: pipPos.x,
        top: pipPos.y,
        width: pipSize.width,
        height: pipSize.height,
        maxWidth: 'calc(100vw - 16px)',
        pointerEvents: 'auto',
        borderRadius: 4.5,
        overflow: 'hidden',
        bgcolor: theme.palette.common.black,
        boxShadow: '0 22px 58px rgba(0,0,0,0.36)',
      }}
      onMouseEnter={() => setIsPipHovered(true)}
      onMouseLeave={() => setIsPipHovered(false)}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'move',
          bgcolor: alpha(theme.palette.common.black, 0.18),
          backgroundImage: `linear-gradient(to bottom, ${alpha(theme.palette.common.black, 0.42)}, transparent)`,
          zIndex: 2,
          userSelect: 'none',
        }}
        onPointerDown={startDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <DragIndicatorRoundedIcon fontSize="small" sx={{ color: alpha(theme.palette.common.white, 0.72) }} />
        <Typography
          variant="caption"
          sx={{
            marginInlineStart: 4,
            color: alpha(theme.palette.common.white, 0.9),
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
          noWrap
        >
          {peerName}
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: theme.palette.common.black,
        }}
      >
        {isVideoCall ? (
          <Box
            sx={{
              position: 'relative',
              height: '100%',
              overflow: 'hidden',
              bgcolor: theme.palette.common.black,
            }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: remoteVideoPlaying ? 'block' : 'none',
                backgroundColor: theme.palette.common.black,
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                right: 12,
                bottom: 72,
                width: { xs: 88, sm: 100 },
                height: { xs: 116, sm: 132 },
                borderRadius: 2.5,
                overflow: 'hidden',
                boxShadow: '0 10px 26px rgba(0,0,0,0.34)',
                border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
                bgcolor: alpha(theme.palette.common.black, 0.24),
                zIndex: 2,
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isCameraEnabled ? 'block' : 'none',
                }}
              />
              {!isCameraEnabled && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.common.black, 0.78),
                  }}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: alpha(theme.palette.common.white, 0.12),
                      color: theme.palette.common.white,
                      fontWeight: 800,
                    }}
                  >
                    {peerInitial}
                  </Avatar>
                </Box>
              )}
            </Box>

            {!remoteVideoPlaying && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.common.black, 0.9),
                }}
              >
                <Stack spacing={1} alignItems="center" sx={{ color: theme.palette.common.white, textAlign: 'center' }}>
                  <Avatar
                    sx={{
                      width: 46,
                      height: 46,
                      bgcolor: alpha(theme.palette.common.white, 0.12),
                      color: theme.palette.common.white,
                      fontWeight: 800,
                    }}
                  >
                    {peerInitial}
                  </Avatar>
                  <Typography variant="caption" sx={{ opacity: 0.84 }}>
                    {isConnected ? t('calls.waiting_for_video') : t('calls.connecting')}
                  </Typography>
                </Stack>
              </Box>
            )}

            <Box
              sx={{
                position: 'absolute',
                left: 12,
                top: 42,
                display: 'flex',
                gap: 0.75,
                flexWrap: 'wrap',
                zIndex: 2,
              }}
            >
              <Badge
                label={isConnected ? (remoteAudioPlaying ? t('calls.live') : t('calls.audio')) : t('calls.connecting')}
                tone={theme.palette.common.white}
                icon={isConnected ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
              />
              <Badge
                label={isCameraEnabled ? t('calls.camera_on') : t('calls.camera_off')}
                tone={theme.palette.common.white}
                icon={isCameraEnabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
              />
            </Box>

            {!isCameraEnabled && (
              <Box
                sx={{
                  position: 'absolute',
                  right: 12,
                  bottom: 72,
                  width: { xs: 88, sm: 100 },
                  height: { xs: 116, sm: 132 },
                  borderRadius: 2.5,
                  overflow: 'hidden',
                  boxShadow: '0 10px 26px rgba(0,0,0,0.34)',
                  bgcolor: alpha(theme.palette.common.black, 0.24),
                  zIndex: 2,
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.common.black, 0.78),
                  }}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: alpha(theme.palette.common.white, 0.12),
                      color: theme.palette.common.white,
                      fontWeight: 800,
                    }}
                  >
                    {localInitial}
                  </Avatar>
                </Box>
              </Box>
            )}

            {renderPipControls()}
          </Box>
        ) : (
          <Stack
            spacing={1.1}
            alignItems="center"
            justifyContent="center"
            sx={{ height: '100%', textAlign: 'center', color: theme.palette.common.white }}
          >
            <Avatar
              sx={{
                width: 58,
                height: 58,
                fontSize: 22,
                fontWeight: 800,
                bgcolor: alpha(theme.palette.common.white, 0.12),
                color: theme.palette.common.white,
              }}
            >
              {peerInitial}
            </Avatar>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
              {peerName}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.78 }}>
              {timerText || title}
            </Typography>
            {renderPipControls()}
          </Stack>
        )}
      </Box>
    </Box>
  )

  if (isPip) {
    return (
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 2100, pointerEvents: 'none' }}>
        {pipBody}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        display: 'grid',
        placeItems: 'center',
        px: 2,
        bgcolor: alpha(theme.palette.background.default, 0.78),
        backdropFilter: 'blur(18px)',
        backgroundImage: `radial-gradient(circle at top, ${alpha(theme.palette.primary.main, 0.12)}, transparent 40%), radial-gradient(circle at bottom, ${alpha(theme.palette.warning.main, 0.10)}, transparent 38%)`,
      }}
    >
      {modalBody}
    </Box>
  )
}
