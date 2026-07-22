import { useEffect, useState } from 'react'
import { Avatar, Box, Chip, Divider, List, ListItem, ListItemAvatar, ListItemText, Typography, alpha, useTheme } from '@mui/material'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import { apiService } from '@/services/api'
import { useTranslation } from '@/themeMode'
import type { DocumentAuditAction, DocumentAuditEvent } from '@/types/document'

const ACTION_ICON: Record<DocumentAuditAction, JSX.Element> = {
  uploaded: <UploadFileRoundedIcon fontSize="small" />,
  replaced: <RefreshRoundedIcon fontSize="small" />,
  archived: <ArchiveRoundedIcon fontSize="small" />,
  restored: <RestoreRoundedIcon fontSize="small" />,
  restricted_changed: <LockRoundedIcon fontSize="small" />,
  downloaded: <DownloadRoundedIcon fontSize="small" />,
  ocr_completed: <CheckCircleRoundedIcon fontSize="small" />,
  ocr_failed: <ErrorOutlineRoundedIcon fontSize="small" />,
  edited: <EditRoundedIcon fontSize="small" />,
  version_deleted: <DeleteForeverRoundedIcon fontSize="small" />,
  tagged: <LocalOfferRoundedIcon fontSize="small" />,
  ocr_language_retry: <TranslateRoundedIcon fontSize="small" />,
  ocr_retry: <AutorenewRoundedIcon fontSize="small" />,
}

const ACTION_COLOR: Record<DocumentAuditAction, 'primary' | 'info' | 'warning' | 'success' | 'error' | 'default'> = {
  uploaded: 'primary',
  replaced: 'info',
  archived: 'warning',
  restored: 'success',
  restricted_changed: 'warning',
  downloaded: 'default',
  ocr_completed: 'success',
  ocr_failed: 'error',
  edited: 'info',
  version_deleted: 'error',
  tagged: 'default',
  ocr_language_retry: 'info',
  ocr_retry: 'info',
}

type Props = { documentId: string }

export default function DocumentAuditTrail({ documentId }: Props) {
  const theme = useTheme()
  const { t, locale } = useTranslation()
  const [events, setEvents] = useState<DocumentAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiService.documents
      .getAuditLog(documentId)
      .then((response) => {
        if (cancelled) return
        const payload = response.data?.data ?? response.data ?? []
        setEvents(Array.isArray(payload) ? payload : [])
      })
      .catch((err) => {
        if (cancelled) return
        const message = err?.response?.data?.message || err?.message || t('documents.audit_unavailable')
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [documentId, t])

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <HistoryRoundedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">{t('documents.audit_unavailable')}</Typography>
      </Box>
    )
  }

  if (events.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <HistoryRoundedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">{t('documents.no_audit_events')}</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
      <List disablePadding>
        {events.map((event, index) => {
          const colorKey = ACTION_COLOR[event.action]
          const paletteKey = colorKey === 'default' ? 'primary' : colorKey
          return (
          <Box key={event.id}>
            <ListItem sx={{ py: 1.25, px: 0 }}>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: alpha(theme.palette[paletteKey].main, 0.12), color: colorKey === 'default' ? 'text.secondary' : `${paletteKey}.main` }}>
                  {ACTION_ICON[event.action] ?? <HistoryRoundedIcon fontSize="small" />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Chip
                    size="small"
                    label={t(`documents.audit_action_${event.action}`)}
                    color={ACTION_COLOR[event.action]}
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                }
                secondary={
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {event.actorName || t('documents.unknown_actor')} · {new Date(event.timestamp).toLocaleString(locale)}
                    {event.note ? ` · ${event.note}` : ''}
                  </Typography>
                }
              />
            </ListItem>
            {index < events.length - 1 && <Divider />}
          </Box>
          )
        })}
      </List>
    </Box>
  )
}
