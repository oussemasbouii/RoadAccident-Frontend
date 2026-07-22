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
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import FileDropZone from '@/components/documents/FileDropZone'
import Button from '@/components/Common/Button'
import { getDocumentCategoryOptions } from '@/features/documents/documentCategoryOptions'
import toast from 'react-hot-toast'
import { useDocumentUpload, UploadCancelledError } from '../hooks/useDocumentUpload'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { fetchIncidents } from '@/features/incidents/slices/incidentsSlice'
import type { Incident } from '@/features/incidents/slices/incidentsSlice'
import { apiService } from '@/services/api'
import { useTranslation } from '@/themeMode'
import type { DocumentCategory, DocumentLanguage, DocumentOwnerType, VisibleToRole } from '@/types/document'
import { ACCEPTED_FILE_INPUT_ACCEPT, validateFile } from '@/utils/fileValidation'

type OwnerOption = { id: string; label: string }

// Categories that default a document to admin-only visibility unless the
// uploader changes it — legal/financial documents tend to be sensitive.
const ADMIN_TIER_BY_DEFAULT: DocumentCategory[] = ['legal', 'financial']

const normalizeTags = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean)

// Not File.name alone — two different files can share a name (e.g. two
// photos both named "IMG_0001.jpg" picked from different folders).
const fileKey = (file: File) => `${file.name}__${file.size}__${file.lastModified}`

type Props = {
  open: boolean
  onClose: () => void
  onUploaded: () => void
}

