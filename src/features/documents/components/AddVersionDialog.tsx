import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FileDropZone from '@/components/documents/FileDropZone'
import Button from '@/components/Common/Button'
import { apiService } from '@/services/api'
import { putToPresignedUrl } from '../hooks/useDocumentUpload'
import { useTranslation } from '@/themeMode'
import type { GedDocument } from '@/types/document'
import { ACCEPTED_FILE_INPUT_ACCEPT, validateFile } from '@/utils/fileValidation'

type Props = {
  open: boolean
  document: GedDocument | null
  onClose: () => void
  onSaved: () => void
}

const unwrapPayload = (payload: any) => payload?.data?.data ?? payload?.data ?? payload ?? {}

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

// Sub-task 11.a: a dedicated, narrower form than Edit — just a change note
// and the new file — with an explicit extension-mismatch confirmation step
// before the upload is allowed to proceed.
export default function AddVersionDialog({ open, document, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [mismatchConfirmed, setMismatchConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNote('')
    setFile(null)
    setFileError(null)
    setMismatchConfirmed(false)
    setError(null)
  }, [open, document?.id])

  const previousExt = document ? extensionOf(document.filename) : ''
  const newExt = file ? extensionOf(file.name) : ''
  const extensionMismatch = Boolean(file && previousExt && newExt && previousExt !== newExt)
  const needsConfirmation = extensionMismatch && !mismatchConfirmed

  const acceptFile = (picked: File) => {
    const result = validateFile(picked, t)
    if (!result.ok) {
      setFileError(result.message)
      return
    }
    setFileError(null)
    setMismatchConfirmed(false)
    setFile(picked)
  }

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const canSubmit = Boolean(document && file && !needsConfirmation && !saving)

  const handleSubmit = async () => {
    if (!document || !file || needsConfirmation) return
    setSaving(true)
    setError(null)
    try {
      const requestResp = await apiService.documents.requestUpload({
        ownerType: document.ownerType,
        ownerId: document.ownerId,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        categories: document.categories,
      })
      const requestData = unwrapPayload(requestResp.data)
      if (!requestData.uploadUrl || !requestData.key) throw new Error('Upload URL missing')

      await putToPresignedUrl(requestData.uploadUrl, file)

      await apiService.documents.addVersion(document.id, {
        key: requestData.key,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        note: note.trim() || undefined,
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('documents.add_version_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{t('documents.add_version')}</Typography>
        <IconButton onClick={handleClose} size="small" disabled={saving}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
          {fileError && <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setFileError(null)}>{fileError}</Alert>}

          <TextField
            size="small"
            label={t('documents.version_note')}
            placeholder={t('documents.version_note_placeholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
          />

          <FileDropZone
            canInteract={!saving}
            uploading={saving}
            onClick={() => fileInputRef.current?.click()}
            onFilesDropped={(dropped) => {
              const picked = Array.from(dropped)[0]
              if (picked) acceptFile(picked)
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_INPUT_ACCEPT}
            hidden
            onChange={(event) => {
              const picked = event.target.files?.[0]
              event.target.value = ''
              if (picked) acceptFile(picked)
            }}
          />
          {file && (
            <Typography variant="caption" color="text.secondary">
              {file.name}
            </Typography>
          )}

          {needsConfirmation && (
            <Alert
              severity="warning"
              sx={{ borderRadius: 2 }}
              action={
                <Stack direction="row" spacing={1}>
                  <Button variant="secondary" size="sm" onClick={() => setFile(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setMismatchConfirmed(true)}>
                    {t('documents.proceed_anyway')}
                  </Button>
                </Stack>
              }
            >
              {t('documents.extension_mismatch_warning').replace('{previous}', previousExt).replace('{next}', newExt)}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="secondary" size="sm" onClick={handleClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={() => void handleSubmit()} loading={saving} disabled={!canSubmit}>
          {t('documents.add_version')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
