import { Box, Chip, Divider, IconButton, Stack, TextField, Tooltip, Typography, alpha, useTheme } from '@mui/material'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import CallRoundedIcon from '@mui/icons-material/CallRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import MinimizeRoundedIcon from '@mui/icons-material/MinimizeRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import DoneRoundedIcon from '@mui/icons-material/DoneRounded'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { Button } from '@/components/Common'
import AttachmentLightbox from '@/components/AttachmentLightbox'
import type { ChatContact, ChatMessage } from '@/types/chat'
import { useChatComposer } from '@/features/communications/hooks/useChatComposer'

type ChatWindowProps = {
  peer: ChatContact
  messages: ChatMessage[]
  currentUserId: string | null
  isMinimized: boolean
  typing: boolean
  onMinimize: () => void
  onClose: () => void
  onFocus: () => void
  onCall: () => void
}

const QUICK_REPLIES = ['On my way', 'Need backup', 'ETA 5 min', 'Scene secured', 'Call me']

export default function ChatWindow({
  peer,
  messages,
  currentUserId,
  isMinimized,
  typing,
  onMinimize,
  onClose,
  onFocus,
  onCall,
}: ChatWindowProps) {
  const theme = useTheme()
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
        transition: 'height 0.2s ease',
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
          <Tooltip title="Call">
            <IconButton
              size="small"
              onClick={onCall}
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
        </Stack>
      </Stack>

      {!isMinimized && (
        <>
          <Divider />
          <Stack spacing={1.5} sx={{ p: 1.6, flex: 1, overflowY: 'auto' }}>
            {messages.map((message) => {
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
                <Box key={message.id} sx={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <Box
                    sx={{
                      p: 1.1,
                      borderRadius: 2.2,
                      bgcolor: isMe ? theme.palette.primary.main : alpha(theme.palette.action.active, 0.06),
                      color: isMe ? theme.palette.primary.contrastText : 'text.primary',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {message.attachment ? (
                      <Stack spacing={0.6}>
                        {attachmentUrls[message.attachment.id] ? (
                          <Box
                            component="img"
                            src={attachmentUrls[message.attachment.id]}
                            alt={message.attachment.filename}
                            sx={{
                              width: 200,
                              maxWidth: '100%',
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                              cursor: 'pointer',
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
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.4 }}>
                    <Typography variant="caption" color="text.secondary">
                      {message.timestamp}
                    </Typography>
                    {isMe && statusIcon}
                  </Stack>
                </Box>
              )
            })}
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
              }}
            >
              Typing...
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

      <AttachmentLightbox lightbox={lightbox} onClose={() => setLightbox(null)} onDownload={handleDownloadImage} />
    </Box>
  )
}
