import { useAppSelector } from '@/store/store'
import { Avatar, Box, Typography, List, ListItem, ListItemAvatar, ListItemText, Chip, Divider, alpha, useTheme } from '@mui/material'
import CallRoundedIcon from '@mui/icons-material/CallRounded'
import CallReceivedRoundedIcon from '@mui/icons-material/CallReceivedRounded'
import CallMadeRoundedIcon from '@mui/icons-material/CallMadeRounded'
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import { Card } from '@/components/Common'
import { useTranslation } from '@/themeMode'

export default function CallHistory() {
  const theme = useTheme()
  const callHistory = useAppSelector((state) => state.call.callHistory)
  const { t, locale } = useTranslation()
  const rowDirection = theme.direction === 'rtl' ? 'row-reverse' : 'row'

  const formatDuration = (startedAt?: number, endedAt?: number) => {
    if (!startedAt || !endedAt) return ''
    const duration = Math.floor((endedAt - startedAt) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleString(locale)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'missed':
        return <CallEndRoundedIcon sx={{ color: 'warning.main' }} />
      case 'ended':
        return <CallEndRoundedIcon sx={{ color: 'text.secondary' }} />
      case 'failed':
        return <CallEndRoundedIcon sx={{ color: 'error.main' }} />
      default:
        return <CallRoundedIcon sx={{ color: 'success.main' }} />
    }
  }

  const getDirectionIcon = (isIncoming: boolean) => {
    return isIncoming ? (
      <CallReceivedRoundedIcon sx={{ color: 'success.main' }} />
    ) : (
      <CallMadeRoundedIcon sx={{ color: 'primary.main' }} />
    )
  }

  return (
    <Card
      sx={{
        p: 2.5,
        bgcolor: alpha(theme.palette.background.paper, 0.9),
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        boxShadow: '0 18px 50px rgba(0,0,0,0.06)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexDirection: rowDirection }}>
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
          <CallRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t('comms.call_history')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {callHistory.length} {t('comms.completed_calls')}
          </Typography>
        </Box>
      </Box>

      {callHistory.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('comms.no_call_history')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('comms.your_completed_calls_will_appear_here')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <List>
            {callHistory.map((call: any, index: number) => (
              <div key={`${call.callId}-${call.startedAt}`}>
                <ListItem sx={{ py: 1.5 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {call.peer.name[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: rowDirection }}>
                        <Typography variant="subtitle2">
                          {call.peer.name}
                        </Typography>
                        {call.callType === 'video' && (
                          <VideocamRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        {getDirectionIcon(call.direction === 'incoming')}
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(call.endedAt) || t('comms.unknown_time')}
                        </Typography>
                        {call.startedAt && call.endedAt && (
                          <>
                            <Typography variant="caption" color="text.secondary">·</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDuration(call.startedAt, call.endedAt)}
                            </Typography>
                          </>
                        )}
                      </Box>
                    }
                  />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: rowDirection }}>
                    {getStatusIcon(call.status)}
                    <Chip
                      size="small"
                      label={call.status === 'missed' ? t('comms.missed') : call.direction === 'incoming' ? t('comms.incoming') : t('comms.outgoing')}
                      color={call.status === 'missed' ? 'warning' : call.status === 'ended' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                </ListItem>
                {index < callHistory.length - 1 && <Divider />}
              </div>
            ))}
          </List>
        </Box>
      )}
    </Card>
  )
}

