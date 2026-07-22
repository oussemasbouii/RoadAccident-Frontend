import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FileDropZone from '@/components/documents/FileDropZone'
import Button from '@/components/Common/Button'
import { getDocumentCategoryOptions } from '@/features/documents/documentCategoryOptions'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { fetchIncidents } from '@/features/incidents/slices/incidentsSlice'
import type { Incident } from '@/features/incidents/slices/incidentsSlice'
import { apiService } from '@/services/api'
import { putToPresignedUrl } from '../hooks/useDocumentUpload'
import { useTranslation } from '@/themeMode'
import type { DocumentCategory, DocumentOwnerType, GedDocument, VisibleToRole } from '@/types/document'
import { ACCEPTED_FILE_INPUT_ACCEPT, validateFile } from '@/utils/fileValidation'

type OwnerOption = { id: string; label: string }

const unwrapPayload = (payload: any) => payload?.data?.data ?? payload?.data ?? payload ?? {}

type Props = {
  open: boolean
  document: GedDocument | null
  onClose: () => void
  onSaved: () => void
}

// Exposes the same fields as creation (file name, note, Accident, category,
// permission, file) pre-filled with the document's current values. Saving
// re-runs OCR only when a new file is actually chosen — see documents.service.ts's
// updateDocument()/performFileReplace() for why a metadata-only edit doesn't
// need to re-extract text from an unchanged file.
export default function EditDocumentDialog({ open, document, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const categoryOptions = useMemo(() => getDocumentCategoryOptions(t), [t])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [ownerType, setOwnerType] = useState<DocumentOwnerType>('accident')
  const [ownerOption, setOwnerOption] = useState<OwnerOption | null>(null)
  // Remembers the last selection made for EACH owner type separately, so
  // toggling accident -> officer -> accident restores the original owner
  // instead of leaving the field empty. Explicitly re-seeded (both slots) on
  // every document load below — not just at mount — so switching to a
  // DIFFERENT document while the dialog stays mounted can't leak the
  // previous document's picks into the new one.
  const [lastAccidentOption, setLastAccidentOption] = useState<OwnerOption | null>(null)
  const [lastOfficerOption, setLastOfficerOption] = useState<OwnerOption | null>(null)
  const [officerOptions, setOfficerOptions] = useState<OwnerOption[]>([])
  const [officerQuery, setOfficerQuery] = useState('')
  const [officerLoading, setOfficerLoading] = useState(false)
  const [filename, setFilename] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [description, setDescription] = useState('')
  const [visibleToRole, setVisibleToRole] = useState<VisibleToRole>('officer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const incidents: Incident[] = useAppSelector((s) => s.incidents.list)
  const accidentOptions: OwnerOption[] = useMemo(
    () => incidents.map((inc) => ({ id: inc.id, label: `${inc.location} · ${inc.time} · #${inc.id.slice(0, 8)}` })),
    [incidents]
  )

  useEffect(() => {
    if (open && incidents.length === 0) {
      dispatch(fetchIncidents({ page: 1, limit: 200 }) as any)
    }
  }, [open, incidents.length, dispatch])

  // Pre-fill the form from the document being edited whenever it (re)opens.
  useEffect(() => {
    if (!open || !document) return
    setOwnerType(document.ownerType)
    setFilename(document.filename)
    setFile(null)
    setFileError(null)
    setCategories(document.categories)
    setDescription(document.description || '')
    setVisibleToRole(document.visibleToRole || 'officer')
    setError(null)

    if (document.ownerType === 'accident') {
      const match = incidents.find((inc) => inc.id === document.ownerId)
      const accidentOption = match
        ? { id: match.id, label: `${match.location} · ${match.time} · #${match.id.slice(0, 8)}` }
        : { id: document.ownerId, label: document.accidentReference || document.ownerId }
      setOwnerOption(accidentOption)
      // Seed BOTH slots explicitly (not just the matching one) so a previous
      // document's officer pick can't leak through when the dialog is reused
      // for a new document without unmounting.
      setLastAccidentOption(accidentOption)
      setLastOfficerOption(null)
    } else {
      const officerOption = { id: document.ownerId, label: document.ownerId }
      setOwnerOption(officerOption)
      setLastOfficerOption(officerOption)
      setLastAccidentOption(null)
      apiService.users
        .getById(document.ownerId)
        .then((resp) => {
          const raw = unwrapPayload(resp)
          const name = [raw?.firstName, raw?.lastName].filter(Boolean).join(' ') || raw?.displayName
          if (name) {
            const resolved = { id: document.ownerId, label: `${name}${raw?.officerId ? ` (#${raw.officerId})` : ''}` }
            setOwnerOption(resolved)
            // The toggle handler restores whatever is in this slot, so it must
            // reflect the resolved name too — otherwise toggling away and back
            // after this resolves would show the stale id-only label again.
            setLastOfficerOption(resolved)
          }
        })
        .catch(() => {
          // Keep the id-only fallback label if the lookup fails.
        })
    }
    // Only re-run when a different document is opened, not on every incidents-list refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, document?.id])

  useEffect(() => {
    if (!open || ownerType !== 'officer') return
    let cancelled = false
    setOfficerLoading(true)
    apiService.users
      .list({ search: officerQuery.trim() || undefined, page: 1, limit: 50 })
      .then((resp) => {
        if (cancelled) return
        const raw = resp.data?.data ?? resp.data?.items ?? resp.data?.rows ?? resp.data?.users ?? resp.data
        const rows = Array.isArray(raw) ? raw : []
        setOfficerOptions(
          rows.map((row: any) => {
            const id = String(row.id ?? row._id ?? row.officerId ?? '')
            const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.displayName || row.name || row.officerId || id
            return { id, label: `${name}${row.officerId ? ` (#${row.officerId})` : ''}` }
          })
        )
      })
      .finally(() => {
        if (!cancelled) setOfficerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ownerType, officerQuery])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const canSubmit = Boolean(document && ownerOption?.id && filename.trim() && categories.length > 0 && !saving)

  const handleSubmit = async () => {
    if (!document || !ownerOption?.id || !filename.trim() || categories.length === 0) return
    setSaving(true)
    setError(null)
    try {
      let filePayload: { key: string; mimeType: string; size: number } | undefined
      if (file) {
        const requestResp = await apiService.documents.requestUpload({
          ownerType,
          ownerId: ownerOption.id,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          categories,
        })
        const requestData = unwrapPayload(requestResp.data)
        if (!requestData.uploadUrl || !requestData.key) throw new Error('Upload URL missing')
        await putToPresignedUrl(requestData.uploadUrl, file)
        filePayload = { key: requestData.key, mimeType: file.type || 'application/octet-stream', size: file.size }
      }

      await apiService.documents.update(document.id, {
        filename: filename.trim(),
        description: description.trim(),
        categories,
        visibleToRole,
        ownerType,
        ownerId: ownerOption.id,
        file: filePayload,
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('documents.edit_failed'))
    } finally {
      setSaving(false)
    }
  }

  const ownerOptions = ownerType === 'accident' ? accidentOptions : officerOptions

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{t('documents.edit_document')}</Typography>
        <IconButton onClick={handleClose} size="small" disabled={saving}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          <TextField
            size="small"
            label={t('documents.file_name')}
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />

          <ToggleButtonGroup
            exclusive
            size="small"
            value={ownerType}
            onChange={(_, value) => {
              if (!value) return
              setOwnerType(value)
              setOwnerOption(value === 'accident' ? lastAccidentOption : lastOfficerOption)
            }}
          >
            <ToggleButton value="accident">{t('documents.owner_accident')}</ToggleButton>
            <ToggleButton value="officer">{t('documents.owner_officer')}</ToggleButton>
          </ToggleButtonGroup>

          <Autocomplete
            options={ownerOptions}
            loading={ownerType === 'officer' && officerLoading}
            value={ownerOption}
            onChange={(_, value) => {
              setOwnerOption(value)
              if (ownerType === 'accident') setLastAccidentOption(value)
              else setLastOfficerOption(value)
            }}
            onInputChange={(_, value) => {
              if (ownerType === 'officer') setOfficerQuery(value)
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label={ownerType === 'accident' ? t('documents.select_accident') : t('documents.select_officer')}
              />
            )}
          />

          <Select
            multiple
            size="small"
            displayEmpty
            inputProps={{ 'aria-label': t('documents.category') }}
            value={categories}
            onChange={(e) => setCategories(typeof e.target.value === 'string' ? (e.target.value.split(',') as DocumentCategory[]) : (e.target.value as DocumentCategory[]))}
            renderValue={(selected) =>
              selected.length === 0 ? (
                <Typography color="text.disabled">{t('documents.category')}</Typography>
              ) : (
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} size="small" label={categoryOptions.find((o) => o.value === value)?.label ?? value} />
                  ))}
                </Stack>
              )
            }
          >
            {categoryOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </Select>

          <TextField
            size="small"
            label={t('documents.note')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />

          <TextField
            select
            size="small"
            label={t('documents.col_permission')}
            value={visibleToRole}
            onChange={(e) => setVisibleToRole(e.target.value as VisibleToRole)}
          >
            <MenuItem value="officer">{t('documents.permission_all')}</MenuItem>
            <MenuItem value="supervisor">{t('admin_accounts.role_supervisor')}</MenuItem>
            <MenuItem value="admin">{t('admin_accounts.role_admin')}</MenuItem>
          </TextField>

          <Typography variant="caption" color="text.secondary">
            {t('documents.replace_file_optional')}
          </Typography>
          {fileError && <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setFileError(null)}>{fileError}</Alert>}
          <FileDropZone
            canInteract={!saving}
            uploading={saving}
            onClick={() => fileInputRef.current?.click()}
            onFilesDropped={(dropped) => {
              const picked = Array.from(dropped)[0]
              if (!picked) return
              const result = validateFile(picked, t)
              if (!result.ok) {
                setFileError(result.message)
                return
              }
              setFileError(null)
              setFile(picked)
              setFilename(picked.name)
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
              if (!picked) return
              const result = validateFile(picked, t)
              if (!result.ok) {
                setFileError(result.message)
                return
              }
              setFileError(null)
              setFile(picked)
              setFilename(picked.name)
            }}
          />
          {file && (
            <Typography variant="caption" color="text.secondary">
              {file.name}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="secondary" size="sm" onClick={handleClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={() => void handleSubmit()} loading={saving} disabled={!canSubmit}>
          {t('documents.save_changes')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
