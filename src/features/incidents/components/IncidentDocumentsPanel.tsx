import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  GridLegacy as Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import { useIncidentDocuments } from '../hooks/useIncidentDocuments'
import type {
  IncidentDocument,
  IncidentDocumentLifecycleStatus,
  IncidentDocumentTypeCode,
} from '@/types/accident'

type Props = {
  accidentId?: string | null
}

const DOCUMENT_TYPE_OPTIONS: { value: IncidentDocumentTypeCode; label: string }[] = [
  { value: 'PHOTO', label: 'Photo' },
  { value: 'PDF', label: 'PDF' },
  { value: 'SCANNED_DOCUMENT', label: 'Scanned document' },
  { value: 'SKETCH', label: 'Sketch' },
  { value: 'REPORT', label: 'Report' },
  { value: 'IDENTITY_DOCUMENT', label: 'Identity document' },
  { value: 'INSURANCE_DOCUMENT', label: 'Insurance document' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'OTHER', label: 'Other' },
]

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

const formatDate = (value?: string) => {
  if (!value) return 'Unknown'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const normalizeTags = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const buildPreviewUrl = (doc: IncidentDocument) => doc.previewUrl || doc.downloadUrl || ''

export default function IncidentDocumentsPanel({ accidentId }: Props) {
  const theme = useTheme()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [documentType, setDocumentType] = useState<IncidentDocumentTypeCode>('PHOTO')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [editingDocument, setEditingDocument] = useState<IncidentDocument | null>(null)
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

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
  } = useIncidentDocuments(accidentId)

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
    if (selectedDocumentId && !documents.some((doc) => doc.id === selectedDocumentId)) {
      setSelectedDocumentId(documents[0]?.id || null)
    }
  }, [documents, selectedDocumentId])

  const handleUploadClick = () => {
    if (!accidentId) return
    uploadInputRef.current?.click()
  }

  const handleReplaceClick = (documentId: string) => {
    setReplaceTargetId(documentId)
    replaceInputRef.current?.click()
  }

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!accidentId) return
    const list = Array.from(files || [])
    if (!list.length) return

    setBusyActionId('upload')
    setPreviewError(null)
    try {
      const result = await uploadDocuments(list, {
        documentType,
        description: description.trim() || undefined,
        tags: normalizeTags(tags),
      })
      const firstCreated = result.documents[0]
      if (firstCreated?.id) {
        setSelectedDocumentId(firstCreated.id)
      }
    } catch (err) {
      setPreviewError((err as any)?.message || 'Unable to upload documents')
    } finally {
      setBusyActionId(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  const handleReplaceFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !accidentId || !replaceTargetId) return

    setBusyActionId(replaceTargetId)
    setPreviewError(null)
    try {
      await replaceDocument(replaceTargetId, file, {
        documentType,
        description: description.trim() || undefined,
        tags: normalizeTags(tags),
      })
    } catch (err) {
      setPreviewError((err as any)?.message || 'Unable to replace document')
    } finally {
      setBusyActionId(null)
      setReplaceTargetId(null)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  const handleArchive = async (doc: IncidentDocument) => {
    if (!window.confirm(`Archive "${doc.filename}"?`)) return
    setBusyActionId(doc.id)
    try {
      await archiveDocument(doc.id)
    } catch (err) {
      setPreviewError((err as any)?.message || 'Unable to archive document')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleDelete = async (doc: IncidentDocument) => {
    if (!window.confirm(`Remove "${doc.filename}" permanently?`)) return
    setBusyActionId(doc.id)
    try {
      await removeDocument(doc.id)
    } catch (err) {
      setPreviewError((err as any)?.message || 'Unable to remove document')
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
      })
      setEditingDocument(null)
    } catch (err) {
      setPreviewError((err as any)?.message || 'Unable to save document metadata')
    } finally {
      setBusyActionId(null)
    }
  }

  const selectedPreviewUrl = selectedDocument ? buildPreviewUrl(selectedDocument) : ''
  const isImagePreview = Boolean(selectedDocument?.mimeType?.startsWith('image/'))
  const isPdfPreview =
    Boolean(selectedDocument?.mimeType?.includes('pdf')) || String(selectedDocument?.filename || '').toLowerCase().endsWith('.pdf')

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
        bgcolor: alpha(theme.palette.background.paper, 0.96),
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Incident document management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload, preview, tag, search, archive, and replace files linked to this accident record.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" onClick={() => void refresh()} startIcon={<RefreshRoundedIcon />} disabled={!accidentId || loading}>
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleUploadClick}
              startIcon={<UploadFileRoundedIcon />}
              disabled={!accidentId}
            >
              Upload files
            </Button>
          </Stack>
        </Stack>

        {!accidentId && (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Save the accident record first to enable linked document management.
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
              <Paper
                variant="outlined"
                onClick={handleUploadClick}
                onDragOver={(event) => {
                  if (!accidentId) return
                  event.preventDefault()
                }}
                onDrop={async (event) => {
                  if (!accidentId) return
                  event.preventDefault()
                  const dropped = event.dataTransfer.files
                  if (dropped?.length) {
                    await handleFilesUpload(dropped)
                  }
                }}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  cursor: accidentId ? 'pointer' : 'not-allowed',
                  borderStyle: 'dashed',
                  borderColor: accidentId ? alpha(theme.palette.primary.main, 0.4) : alpha(theme.palette.divider, 0.7),
                  bgcolor: accidentId ? alpha(theme.palette.primary.main, 0.04) : alpha(theme.palette.action.disabledBackground, 0.35),
                  transition: 'all 0.2s ease',
                  '&:hover': accidentId
                    ? {
                        borderColor: alpha(theme.palette.primary.main, 0.65),
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                      }
                    : {},
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
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: theme.palette.primary.main,
                    }}
                  >
                    <AttachFileRoundedIcon />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>Drag and drop documents here</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Accepts images and PDF files. The chosen metadata will be attached to each upload.
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" disabled={!accidentId} startIcon={<UploadFileRoundedIcon />}>
                    Choose files
                  </Button>
                </Stack>
                {uploading && (
                  <Box sx={{ mt: 1.5 }}>
                    <LinearProgress />
                  </Box>
                )}
              </Paper>

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
                      label="Document type"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value as IncidentDocumentTypeCode)}
                    >
                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
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
                      label="Description"
                      placeholder="Short note about the file"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Tags"
                      placeholder="scene, witness, insurance"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
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
                    <Typography sx={{ fontWeight: 700 }}>Linked files</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {filteredDocuments.length} document{filteredDocuments.length === 1 ? '' : 's'} in this record
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    placeholder="Search documents"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ minWidth: { xs: '100%', sm: 260 } }}
                    InputProps={{
                      startAdornment: (
                        <SearchRoundedIcon fontSize="small" style={{ marginRight: 8, color: theme.palette.text.secondary }} />
                      ),
                    }}
                  />
                </Stack>

                <Stack spacing={1}>
                  {loading ? (
                    <Typography variant="body2" color="text.secondary">
                      Loading incident documents...
                    </Typography>
                  ) : filteredDocuments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No linked documents yet.
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
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                                {doc.description || 'No description'} · {formatBytes(doc.size)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(doc.createdAt)}{doc.createdBy ? ` · ${doc.createdBy}` : ''}
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
                              <Tooltip title="Preview">
                                <IconButton size="small" onClick={(event) => { event.stopPropagation(); setSelectedDocumentId(doc.id) }} disabled={busy}>
                                  <VisibilityRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit metadata">
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
                              <Tooltip title="Replace file">
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
                              <Tooltip title="Archive">
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
                              <Tooltip title="Remove">
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
                              <Tooltip title="Download">
                                <IconButton
                                  size="small"
                                  component="a"
                                  href={buildPreviewUrl(doc) || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  disabled={!buildPreviewUrl(doc)}
                                >
                                  <DownloadRoundedIcon fontSize="small" />
                                </IconButton>
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
                        Metadata
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleReplaceClick(selectedDocument.id)}
                        startIcon={<RefreshRoundedIcon />}
                        disabled={selectedDocument.status === 'archived'}
                      >
                        Replace
                      </Button>
                    </Stack>
                  </Stack>

                  <Divider />

                  <Box
                    sx={{
                      position: 'relative',
                      borderRadius: 2.5,
                      overflow: 'hidden',
                      minHeight: 260,
                      bgcolor: alpha(theme.palette.action.active, 0.04),
                      border: `1px solid ${alpha(theme.palette.divider, 0.78)}`,
                    }}
                  >
                    {isImagePreview && selectedPreviewUrl ? (
                      <Box
                        component="img"
                        src={selectedPreviewUrl}
                        alt={selectedDocument.filename}
                        sx={{
                          display: 'block',
                          width: '100%',
                          height: 320,
                          objectFit: 'contain',
                          bgcolor: alpha(theme.palette.common.black, 0.04),
                        }}
                      />
                    ) : isPdfPreview && selectedPreviewUrl ? (
                      <Box
                        component="iframe"
                        title={selectedDocument.filename}
                        src={selectedPreviewUrl}
                        sx={{
                          width: '100%',
                          height: 320,
                          border: 'none',
                          bgcolor: 'background.paper',
                        }}
                      />
                    ) : (
                      <Stack sx={{ height: 320 }} alignItems="center" justifyContent="center" spacing={1}>
                        <DescriptionOutlinedIcon sx={{ fontSize: 48, color: theme.palette.text.secondary }} />
                        <Typography color="text.secondary">Preview unavailable for this file type</Typography>
                        {selectedPreviewUrl && (
                          <Button component="a" href={selectedPreviewUrl} target="_blank" rel="noreferrer" variant="outlined" size="small">
                            Open file
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Box>

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Uploaded at
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>{formatDate(selectedDocument.createdAt)}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          OCR status
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>{selectedDocument.ocrStatus || 'not started'}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Tags
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                          {selectedDocument.tags.length ? (
                            selectedDocument.tags.map((tag) => <Chip key={tag} size="small" label={tag} variant="outlined" />)
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No tags
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    </Grid>
                    {selectedDocument.extractedText && (
                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Extracted text
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
                  <Typography sx={{ fontWeight: 700 }}>No document selected</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pick a file from the list to preview it here.
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
                Edit document metadata
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Update the document information shown in this accident record.
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
                  label="Document type"
                  value={editingDocument.documentType}
                  onChange={(event) =>
                    setEditingDocument((prev) => (prev ? { ...prev, documentType: event.target.value } : prev))
                  }
                >
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  fullWidth
                  label="Description"
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
                  label="Tags"
                  value={(editingDocument.tags || []).join(', ')}
                  onChange={(event) =>
                    setEditingDocument((prev) =>
                      prev ? { ...prev, tags: normalizeTags(event.target.value) } : prev
                    )
                  }
                  helperText="Separate tags with commas"
                />
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Status"
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
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditingDocument(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => void handleSaveMetadata()} disabled={!editingDocument}>
              Save changes
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  )
}
