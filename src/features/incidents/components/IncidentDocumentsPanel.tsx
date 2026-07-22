import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Alert,
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  GridLegacy as Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import { useIncidentDocuments } from '../hooks/useIncidentDocuments'
import DocumentPreview from '@/components/documents/DocumentPreview'
import FileDropZone from '@/components/documents/FileDropZone'
import { getDocumentTypeOptions } from '@/features/documents/documentTypeOptions'
import { useAppSelector } from '@/store/store'
import { useTranslation } from '@/themeMode'
import type {
  IncidentDocument,
  IncidentDocumentLifecycleStatus,
  IncidentDocumentTypeCode,
} from '@/types/accident'

type Props = {
  accidentId?: string | null
  scopeKey?: string | null
  enabled?: boolean
}

const RESTRICTED_BY_DEFAULT: (IncidentDocumentTypeCode | string)[] = ['IDENTITY_DOCUMENT', 'INSURANCE_DOCUMENT']

const STATUS_COLOR: Record<IncidentDocumentLifecycleStatus, 'default' | 'success' | 'warning' | 'info' | 'error'> = {
  uploaded: 'warning',
  processing: 'info',
  available: 'success',
  archived: 'default',
  failed: 'error',
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const formatDate = (value?: string, unknownLabel = 'Unknown') => {
  if (!value) return unknownLabel
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const normalizeTags = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const buildPreviewUrl = (doc: IncidentDocument) => doc.previewUrl || doc.downloadUrl || ''

export default function IncidentDocumentsPanel({ accidentId, scopeKey, enabled = true }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [documentType, setDocumentType] = useState<IncidentDocumentTypeCode>('PHOTO')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [restricted, setRestricted] = useState(false)
  const [restrictedTouched, setRestrictedTouched] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const isAdmin = useAppSelector((s) => s.auth.user?.role === 'admin')
  const [editingDocument, setEditingDocument] = useState<IncidentDocument | null>(null)
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const canInteract = Boolean(enabled && scopeKey)
  const documentTypeOptions = useMemo(() => getDocumentTypeOptions(t), [t])

  const {
    documents,
    loading,
    uploading,
    savingDocumentId,
    error,
    uploadDocuments,
    updateDocument,
    archiveDocument,
    removeDocument,
    replaceDocument,
    refresh,
    resolveDownloadUrl,
  } = useIncidentDocuments(accidentId, scopeKey)

  const selectedDocument = useMemo(() => {
    if (!documents.length) return null
    return documents.find((doc) => doc.id === selectedDocumentId) || documents[0]
  }, [documents, selectedDocumentId])

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return documents
    return documents.filter((doc) => {
      const haystack = [
        doc.filename,
        doc.documentType,
        doc.description,
        doc.status,
        ...(doc.tags || []),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [documents, search])

  useEffect(() => {
    if (!selectedDocument && documents[0]) {
      setSelectedDocumentId(documents[0].id)
    }
  }, [documents, selectedDocument])

  useEffect(() => {
    if (!restrictedTouched) {
      setRestricted(RESTRICTED_BY_DEFAULT.includes(documentType))
    }
  }, [documentType, restrictedTouched])

  useEffect(() => {
    if (selectedDocumentId && !documents.some((doc) => doc.id === selectedDocumentId)) {
      setSelectedDocumentId(documents[0]?.id || null)
    }
  }, [documents, selectedDocumentId])

  const handleUploadClick = () => {
    if (!canInteract) return
    uploadInputRef.current?.click()
  }

  const handleReplaceClick = (documentId: string) => {
    if (!canInteract) return
    setReplaceTargetId(documentId)
    replaceInputRef.current?.click()
  }

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!canInteract) return
    const list = Array.from(files || [])
    if (!list.length) return

    setBusyActionId('upload')
    setPreviewError(null)
    try {
      const result = await uploadDocuments(list, {
        documentType,
        description: description.trim() || undefined,
        tags: normalizeTags(tags),
        restricted,
      })
      const firstCreated = result.documents[0]
      if (firstCreated?.id) {
        setSelectedDocumentId(firstCreated.id)
      }
    } catch (err) {
      setPreviewError((err as any)?.message || t('documents.upload_files'))
    } finally {
      setBusyActionId(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  const handleReplaceFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !canInteract || !replaceTargetId) return

    setBusyActionId(replaceTargetId)
    setPreviewError(null)
    try {
      await replaceDocument(replaceTargetId, file, {
        documentType,
        description: description.trim() || undefined,
        tags: normalizeTags(tags),
        restricted,
      })
    } catch (err) {
      setPreviewError((err as any)?.message || t('documents.replace_file'))
    } finally {
      setBusyActionId(null)
      setReplaceTargetId(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  const handleArchive = async (doc: IncidentDocument) => {
    if (!window.confirm(`${t('documents.archive')} "${doc.filename}"?`)) return
    setBusyActionId(doc.id)
    try {
      await archiveDocument(doc.id)
    } catch (err) {
      setPreviewError((err as any)?.message || t('documents.archive'))
    } finally {
      setBusyActionId(null)
    }
  }

  const handleDelete = async (doc: IncidentDocument) => {
    if (!window.confirm(`${t('documents.remove')} "${doc.filename}"?`)) return
    setBusyActionId(doc.id)
    try {
      await removeDocument(doc.id)
    } catch (err) {
      setPreviewError((err as any)?.message || t('documents.remove'))
    } finally {
      setBusyActionId(null)
    }
  }

  const handleSaveMetadata = async () => {
    if (!editingDocument) return
    setBusyActionId(editingDocument.id)
    try {
      await updateDocument(editingDocument.id, {
        documentType: editingDocument.documentType,
        description: editingDocument.description,
        tags: editingDocument.tags,
        status: editingDocument.status,
        restricted: editingDocument.restricted,
      })
      setEditingDocument(null)
    } catch (err) {
      setPreviewError((err as any)?.message || t('documents.save_changes'))
    } finally {
      setBusyActionId(null)
    }
  }

  const selectedPreviewUrl = selectedDocument ? buildPreviewUrl(selectedDocument) : ''

  useEffect(() => {
    if (!selectedDocument || selectedDocument.downloadUrl || !accidentId) return
    void resolveDownloadUrl(selectedDocument.id)
  }, [accidentId, resolveDownloadUrl, selectedDocument])

  const handleDownload = async (doc: IncidentDocument) => {
    setBusyActionId(doc.id)
    setPreviewError(null)
    try {
      const url = doc.downloadUrl || doc.previewUrl || (accidentId ? await resolveDownloadUrl(doc.id) : null)
      if (!url) throw new Error(t('documents.download'))
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setPreviewError((err as any)?.message || t('documents.download'))
    } finally {
      setBusyActionId(null)
    }
  }

  return (
    <Paper
      sx={{
        p: { xs: 1.5, md: 2 },
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
        bgcolor: alpha(theme.palette.background.paper, 0.96),
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {t('documents.attachments')}
              </Typography>
              <Chip
                size="small"
                label={canInteract ? t('documents.ready_to_upload') : t('documents.complete_required_fields')}
                color={canInteract ? 'success' : 'default'}
                variant={canInteract ? 'filled' : 'outlined'}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('documents.add_photos_or_pdfs')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" onClick={() => void refresh()} startIcon={<RefreshRoundedIcon />} disabled={!scopeKey || loading}>
              {t('common.refresh')}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleUploadClick}
              startIcon={<UploadFileRoundedIcon />}
              disabled={!canInteract}
            >
              {t('documents.upload_files')}
            </Button>
          </Stack>
        </Stack>

        {!canInteract && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            {t('documents.fill_required_report_fields')}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        {previewError && !error && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            {previewError}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}>
            <Stack spacing={1.5}>
              <FileDropZone
                canInteract={canInteract}
                uploading={uploading}
                onClick={handleUploadClick}
                onFilesDropped={(files) => void handleFilesUpload(files)}
              />

              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  borderColor: alpha(theme.palette.divider, 0.82),
                }}
              >
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      label={t('documents.type')}
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value as IncidentDocumentTypeCode)}
                    >
                      {documentTypeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      fullWidth
                      label={t('documents.note')}
                      placeholder={t('documents.brief_note')}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      fullWidth
                      label={t('documents.tags')}
                      placeholder="scene, witness, insurance"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={restricted}
                          onChange={(e) => {
                            setRestrictedTouched(true)
                            setRestricted(e.target.checked)
                          }}
                        />
                      }
                      label={t('documents.mark_restricted')}
                    />
                  </Grid>
                </Grid>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  borderColor: alpha(theme.palette.divider, 0.82),
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{t('documents.linked_files')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {filteredDocuments.length} {t('incidents.reports_in_view')}
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    placeholder={t('documents.search_documents')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ minWidth: { xs: '100%', sm: 260 } }}
                    InputProps={{
                      startAdornment: (
                        <SearchRoundedIcon fontSize="small" style={{ marginInlineEnd: 8, color: theme.palette.text.secondary }} />
                      ),
                    }}
                  />
                </Stack>

                <Stack spacing={1}>
                  {loading ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('documents.loading_incident_documents')}
                    </Typography>
                  ) : filteredDocuments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('documents.no_files_added_yet')}
                    </Typography>
                  ) : (
                    filteredDocuments.map((doc) => {
                      const isActive = doc.id === selectedDocument?.id
                      const busy = busyActionId === doc.id || savingDocumentId === doc.id
                      return (
                        <Paper
                          key={doc.id}
                          variant="outlined"
                          onClick={() => setSelectedDocumentId(doc.id)}
                          sx={{
                            p: 1.25,
                            borderRadius: 2.5,
                            cursor: 'pointer',
                            borderColor: isActive ? alpha(theme.palette.primary.main, 0.5) : alpha(theme.palette.divider, 0.72),
                            bgcolor: isActive ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                            '&:hover': {
                              borderColor: alpha(theme.palette.primary.main, 0.45),
                            },
                          }}
                        >
                          <Stack direction="row" spacing={1.25} alignItems="flex-start">
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: alpha(theme.palette.text.secondary, 0.08),
                                color: theme.palette.text.secondary,
                              }}
                            >
                              {doc.mimeType.startsWith('image/') ? (
                                <ImageRoundedIcon fontSize="small" />
                              ) : doc.mimeType.includes('pdf') ? (
                                <PictureAsPdfRoundedIcon fontSize="small" />
                              ) : (
                                <DescriptionOutlinedIcon fontSize="small" />
                              )}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Typography sx={{ fontWeight: 700 }} noWrap title={doc.filename}>
                                  {doc.filename}
                                </Typography>
                                <Chip size="small" label={doc.status} color={STATUS_COLOR[doc.status]} />
                                <Chip size="small" variant="outlined" label={doc.documentType} />
                                {doc.restricted && (
                                  <Chip size="small" color="warning" icon={<LockRoundedIcon sx={{ fontSize: 14 }} />} label={t('documents.restricted')} />
                                )}
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                {doc.description || t('documents.no_note')} · {formatBytes(doc.size)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(doc.createdAt, t('comms.unknown'))}{doc.createdBy ? ` · ${doc.createdBy}` : ''}
                              </Typography>
                              {doc.tags.length > 0 && (
                                <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                                  {doc.tags.map((tag) => (
                                    <Chip key={tag} size="small" label={tag} variant="outlined" />
                                  ))}
                                </Stack>
                              )}
                            </Box>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Tooltip title={t('documents.preview')}>
                                <IconButton size="small" onClick={(event) => { event.stopPropagation(); setSelectedDocumentId(doc.id) }} disabled={busy}>
                                  <VisibilityRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('documents.edit_metadata')}>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setEditingDocument(doc)
                                  }}
                                  disabled={busy}
                                >
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('documents.replace_file')}>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleReplaceClick(doc.id)
                                  }}
                                  disabled={busy || doc.status === 'archived'}
                                >
                                  <RefreshRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('documents.archive')}>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleArchive(doc)
                                  }}
                                  disabled={busy || doc.status === 'archived'}
                                >
                                  <ArchiveRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('documents.remove')}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleDelete(doc)
                                  }}
                                  disabled={busy}
                                >
                                  <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={doc.restricted && !isAdmin ? t('documents.restricted_admin_only') : t('documents.download')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void handleDownload(doc)
                                    }}
                                    disabled={busy || (doc.restricted && !isAdmin)}
                                  >
                                    <DownloadRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </Paper>
                      )
                    })
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 3,
                minHeight: 320,
                borderColor: alpha(theme.palette.divider, 0.82),
                bgcolor: alpha(theme.palette.background.paper, 0.98),
              }}
            >
              {selectedDocument ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800 }} noWrap title={selectedDocument.filename}>
                        {selectedDocument.filename}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedDocument.documentType} · {formatBytes(selectedDocument.size)} · {selectedDocument.status}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setEditingDocument(selectedDocument)} startIcon={<EditRoundedIcon />}>
                        {t('documents.metadata')}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleReplaceClick(selectedDocument.id)}
                        startIcon={<RefreshRoundedIcon />}
                        disabled={selectedDocument.status === 'archived'}
                      >
                        {t('documents.replace')}
                      </Button>
                    </Stack>
                  </Stack>

                  <Divider />

                  <DocumentPreview
                    filename={selectedDocument.filename}
                    mimeType={selectedDocument.mimeType}
                    previewUrl={selectedPreviewUrl}
                    onOpenFile={() => void handleDownload(selectedDocument)}
                    height={320}
                    restricted={selectedDocument.restricted}
                    canView={!selectedDocument.restricted || isAdmin}
                  />

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('documents.uploaded_at')}
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>{formatDate(selectedDocument.createdAt)}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('documents.ocr_status')}
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>{selectedDocument.ocrStatus || t('documents.not_started')}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('documents.tags')}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                          {selectedDocument.tags.length ? (
                            selectedDocument.tags.map((tag) => <Chip key={tag} size="small" label={tag} variant="outlined" />)
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {t('documents.no_tags')}
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    </Grid>
                    {selectedDocument.extractedText && (!selectedDocument.restricted || isAdmin) && (
                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('documents.extracted_text')}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.75 }}>
                            {selectedDocument.extractedText}
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                </Stack>
              ) : (
                <Stack sx={{ minHeight: 320 }} alignItems="center" justifyContent="center" spacing={1}>
                  <DescriptionOutlinedIcon sx={{ fontSize: 48, color: theme.palette.text.secondary }} />
                  <Typography sx={{ fontWeight: 700 }}>{t('documents.no_file_selected')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('documents.pick_a_file_from_the_list_to_preview_it_here')}
                  </Typography>
                </Stack>
              )}
            </Paper>
          </Grid>
        </Grid>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          multiple
          onChange={(event) => {
            void handleFilesUpload(event.target.files || [])
          }}
        />
        <input ref={replaceInputRef} type="file" accept="image/*,application/pdf" hidden onChange={handleReplaceFile} />

        <Dialog open={Boolean(editingDocument)} onClose={() => setEditingDocument(null)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {t('documents.edit_document_metadata')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('documents.update')}
              </Typography>
            </Box>
            <IconButton onClick={() => setEditingDocument(null)} size="small">
              <CloseRoundedIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            {editingDocument && (
              <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  label={t('documents.type')}
                  value={editingDocument.documentType}
                  onChange={(event) =>
                    setEditingDocument((prev) => (prev ? { ...prev, documentType: event.target.value } : prev))
                  }
                >
                  {documentTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  fullWidth
                  label={t('documents.note')}
                  value={editingDocument.description || ''}
                  onChange={(event) =>
                    setEditingDocument((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                  }
                  multiline
                  minRows={2}
                />
                <TextField
                  size="small"
                  fullWidth
                  label={t('documents.tags')}
                  value={(editingDocument.tags || []).join(', ')}
                  onChange={(event) =>
                    setEditingDocument((prev) =>
                      prev ? { ...prev, tags: normalizeTags(event.target.value) } : prev
                    )
                  }
                  helperText={t('documents.separate_tags_with_commas')}
                />
                <TextField
                  select
                  size="small"
                  fullWidth
                  label={t('documents.status')}
                  value={editingDocument.status}
                  onChange={(event) =>
                    setEditingDocument((prev) =>
                      prev ? { ...prev, status: event.target.value as IncidentDocumentLifecycleStatus } : prev
                    )
                  }
                >
                  {Object.keys(STATUS_COLOR).map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </TextField>
                {isAdmin && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(editingDocument.restricted)}
                        onChange={(event) =>
                          setEditingDocument((prev) => (prev ? { ...prev, restricted: event.target.checked } : prev))
                        }
                      />
                    }
                    label={t('documents.mark_restricted')}
                  />
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditingDocument(null)}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={() => void handleSaveMetadata()} disabled={!editingDocument}>
              {t('documents.save_changes')}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  )
}
