import { Avatar, Box, Chip, Divider, Stack, Typography, alpha, useTheme } from '@mui/material'
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import MicRoundedIcon from '@mui/icons-material/MicRounded'
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'
import { useAppSelector } from '@/store/store'
import { Button } from '@/components/Common'
import { useCallTimer } from '@/hooks/useCallTimer'
import type { CallPeer, CallStatus } from '@/types/call'

type Props = {
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
  isMuted?: boolean
  onToggleMute?: () => void
  isConnected?: boolean
  remoteAudioPlaying?: boolean
  connectionError?: string | null
}

const STATUS_LABELS: Record<CallStatus, string> = {
  idle: '',
  outgoing: 'Calling',
  ringing: 'Incoming call',
  in_call: 'Connected',
  answered: 'Connected',
  missed: 'Missed call',
  ended: 'Call ended',
  failed: 'Call failed',
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

function formatRole(value?: string | null) {
  const role = (value || 'Officer').trim()
  if (!role) return 'Officer'
  if (/^office?r?$/i.test(role)) return 'Officer'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function resolvePeerName(peer: CallPeer) {
  if (peer.name && !isUuidLike(peer.name)) return peer.name
  if (peer.officerId && !isUuidLike(peer.officerId)) return peer.officerId
  if (peer.officerId) return `Officer ${shortIdentifier(peer.officerId)}`
  return 'Officer'
}

function resolvePeerMeta(peer: CallPeer) {
  const role = formatRole(peer.role)
  const officerId = peer.officerId || peer.id
  if (!officerId) return role
  if (isUuidLike(officerId)) return `ID ${shortIdentifier(officerId)} - ${role}`
  return `${officerId} - ${role}`
}

export default function CallOverlay({
  onAccept,
  onReject,
  onEnd,
  isMuted = false,
  onToggleMute,
  isConnected = false,
  remoteAudioPlaying = false,
  connectionError = null,
}: Props) {
  const theme = useTheme()
  const call = useAppSelector((state) => state.call.activeCall)

  const isIncoming = call?.status === 'ringing'
  const isOutgoing = call?.status === 'outgoing'
  const isActive = call?.status === 'in_call'
  const showActions = isIncoming || isOutgoing || isActive
  const peerName = call ? resolvePeerName(call.peer) : ''
  const peerMeta = call ? resolvePeerMeta(call.peer) : ''
  const statusTone = isIncoming
    ? theme.palette.warning.main
    : isActive
      ? theme.palette.success.main
      : theme.palette.primary.main

  const { formatted: timerText } = useCallTimer(isActive ? call?.startedAt : undefined)

  if (!call || call.status === 'idle') return null

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        bgcolor: alpha(theme.palette.background.default, 0.82),
        backdropFilter: 'blur(18px)',
        backgroundImage: `radial-gradient(circle at top, ${alpha(theme.palette.primary.main, 0.14)}, transparent 40%), radial-gradient(circle at bottom, ${alpha(theme.palette.warning.main, 0.12)}, transparent 38%)`,
      }}
    >
      <Box
        sx={{
          width: { xs: '100%', sm: 500 },
          maxWidth: '100%',
          borderRadius: 5,
          p: { xs: 2.25, sm: 3 },
          bgcolor: alpha(theme.palette.background.paper, 0.98),
          boxShadow: '0 30px 90px rgba(0,0,0,0.28)',
          border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 5,
            background: `linear-gradient(135deg, ${alpha(statusTone, 0.18)}, transparent 42%)`,
          },
        }}
      >
        <Stack spacing={2.2} alignItems="center" sx={{ position: 'relative' }}>
          <Box
            sx={{
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Chip
              size="small"
              label={STATUS_LABELS[call.status as CallStatus]}
              sx={{
                fontWeight: 700,
                letterSpacing: 0.4,
                bgcolor: alpha(statusTone, 0.14),
                color: statusTone,
                border: `1px solid ${alpha(statusTone, 0.25)}`,
              }}
            />
            <Chip
              size="small"
              label={call.callType === 'video' ? 'Video' : 'Audio'}
              icon={call.callType === 'video' ? <VideocamRoundedIcon /> : <PhoneInTalkRoundedIcon />}
              variant="outlined"
            />
          </Box>

          <Avatar
            sx={{
              width: 92,
              height: 92,
              fontSize: 34,
              fontWeight: 800,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              boxShadow: `0 0 0 10px ${alpha(statusTone, 0.08)}`,
              animation: isIncoming ? 'avatarPulse 1.4s ease-in-out infinite' : 'none',
              '@keyframes avatarPulse': {
                '0%, 100%': { boxShadow: `0 0 0 10px ${alpha(statusTone, 0.08)}` },
                '50%': { boxShadow: `0 0 0 18px ${alpha(statusTone, 0)}` },
              },
            }}
          >
            {(peerName[0] || 'O').toUpperCase()}
          </Avatar>

          <Stack spacing={0.5} alignItems="center" sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {peerName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {peerMeta}
            </Typography>
          </Stack>

          <Box
            sx={{
              px: 2,
              py: 1,
              borderRadius: 999,
              bgcolor: alpha(statusTone, 0.12),
              color: statusTone,
              border: `1px solid ${alpha(statusTone, 0.18)}`,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              {isIncoming
                ? 'Incoming call - answer to connect'
                : isOutgoing
                  ? 'Calling... waiting for answer'
                  : 'Call connected'}
            </Typography>
          </Box>

          {isActive && (
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: theme.palette.success.main,
                letterSpacing: 1,
              }}
            >
              {timerText}
            </Typography>
          )}

          {isActive && connectionError && (
            <Box
              sx={{
                width: '100%',
                p: 1.5,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
                bgcolor: alpha(theme.palette.error.main, 0.08),
              }}
            >
              <Stack spacing={0.5} alignItems="center" sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: theme.palette.error.main }}>
                  Media server unavailable
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {connectionError}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  End the call and check the LiveKit server URL or proxy config.
                </Typography>
              </Stack>
            </Box>
          )}

          <Divider flexItem sx={{ opacity: 0.5 }} />

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {isActive && (
              <Chip
                icon={isConnected ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
                label={isConnected ? (remoteAudioPlaying ? 'Voice live' : 'Connecting audio') : 'No connection'}
                color={isConnected && remoteAudioPlaying ? 'success' : 'default'}
                variant="outlined"
              />
            )}
            {isActive && (
              <Chip
                icon={isMuted ? <MicOffRoundedIcon /> : <MicRoundedIcon />}
                label={isMuted ? 'Muted' : 'Mic on'}
                color={isMuted ? 'warning' : 'default'}
                variant="outlined"
              />
            )}
            {isActive && connectionError && (
              <Chip
                label="Audio unavailable"
                color="error"
                variant="outlined"
              />
            )}
          </Stack>

          {showActions && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.2}
              sx={{ width: '100%', pt: 0.5 }}
            >
              {isIncoming && (
                <>
                  <Button
                    size="lg"
                    icon={<PhoneInTalkRoundedIcon fontSize="small" />}
                    onClick={onAccept}
                    style={{
                      flex: 1,
                      background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                      color: theme.palette.success.contrastText,
                      boxShadow: '0 12px 30px rgba(46, 125, 50, 0.28)',
                    }}
                  >
                    Answer
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    icon={<CallEndRoundedIcon fontSize="small" />}
                    onClick={onReject}
                    style={{
                      flex: 1,
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
              {isOutgoing && (
                <Button
                  size="lg"
                  variant="secondary"
                  icon={<CallEndRoundedIcon fontSize="small" />}
                  onClick={onEnd}
                  style={{ width: '100%' }}
                >
                  Cancel
                </Button>
              )}
              {isActive && (
                <>
                <Button
                  size="lg"
                  icon={isMuted ? <MicRoundedIcon fontSize="small" /> : <MicOffRoundedIcon fontSize="small" />}
                  onClick={onToggleMute}
                  variant={isMuted ? 'primary' : 'secondary'}
                  disabled={!isConnected || Boolean(connectionError)}
                  style={{ flex: 1 }}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    icon={<CallEndRoundedIcon fontSize="small" />}
                    onClick={onEnd}
                    style={{ flex: 1 }}
                  >
                    End call
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  )
}
