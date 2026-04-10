import { Avatar, Box, Chip, Stack, Typography, alpha, useTheme } from '@mui/material'
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import MicRoundedIcon from '@mui/icons-material/MicRounded'
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded'
import { useAppSelector } from '@/store/store'
import { Button } from '@/components/Common'
import type { CallStatus } from '@/types/call'

type Props = {
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
}

const STATUS_LABELS: Record<CallStatus, string> = {
  idle: '',
  outgoing: 'Calling…',
  ringing: 'Incoming call',
  in_call: 'Connected',
  ended: 'Call ended',
  failed: 'Call failed',
}

export default function CallOverlay({ onAccept, onReject, onEnd }: Props) {
  const theme = useTheme()
  const call = useAppSelector((state) => state.call.activeCall)

  if (!call || call.status === 'idle') return null

  const isIncoming = call.status === 'ringing'
  const isOutgoing = call.status === 'outgoing'
  const isActive = call.status === 'in_call'
  const showActions = isIncoming || isOutgoing || isActive

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(theme.palette.background.default, 0.85),
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box
        sx={{
          width: { xs: '90%', sm: 460 },
          borderRadius: 4,
          p: 3,
          bgcolor: 'background.paper',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Avatar
            sx={{
              width: 84,
              height: 84,
              fontSize: 32,
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              color: theme.palette.primary.main,
              boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.08)}`,
            }}
          >
            {call.peer.name[0]}
          </Avatar>
          <Stack spacing={0.5} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {call.peer.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {call.peer.officerId} · {call.peer.role || 'Officer'}
            </Typography>
            <Chip
              size="small"
              label={STATUS_LABELS[call.status]}
              color={isIncoming ? 'warning' : isActive ? 'success' : 'primary'}
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <Chip
              icon={call.callType === 'video' ? <VideocamRoundedIcon /> : <PhoneInTalkRoundedIcon />}
              label={call.callType === 'video' ? 'Video call' : 'Audio call'}
              variant="outlined"
            />
            <Chip icon={<MicRoundedIcon />} label="Mic on" variant="outlined" />
          </Stack>

          {showActions && (
            <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
              {isIncoming && (
                <>
                  <Button
                    size="lg"
                    icon={<PhoneInTalkRoundedIcon fontSize="small" />}
                    onClick={onAccept}
                  >
                    Accept
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    icon={<CallEndRoundedIcon fontSize="small" />}
                    onClick={onReject}
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
                >
                  Cancel
                </Button>
              )}
              {isActive && (
                <>
                  <Button size="lg" icon={<MicOffRoundedIcon fontSize="small" />}>
                    Mute
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    icon={<CallEndRoundedIcon fontSize="small" />}
                    onClick={onEnd}
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
