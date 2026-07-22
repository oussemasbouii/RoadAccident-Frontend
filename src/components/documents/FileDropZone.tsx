import { useState } from 'react'
import { Box, Button, LinearProgress, Paper, Stack, Typography, alpha, useTheme } from '@mui/material'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useTranslation } from '@/themeMode'
import { MAX_FILE_SIZE_BYTES } from '@/utils/fileValidation'

type Props = {
  canInteract: boolean
  uploading?: boolean
  onClick: () => void
  onFilesDropped: (files: FileList | File[]) => void
}

export default function FileDropZone({ canInteract, uploading = false, onClick, onFilesDropped }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  // Active drag-over state drives the highlight + subtle scale so users get a
  // clear "drop here" affordance while dragging.
  const [dragActive, setDragActive] = useState(false)

  const activate = () => {
    if (canInteract) onClick()
  }

  return (
    <Paper
      variant="outlined"
      // Keyboard-operable: the zone itself is a button, so Tab reaches it and
      // Enter/Space open the picker (the inner Button is decorative here).
      role="button"
      tabIndex={canInteract ? 0 : -1}
      aria-label={t('documents.drop_files_here')}
      aria-disabled={!canInteract}
      onClick={activate}
      onKeyDown={(event) => {
        if (!canInteract) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      onDragOver={(event) => {
        if (!canInteract) return
        event.preventDefault()
        if (!dragActive) setDragActive(true)
      }}
      onDragLeave={(event) => {
        // Only clear when the pointer actually leaves the zone, not when moving
        // over a child element.
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDragActive(false)
      }}
      onDrop={(event) => {
        if (!canInteract) return
        event.preventDefault()
        setDragActive(false)
        const dropped = event.dataTransfer.files
        if (dropped?.length) onFilesDropped(dropped)
      }}
      sx={{
        p: 2,
        borderRadius: 3,
        cursor: canInteract ? 'pointer' : 'not-allowed',
        borderStyle: 'dashed',
        borderWidth: dragActive ? 2 : 1,
        outline: 'none',
        borderColor: dragActive
          ? theme.palette.primary.main
          : canInteract
            ? alpha(theme.palette.primary.main, 0.4)
            : alpha(theme.palette.divider, 0.7),
        bgcolor: dragActive
          ? alpha(theme.palette.primary.main, 0.1)
          : canInteract
            ? alpha(theme.palette.primary.main, 0.04)
            : alpha(theme.palette.action.disabledBackground, 0.35),
        transform: dragActive ? 'scale(1.01)' : 'none',
        transition: 'all 0.18s ease',
        '&:hover': canInteract
          ? {
              borderColor: alpha(theme.palette.primary.main, 0.65),
              bgcolor: alpha(theme.palette.primary.main, 0.06),
            }
          : {},
        '&:focus-visible': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}`,
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.primary.main, dragActive ? 0.2 : 0.12),
            color: theme.palette.primary.main,
          }}
        >
          <AttachFileRoundedIcon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>{t('documents.drop_files_here')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('documents.upload_hint').replace('{size}', String(MAX_FILE_SIZE_BYTES / 1024 / 1024))}
          </Typography>
        </Box>
        {/* Decorative — activation is handled by the zone itself; keep it out of
            the tab order and hidden from AT to avoid a duplicate control. */}
        <Button
          size="small"
          variant="outlined"
          disabled={!canInteract}
          startIcon={<UploadFileRoundedIcon />}
          tabIndex={-1}
          aria-hidden
          sx={{ pointerEvents: 'none' }}
        >
          {t('documents.choose_files')}
        </Button>
      </Stack>
      {uploading && (
        <Box sx={{ mt: 1.5 }}>
          <LinearProgress />
        </Box>
      )}
    </Paper>
  )
}