export default function UploadDocumentDialog({ open, onClose, onUploaded }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const categoryOptions = useMemo(() => getDocumentCategoryOptions(t), [t])
  const { uploadDocument, uploading, error, setError } = useDocumentUpload()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [ownerType, setOwnerType] = useState<DocumentOwnerType>('accident')
  const [ownerOption, setOwnerOption] = useState<OwnerOption | null>(null)
  // Remembers the last selection made for EACH owner type separately, so
  // toggling accident -> officer -> accident restores the original accident
  // instead of leaving the field empty (previously the toggle unconditionally
  // nulled the single shared `ownerOption` slot).
  const [lastAccidentOption, setLastAccidentOption] = useState<OwnerOption | null>(null)
  const [lastOfficerOption, setLastOfficerOption] = useState<OwnerOption | null>(null)
  const [officerOptions, setOfficerOptions] = useState<OwnerOption[]>([])
  const [officerQuery, setOfficerQuery] = useState('')
  const [officerLoading, setOfficerLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})
  const [fileProgress, setFileProgress] = useState<Record<string, number>>({})
  const abortRef = useRef<AbortController | null>(null)
  const [rejectedFiles, setRejectedFiles] = useState<{ name: string; message: string }[]>([])
  const [filenameOverride, setFilenameOverride] = useState('')
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [language, setLanguage] = useState<DocumentLanguage>('fra')
  const [visibleToRole, setVisibleToRole] = useState<VisibleToRole>('officer')
  const [visibleToRoleTouched, setVisibleToRoleTouched] = useState(false)

  const incidents: Incident[] = useAppSelector((s) => s.incidents.list)
  const accidentOptions: OwnerOption[] = useMemo(
    () => incidents.map((inc) => ({ id: inc.id, label: `${inc.location} · ${inc.time} · #${inc.id.slice(0, 8)}` })),
    [incidents]
  )

  useEffect(() => {
    if (open && ownerType === 'accident' && incidents.length === 0) {
      dispatch(fetchIncidents({ page: 1, limit: 200 }) as any)
    }
  }, [open, ownerType, incidents.length, dispatch])

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

  useEffect(() => {
    if (!visibleToRoleTouched) {
      setVisibleToRole(categories.some((c) => ADMIN_TIER_BY_DEFAULT.includes(c)) ? 'admin' : 'officer')
    }
  }, [categories, visibleToRoleTouched])

  // The filename field only makes sense for a single file — auto-fill it
  // from that file's name, and clear it back to "follow the file" whenever
  // the batch stops being exactly one file.
  useEffect(() => {
    if (files.length === 1) setFilenameOverride(files[0].name)
    else setFilenameOverride('')
  }, [files])

  const resetForm = () => {
    setOwnerType('accident')
    setOwnerOption(null)
    setLastAccidentOption(null)
    setLastOfficerOption(null)
    setFiles([])
    setFileErrors({})
    setRejectedFiles([])
    setFilenameOverride('')
    setCategories([])
    setDescription('')
    setTags('')
    setLanguage('fra')
    setVisibleToRole('officer')
    setVisibleToRoleTouched(false)
    setError(null)
  }

  const handleClose = () => {
    if (uploading) return
    resetForm()
    onClose()
  }

  // Appends rather than replaces, so dragging in a second batch doesn't
  // discard files already picked — dedupes by name+size+lastModified in
  // case the same file gets dropped twice. Anything that fails extension or
  // size validation never enters `files` at all; it's reported separately.
  const addFiles = (incoming: FileList | File[]) => {
    const accepted: File[] = []
    const rejected: { name: string; message: string }[] = []
    for (const file of Array.from(incoming)) {
      const result = validateFile(file, t)
      if (result.ok) accepted.push(file)
      else rejected.push({ name: file.name, message: result.message })
    }
    setRejectedFiles(rejected)
    if (accepted.length === 0) return
    setFiles((prev) => {
      const existingKeys = new Set(prev.map(fileKey))
      const additions = accepted.filter((f) => !existingKeys.has(fileKey(f)))
      return [...prev, ...additions]
    })
  }

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f !== file))
    setFileErrors((prev) => {
      const { [fileKey(file)]: _removed, ...rest } = prev
      return rest
    })
  }

  // Conditional accident requirement (RA-1357): when the "accident" category
  // is selected, the document must be linked to an actual accident (owner type
  // accident + a chosen accident), not an officer. Owner remains mandatory
  // overall (per the earlier product decision), but this enforces the link
  // *kind* when the accident category is in play.
  const accidentCategorySelected = categories.includes('accident')
  const accidentLinkOk = !accidentCategorySelected || (ownerType === 'accident' && Boolean(ownerOption?.id))
  const canSubmit = Boolean(ownerOption?.id && files.length > 0 && categories.length > 0 && accidentLinkOk && !uploading)

  // Uploads every file in the batch independently rather than stopping at the
  // first failure — with N files, one bad file (corrupt, too large, network
  // blip) shouldn't discard the N-1 that already succeeded. Files that fail
  // stay in the list (with their error) so the user can just retry; only
  // fully closes the dialog once every file has gone through.
  const handleCancelUpload = () => abortRef.current?.abort()

  const handleSubmit = async () => {
    if (!ownerOption?.id || files.length === 0 || categories.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    setFileProgress({})
    const remaining: File[] = []
    const errors: Record<string, string> = {}
    let succeeded = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        await uploadDocument(
          ownerType,
          ownerOption.id,
          file,
          {
            categories,
            description: description.trim() || undefined,
            tags: normalizeTags(tags),
            visibleToRole,
            language,
            filenameOverride: files.length === 1 ? filenameOverride : undefined,
          },
          {
            signal: controller.signal,
            onProgress: (pct) => setFileProgress((prev) => ({ ...prev, [fileKey(file)]: pct })),
          },
        )
        succeeded++
      } catch (err: any) {
        if (err instanceof UploadCancelledError) {
          // Keep this file and everything not yet attempted; stop the batch.
          remaining.push(...files.slice(i))
          break
        }
        remaining.push(file)
        errors[fileKey(file)] = err?.response?.data?.message || err?.message || t('documents.upload_failed_generic')
      }
    }
    abortRef.current = null
    setFileProgress({})
    setFiles(remaining)
    setFileErrors(errors)
    if (succeeded > 0) onUploaded() // refresh so files that did succeed show up
    if (succeeded > 0) toast.success(t('documents.upload_success').replace('{count}', String(succeeded)))
    if (remaining.length === 0 && succeeded > 0) {
      resetForm()
      onClose()
    }
  }

  const ownerOptions = ownerType === 'accident' ? accidentOptions : officerOptions

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{t('documents.upload_document')}</Typography>
        <IconButton onClick={handleClose} size="small" disabled={uploading}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
          {!error && Object.keys(fileErrors).length > 0 && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {t('documents.upload_partial_failure').replace('{count}', String(Object.keys(fileErrors).length))}
            </Alert>
          )}
          {rejectedFiles.length > 0 && (
            <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setRejectedFiles([])}>
              {rejectedFiles.map((r) => `${r.name}: ${r.message}`).join(' · ')}
            </Alert>
          )}

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

          <FileDropZone
            canInteract={!uploading}
            uploading={uploading}
            onClick={() => fileInputRef.current?.click()}
            onFilesDropped={(dropped) => addFiles(dropped)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_INPUT_ACCEPT}
            hidden
            multiple
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          {files.length > 0 && (
            <Stack spacing={0.75}>
              {files.map((file) => {
                const failed = fileErrors[fileKey(file)]
                const pct = fileProgress[fileKey(file)]
                const inFlight = uploading && pct !== undefined && pct < 100
                return (
                  <Stack key={fileKey(file)} spacing={0.25}>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Chip
                        size="small"
                        label={file.name}
                        color={failed ? 'error' : 'default'}
                        variant={failed ? 'filled' : 'outlined'}
                        icon={failed ? <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} /> : undefined}
                        onDelete={uploading ? undefined : () => removeFile(file)}
                        title={failed || file.name}
                        sx={{ maxWidth: '100%' }}
                      />
                      {inFlight && <Typography variant="caption" color="text.secondary">{pct}%</Typography>}
                    </Stack>
                    {inFlight && (
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        aria-label={`${t('documents.uploading')} ${file.name}`}
                        sx={{ borderRadius: 1, height: 4 }}
                      />
                    )}
                  </Stack>
                )
              })}
            </Stack>
          )}

          <TextField
            size="small"
            label={t('documents.file_name')}
            value={filenameOverride}
            onChange={(e) => setFilenameOverride(e.target.value)}
            disabled={files.length !== 1}
            helperText={files.length > 1 ? t('documents.file_name_multi_hint') : undefined}
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
            select
            size="small"
            label={t('documents.language')}
            value={language}
            onChange={(e) => setLanguage(e.target.value as DocumentLanguage)}
          >
            <MenuItem value="fra">{t('documents.language_fra')}</MenuItem>
            <MenuItem value="ara">{t('documents.language_ara')}</MenuItem>
            <MenuItem value="eng">{t('documents.language_eng')}</MenuItem>
          </TextField>

          <TextField
            size="small"
            label={t('documents.note')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />

          <TextField
            size="small"
            label={t('documents.tags')}
            placeholder="scene, witness, insurance"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />

          <TextField
            select
            size="small"
            label={t('documents.col_permission')}
            value={visibleToRole}
            onChange={(e) => {
              setVisibleToRoleTouched(true)
              setVisibleToRole(e.target.value as VisibleToRole)
            }}
          >
            <MenuItem value="officer">{t('documents.permission_all')}</MenuItem>
            <MenuItem value="supervisor">{t('admin_accounts.role_supervisor')}</MenuItem>
            <MenuItem value="admin">{t('admin_accounts.role_admin')}</MenuItem>
          </TextField>

          {accidentCategorySelected && !accidentLinkOk && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {t('documents.accident_link_required')}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {uploading ? (
          <Button variant="secondary" size="sm" onClick={handleCancelUpload}>
            {t('documents.cancel_upload')}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={() => void handleSubmit()} loading={uploading} disabled={!canSubmit}>
          {t('documents.upload_files')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
