import { Box, Dialog, DialogActions, DialogContent, IconButton, Stack, Typography, alpha, useTheme } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import { Button } from '@/components/Common'

type LightboxState = {
  url: string
  filename: string
}

type AttachmentLightboxProps = {
  lightbox: LightboxState | null
  onClose: () => void
  onDownload: () => void
}

export default function AttachmentLightbox({ lightbox, onClose, onDownload }: AttachmentLightboxProps) {
  const theme = useTheme()
  return (
    <Dialog
      open={Boolean(lightbox)}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(10, 14, 22, 0.72)',
          backdropFilter: 'blur(4px)',
        },
      }}
      PaperProps={{
        sx: {
          bgcolor: alpha(theme.palette.background.paper, 0.98),
          borderRadius: 4,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2.5,
          py: 1.8,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.08)}, transparent)`,
        }}
      >
        <Typography sx={{ fontWeight: 700 }} noWrap>
          {lightbox?.filename}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
      <DialogContent sx={{ pt: 2.5 }}>
        {lightbox && (
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.action.active, 0.06),
              border: `1px dashed ${alpha(theme.palette.divider, 0.6)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={lightbox.url}
              alt={lightbox.filename}
              sx={{
                width: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                boxShadow: '0 14px 36px rgba(0,0,0,0.18)',
                bgcolor: theme.palette.background.paper,
              }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.2, pt: 0.5 }}>
        <Button icon={<DownloadRoundedIcon fontSize="small" />} onClick={onDownload}>
          Download
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
