import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import SlideshowRoundedIcon from '@mui/icons-material/SlideshowRounded'
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import NoteAddRoundedIcon from '@mui/icons-material/NoteAddRounded'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'

import Card from '@/components/Common/Card'
import Button from '@/components/Common/Button'
import Badge from '@/components/Common/Badge'
import StatCard from '@/components/Common/StatCard'
import DateRangePickerField from '@/components/Common/DateRangePickerField'
import { StatCardSkeleton, TableRowSkeleton } from '@/components/Common/Skeletons'
import { listParent, listChild } from '@/utils/motion'
import DocumentPreview from '@/components/documents/DocumentPreview'
import UploadDocumentDialog from '../components/UploadDocumentDialog'
import EditDocumentDialog from '../components/EditDocumentDialog'
import AddVersionDialog from '../components/AddVersionDialog'
import DocumentAuditTrail from '../components/DocumentAuditTrail'
import { getDocumentCategoryOptions } from '@/features/documents/documentCategoryOptions'
import { useDocumentsSearch } from '../hooks/useDocumentsSearch'
import { useSavedDocumentFilters } from '../hooks/useSavedDocumentFilters'
import toast from 'react-hot-toast'
import { apiService } from '@/services/api'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { fetchIncidents } from '@/features/incidents/slices/incidentsSlice'
import type { Incident } from '@/features/incidents/slices/incidentsSlice'
import { useTranslation } from '@/themeMode'
import type { DocumentSearchParams, DocumentSortBy, DocumentVersionInfo, GedDocument } from '@/types/document'

const MotionBox = motion(Box)

const OCR_BADGE_VARIANT: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
}

// Hierarchical: officer < supervisor < admin. Mirrors ROLE_RANK in the backend's
// documents.schemas.ts — a document's visibleToRole is the minimum role that
// can see its content.
const ROLE_RANK: Record<string, number> = { officer: 0, supervisor: 1, admin: 2 }

// Reuses the role-label translations already defined for admin_accounts.tsx
// rather than introducing duplicate strings for the same three role names.
const VISIBLE_TO_ROLE_META: Record<string, { color: 'default' | 'info' | 'warning'; labelKey: string }> = {
  officer: { color: 'default', labelKey: 'documents.permission_all' },
  supervisor: { color: 'info', labelKey: 'admin_accounts.role_supervisor' },
  admin: { color: 'warning', labelKey: 'admin_accounts.role_admin' },
}

// MUST list every filterable key. updateFilters merges over previous state
// (`{...prev, ...patch}`), so any key omitted here survives a "Clear filters"
// or preset switch as a stale, often-invisible filter (e.g. a leaked ownerId
// silently zeroing results). Keep this exhaustive against DocumentSearchParams.
const EMPTY_FILTERS: DocumentSearchParams = {
  q: '',
  category: undefined,
  ownerType: undefined,
  ownerId: undefined,
  tags: undefined,
  ocrStatus: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  createdBy: undefined,
  accidentReference: undefined,
  archived: undefined,
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
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function DocumentTypeIcon({ mimeType, filename = '' }: { mimeType: string; filename?: string }) {
  const name = filename.toLowerCase()
  const is = (...frags: string[]) => frags.some((f) => mimeType.includes(f))
  const ext = (...exts: string[]) => exts.some((e) => name.endsWith(e))
  if (mimeType.startsWith('image/')) return <ImageRoundedIcon fontSize="small" sx={{ color: 'success.main' }} />
  if (mimeType.startsWith('video/') || ext('.mp4', '.mov', '.avi', '.mkv')) return <VideoFileRoundedIcon fontSize="small" sx={{ color: 'secondary.main' }} />
  if (mimeType.includes('pdf') || ext('.pdf')) return <PictureAsPdfRoundedIcon fontSize="small" sx={{ color: 'error.main' }} />
  if (is('word', 'msword', 'officedocument.wordprocessing') || ext('.doc', '.docx', '.rtf', '.odt'))
    return <ArticleRoundedIcon fontSize="small" sx={{ color: 'info.main' }} />
  if (is('sheet', 'ms-excel', 'officedocument.spreadsheet') || ext('.xls', '.xlsx', '.csv', '.ods'))
    return <TableChartRoundedIcon fontSize="small" sx={{ color: 'success.dark' }} />
  if (is('presentation', 'ms-powerpoint') || ext('.ppt', '.pptx', '.odp'))
    return <SlideshowRoundedIcon fontSize="small" sx={{ color: 'warning.main' }} />
  return <DescriptionOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
}

export default function DocumentsPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { t } = useTranslation()
  const navigate = useNavigate()
  const categoryOptions = useMemo(() => getDocumentCategoryOptions(t), [t])
  const [previewDoc, setPreviewDoc] = useState<GedDocument | null>(null)
  const [previewTab, setPreviewTab] = useState(0)
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null)
  const [previewFileLoading, setPreviewFileLoading] = useState(false)
  const [previewPages, setPreviewPages] = useState<string[] | null>(null)
  const [previewPagesLoading, setPreviewPagesLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editDoc, setEditDoc] = useState<GedDocument | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<GedDocument | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [addVersionDoc, setAddVersionDoc] = useState<GedDocument | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [versionsByDoc, setVersionsByDoc] = useState<Record<string, DocumentVersionInfo[]>>({})
  const [versionsLoading, setVersionsLoading] = useState<Set<string>>(new Set())
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<{ doc: GedDocument; version: DocumentVersionInfo } | null>(null)
  const [deleteVersionBusy, setDeleteVersionBusy] = useState(false)
  const [deleteVersionError, setDeleteVersionError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)
  const [bulkTagValue, setBulkTagValue] = useState('')
  const [bulkPermissionDialogOpen, setBulkPermissionDialogOpen] = useState(false)
  const [bulkPermissionValue, setBulkPermissionValue] = useState<'officer' | 'supervisor' | 'admin'>('officer')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const user = useAppSelector((s) => s.auth.user)
  const isAdmin = user?.role === 'admin'
  const dispatch = useAppDispatch()

  const { documents, total, page, pageSize, loading, error, filters, updateFilters, refresh } = useDocumentsSearch()
  const { savedViews, saveView, removeView } = useSavedDocumentFilters()

  // Accident filter: a searchable select over real accidents (only shown when
  // "Linked to" is set to Accident), not a free-text field — the accident
  // list is small enough to load once and filter client-side, same pattern
  // as the owner picker in Upload/EditDocumentDialog.
  const incidents: Incident[] = useAppSelector((s) => s.incidents.list)
  const accidentOptions = useMemo(
    () => incidents.map((inc) => ({ id: inc.id, label: `${inc.location} · ${inc.time} · #${inc.id.slice(0, 8)}` })),
    [incidents]
  )
  useEffect(() => {
    if (incidents.length === 0) dispatch(fetchIncidents({ page: 1, limit: 200 }) as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Created-by filter: admin-only searchable select over registered users,
  // labeled "fullname - role". Kept as separate option state (rather than
  // derived from the live search results) so the label doesn't disappear
  // once the user's search query no longer matches the selected person.
  const [createdByOption, setCreatedByOption] = useState<{ id: string; label: string } | null>(null)
  const [createdByOptions, setCreatedByOptions] = useState<{ id: string; label: string }[]>([])
  const [createdByQuery, setCreatedByQuery] = useState('')
  const [createdByLoading, setCreatedByLoading] = useState(false)

  const roleLabel = (role?: string) => {
    if (role === 'admin') return t('admin_accounts.role_admin')
    if (role === 'supervisor') return t('admin_accounts.role_supervisor')
    return t('admin_accounts.role_officer')
  }

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    // Debounce so typing in the Created-by picker doesn't fire a users request
    // per keystroke.
    const debounce = setTimeout(() => {
      setCreatedByLoading(true)
      apiService.users
        .list({ search: createdByQuery.trim() || undefined, page: 1, limit: 50 })
        .then((resp) => {
          if (cancelled) return
          const raw = resp.data?.data ?? resp.data?.items ?? resp.data?.rows ?? resp.data?.users ?? resp.data
          const rows = Array.isArray(raw) ? raw : []
          setCreatedByOptions(
            rows.map((row: any) => {
              const id = String(row.id ?? row._id ?? row.officerId ?? '')
              const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.displayName || row.name || row.officerId || id
              return { id, label: `${name} - ${roleLabel(row.role)}` }
            })
          )
        })
        .finally(() => {
          if (!cancelled) setCreatedByLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(debounce)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, createdByQuery])

  useEffect(() => {
    if (!filters.createdBy) setCreatedByOption(null)
  }, [filters.createdBy])

  // Clear row selection whenever the result set changes (filter/page/sort),
  // so a bulk action can't target rows the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filters])

  // Sorting is server-driven: clicking a header re-queries via sortBy/sortOrder
  // so it orders the ENTIRE result set (across pages), not just the ~20 rows
  // currently loaded. The backend already supports these params.
  const sortBy = filters.sortBy
  const sortOrder = filters.sortOrder ?? 'desc'

  const activeFilterCount = [
    Boolean(filters.q),
    Boolean(filters.category),
    Boolean(filters.ownerType),
    Boolean(filters.ownerId),
    Boolean(filters.ocrStatus),
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
    Boolean(filters.createdBy),
    Boolean(filters.archived),
  ].filter(Boolean).length

  const applyFilterSet = (patch: DocumentSearchParams) => {
    updateFilters({ ...EMPTY_FILTERS, ...patch, page: 1 })
  }

  const clearFilters = () => applyFilterSet({})

  const presets = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().slice(0, 10)
    const list = [
      { key: 'failed', label: t('documents.ocr_failed'), filters: { ocrStatus: 'failed' as const } },
      { key: 'pending', label: t('documents.pending_ocr'), filters: { ocrStatus: 'pending' as const } },
      { key: 'today', label: t('documents.preset_today'), filters: { dateFrom: todayStr, dateTo: todayStr } },
      { key: 'week', label: t('documents.preset_this_week'), filters: { dateFrom: weekAgoStr, dateTo: todayStr } },
    ]
    if (user?.id) {
      list.push({ key: 'mine', label: t('documents.preset_my_uploads'), filters: { createdBy: user.id } as any })
    }
    return list
  }, [t, user?.id])

  const ocrBreakdown = useMemo(() => {
    const counts = { pending: 0, processing: 0, completed: 0, failed: 0 }
    documents.forEach((doc) => {
      if (doc.ocrStatus && doc.ocrStatus in counts) counts[doc.ocrStatus] += 1
    })
    return counts
  }, [documents])

  const handleOpenOwner = (doc: GedDocument) => {
    if (doc.ownerType === 'accident') navigate('/incidents')
  }

  const resolveDownloadUrl = async (doc: GedDocument) => {
    if (doc.downloadUrl) return doc.downloadUrl
    try {
      const response = await apiService.documents.getDownload(doc.id)
      const data = response.data?.data ?? response.data ?? {}
      return data.downloadUrl || data.path || null
    } catch {
      return null
    }
  }

  // The document row from search results never carries a real file URL
  // (search() doesn't mint one per row — only on-demand, via /download) — so
  // the preview dialog has to fetch one itself whenever it opens, rather than
  // reading previewDoc.downloadUrl directly (which is always undefined here).
  useEffect(() => {
    if (!previewDoc || !canViewDoc(previewDoc)) {
      setPreviewFileUrl(null)
      return
    }
    let cancelled = false
    setPreviewFileLoading(true)
    resolveDownloadUrl(previewDoc)
      .then((url) => {
        if (!cancelled) setPreviewFileUrl(url)
      })
      .finally(() => {
        if (!cancelled) setPreviewFileLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDoc?.id])

  // Office formats (.docx etc.) can't render in an <img>/<iframe> directly —
  // mirrors DocumentPreview's own isOfficePreview check so this only fires a
  // second network request when there's actually a page image to fetch.
  const OFFICE_EXTENSIONS = ['.doc', '.docx', '.odt', '.ppt', '.pptx', '.xls', '.xlsx', '.rtf']
  const isOfficeDoc = (doc: GedDocument) => {
    const mimeType = doc.mimeType ?? ''
    const filename = doc.filename ?? ''
    return (
      mimeType.includes('word') ||
      mimeType.includes('msword') ||
      mimeType.includes('officedocument') ||
      mimeType.includes('opendocument') ||
      mimeType.includes('ms-excel') ||
      mimeType.includes('ms-powerpoint') ||
      OFFICE_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))
    )
  }

  useEffect(() => {
    if (!previewDoc || !canViewDoc(previewDoc) || !isOfficeDoc(previewDoc)) {
      setPreviewPages(null)
      return
    }
    let cancelled = false
    setPreviewPagesLoading(true)
    // Fetch every rendered page so the preview is a scrollable multi-page view
    // (not just page 1) for Office / multi-page documents.
    apiService.documents
      .getPreviewPages(previewDoc.id)
      .then((response) => {
        const data = response.data?.data ?? response.data ?? {}
        const urls = Array.isArray(data.pages) ? data.pages.map((p: { url: string }) => p.url).filter(Boolean) : []
        if (!cancelled) setPreviewPages(urls)
      })
      .catch(() => {
        if (!cancelled) setPreviewPages(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewPagesLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDoc?.id])

  const handleDownload = async (doc: GedDocument) => {
    const url = await resolveDownloadUrl(doc)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else toast.error(t('documents.download_failed'))
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDoc) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await apiService.documents.delete(deleteDoc.id)
      setDeleteDoc(null)
      await refresh()
      toast.success(t('documents.deleted_success'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('documents.delete_failed')
      setDeleteError(msg)
      toast.error(msg)
    } finally {
      setDeleteBusy(false)
    }
  }

  const fetchVersions = async (documentId: string) => {
    setVersionsLoading((prev) => new Set(prev).add(documentId))
    try {
      const response = await apiService.documents.getVersions(documentId)
      const raw = response.data?.data ?? response.data ?? []
      setVersionsByDoc((prev) => ({ ...prev, [documentId]: Array.isArray(raw) ? raw : [] }))
    } catch {
      setVersionsByDoc((prev) => ({ ...prev, [documentId]: [] }))
    } finally {
      setVersionsLoading((prev) => {
        const next = new Set(prev)
        next.delete(documentId)
        return next
      })
    }
  }

  const toggleExpand = (doc: GedDocument) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(doc.id)) next.delete(doc.id)
      else {
        next.add(doc.id)
        if (!versionsByDoc[doc.id]) void fetchVersions(doc.id)
      }
      return next
    })
  }

  const handleVersionDownload = async (documentId: string, versionId: string) => {
    try {
      const response = await apiService.documents.getVersionDownload(documentId, versionId)
      const data = response.data?.data ?? response.data ?? {}
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch {
      // no-op — a failed mint just means no window opens
    }
  }

  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const handleVersionRestore = async (documentId: string, versionId: string) => {
    setRestoringVersionId(versionId)
    try {
      await apiService.documents.restoreVersion(documentId, versionId)
      // A rollback creates a NEW current version — refresh both the row and its
      // cached version list so the new version and reset OCR status show up.
      setVersionsByDoc((prev) => {
        const { [documentId]: _drop, ...rest } = prev
        return rest
      })
      await fetchVersions(documentId)
      await refresh()
      toast.success(t('documents.rollback_success'))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('documents.action_failed'))
    } finally {
      setRestoringVersionId(null)
    }
  }

  const [retryingOcrId, setRetryingOcrId] = useState<string | null>(null)
  const handleRetryOcr = async (documentId: string) => {
    setRetryingOcrId(documentId)
    try {
      await apiService.documents.retryOcr(documentId)
      await refresh()
      toast.success(t('documents.retry_ocr_success'))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('documents.action_failed'))
    } finally {
      setRetryingOcrId(null)
    }
  }

  const handleDeleteVersionConfirm = async () => {
    if (!deleteVersionTarget) return
    setDeleteVersionBusy(true)
    setDeleteVersionError(null)
    try {
      const response = await apiService.documents.deleteVersion(deleteVersionTarget.doc.id, deleteVersionTarget.version.id)
      const data = response.data?.data ?? response.data ?? {}
      const docId = deleteVersionTarget.doc.id
      setDeleteVersionTarget(null)
      if (data.documentDeleted) {
        setExpandedIds((prev) => {
          const next = new Set(prev)
          next.delete(docId)
          return next
        })
        setVersionsByDoc((prev) => {
          const { [docId]: _removed, ...rest } = prev
          return rest
        })
      } else {
        await fetchVersions(docId)
      }
      await refresh()
      toast.success(t('documents.action_success'))
    } catch (err: any) {
      setDeleteVersionError(err?.response?.data?.message || err?.message || t('documents.delete_version_failed'))
    } finally {
      setDeleteVersionBusy(false)
    }
  }

  const categoryLabel = (value: string) => categoryOptions.find((option) => option.value === value)?.label || value
  // Mirrors the backend canView(): role rank meets the tier, OR the caller is
  // the uploader (users always see their own uploads regardless of tier).
  const canViewDoc = (doc: GedDocument) =>
    doc.createdBy === user?.id ||
    (ROLE_RANK[user?.role ?? 'officer'] ?? 0) >= (ROLE_RANK[doc.visibleToRole ?? 'officer'] ?? 0)
  // Mirrors the backend's canEdit(): only the uploader or an admin may edit.
  const canEditDoc = (doc: GedDocument) => isAdmin || doc.createdBy === user?.id

  const renderSortableHeader = (label: string, column: DocumentSortBy) => {
    const isActive = sortBy === column
    return (
      <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        <TableSortLabel
          active={isActive}
          direction={isActive ? sortOrder : 'asc'}
          onClick={() => {
            const nextOrder = isActive && sortOrder === 'asc' ? 'desc' : 'asc'
            updateFilters({ sortBy: column, sortOrder: nextOrder })
          }}
        >
          {label}
        </TableSortLabel>
      </TableCell>
    )
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allOnPageSelected = documents.length > 0 && documents.every((doc) => selectedIds.has(doc.id))
  const someOnPageSelected = documents.some((doc) => selectedIds.has(doc.id))

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        documents.forEach((doc) => next.delete(doc.id))
      } else {
        documents.forEach((doc) => next.add(doc.id))
      }
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkArchive = async () => {
    setBulkBusy(true)
    setBulkError(null)
    try {
      await apiService.documents.bulkArchive(Array.from(selectedIds))
      clearSelection()
      await refresh()
      toast.success(t('documents.archived_success'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('documents.bulk_action_failed')
      setBulkError(msg)
      toast.error(msg)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkUnarchive = async () => {
    setBulkBusy(true)
    setBulkError(null)
    try {
      await apiService.documents.bulkUnarchive(Array.from(selectedIds))
      clearSelection()
      await refresh()
      toast.success(t('documents.restored_success'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('documents.bulk_action_failed')
      setBulkError(msg)
      toast.error(msg)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkTagConfirm = async () => {
    const tag = bulkTagValue.trim()
    if (!tag) return
    setBulkBusy(true)
    setBulkError(null)
    try {
      await apiService.documents.bulkAddTag(Array.from(selectedIds), tag)
      setBulkTagDialogOpen(false)
      setBulkTagValue('')
      clearSelection()
      await refresh()
      toast.success(t('documents.action_success'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('documents.bulk_action_failed')
      setBulkError(msg)
      toast.error(msg)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkPermissionConfirm = async () => {
    setBulkBusy(true)
    setBulkError(null)
    try {
      await apiService.documents.bulkSetVisibleToRole(Array.from(selectedIds), bulkPermissionValue)
      setBulkPermissionDialogOpen(false)
      clearSelection()
      await refresh()
      toast.success(t('documents.action_success'))
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('documents.bulk_action_failed')
      setBulkError(msg)
      toast.error(msg)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleSaveCurrentView = () => {
    const name = saveViewName.trim()
    if (!name) return
    const { page: _page, pageSize: _pageSize, ...rest } = filters
    saveView(name, rest)
    setSaveViewName('')
    setSaveViewDialogOpen(false)
  }

  return (
    <Stack spacing={4} sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.5 }}>
            {t('documents.center_title')}
          </Typography>
          <Typography color="text.secondary">{t('documents.center_subtitle')}</Typography>
        </Box>
        <Button variant="primary" size="sm" icon={<AddRoundedIcon sx={{ fontSize: 18 }} />} onClick={() => setUploadOpen(true)}>
          {t('documents.upload_document')}
        </Button>
      </Box>

      {/* ── Stat strip ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading && documents.length === 0 ? (
          <MotionBox
            key="skeleton-stats"
            variants={listParent}
            initial="initial"
            animate="animate"
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}
          >
            {[0, 1, 2, 3].map((i) => (
              <motion.div key={i} variants={listChild}><StatCardSkeleton /></motion.div>
            ))}
          </MotionBox>
        ) : (
          <MotionBox
            key="live-stats"
            variants={listParent}
            initial="initial"
            animate="animate"
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}
          >
            <StatCard
              icon={<FolderRoundedIcon />}
              label={t('documents.total_documents')}
              value={total}
              trend="neutral"
              trendValue={t('documents.across_all_pages')}
              intent="info"
            />
            <StatCard
              icon={<HourglassTopRoundedIcon />}
              label={t('documents.pending_ocr')}
              value={ocrBreakdown.pending + ocrBreakdown.processing}
              trend="neutral"
              trendValue={t('documents.on_this_page')}
              intent="warning"
            />
            <StatCard
              icon={<CheckCircleRoundedIcon />}
              label={t('documents.completed_ocr')}
              value={ocrBreakdown.completed}
              trend="neutral"
              trendValue={t('documents.on_this_page')}
              intent="success"
            />
            <StatCard
              icon={<ErrorOutlineRoundedIcon />}
              label={t('documents.failed_ocr')}
              value={ocrBreakdown.failed}
              trend="neutral"
              trendValue={t('documents.on_this_page')}
              intent="danger"
            />
          </MotionBox>
        )}
      </AnimatePresence>

      {/* ── Quick filters ──────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        {presets.map((preset) => (
          <Chip
            key={preset.key}
            label={preset.label}
            size="small"
            variant="outlined"
            clickable
            onClick={() => applyFilterSet(preset.filters as DocumentSearchParams)}
          />
        ))}
        {savedViews.map((view) => (
          <Chip
            key={view.id}
            label={view.name}
            size="small"
            color="primary"
            variant="outlined"
            onClick={() => applyFilterSet(view.filters)}
            onDelete={() => removeView(view.id)}
          />
        ))}
        {activeFilterCount > 0 && (
          <Tooltip title={t('documents.save_current_filters')}>
            <IconButton size="small" onClick={() => setSaveViewDialogOpen(true)}>
              <BookmarkAddRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* ── Search & filters ───────────────────────────────────────────────── */}
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('documents.filters')}</Typography>
            {activeFilterCount > 0 && (
              <Chip size="small" color="primary" label={`${activeFilterCount} active`} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
            )}
          </Stack>
          {activeFilterCount > 0 && (
            <Button variant="secondary" size="sm" onClick={clearFilters}>{t('documents.clear_filters')}</Button>
          )}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 2 }}>
          <TextField
            size="small"
            label={t('documents.search_documents')}
            placeholder={t('documents.search_documents_hint')}
            value={filters.q || ''}
            onChange={(e) => updateFilters({ q: e.target.value })}
            sx={{ gridColumn: { lg: 'span 2' }, bgcolor: 'background.paper' }}
          />
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>{t('documents.category')}</InputLabel>
            <Select
              label={t('documents.category')}
              value={filters.category || 'all'}
              onChange={(e) => updateFilters({ category: e.target.value === 'all' ? undefined : (e.target.value as any) })}
            >
              <MenuItem value="all">{t('documents.all_types')}</MenuItem>
              {categoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>{t('documents.owner_type')}</InputLabel>
            <Select
              label={t('documents.owner_type')}
              value={filters.ownerType || 'all'}
              onChange={(e) => {
                const next = e.target.value === 'all' ? undefined : (e.target.value as any)
                // The Accident select below only makes sense when linked to an
                // accident — drop any previously chosen accident otherwise, so
                // a hidden ownerId filter doesn't silently zero out results.
                updateFilters({ ownerType: next, ownerId: next === 'accident' ? filters.ownerId : undefined })
              }}
            >
              <MenuItem value="all">{t('documents.all_owners')}</MenuItem>
              <MenuItem value="accident">{t('documents.owner_accident')}</MenuItem>
              <MenuItem value="officer">{t('documents.owner_officer')}</MenuItem>
            </Select>
          </FormControl>
          {filters.ownerType === 'accident' && (
            <Autocomplete
              size="small"
              options={accidentOptions}
              value={accidentOptions.find((o) => o.id === filters.ownerId) ?? null}
              onChange={(_, value) => updateFilters({ ownerId: value?.id || undefined })}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField {...params} label={t('documents.search_accident')} sx={{ bgcolor: 'background.paper' }} />
              )}
            />
          )}
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>{t('documents.ocr_status')}</InputLabel>
            <Select
              label={t('documents.ocr_status')}
              value={filters.ocrStatus || 'all'}
              onChange={(e) => updateFilters({ ocrStatus: e.target.value === 'all' ? undefined : (e.target.value as any) })}
            >
              <MenuItem value="all">{t('documents.all_statuses')}</MenuItem>
              <MenuItem value="pending">{t('documents.ocr_pending')}</MenuItem>
              <MenuItem value="processing">{t('documents.ocr_processing')}</MenuItem>
              <MenuItem value="completed">{t('documents.ocr_completed')}</MenuItem>
              <MenuItem value="failed">{t('documents.ocr_failed')}</MenuItem>
            </Select>
          </FormControl>
          <DateRangePickerField
            label={t('documents.date_range')}
            startDate={filters.dateFrom}
            endDate={filters.dateTo}
            onChange={(dateFrom, dateTo) => updateFilters({ dateFrom, dateTo })}
          />
          {isAdmin && (
            <Autocomplete
              size="small"
              options={createdByOptions}
              loading={createdByLoading}
              value={createdByOption}
              onChange={(_, value) => {
                setCreatedByOption(value)
                updateFilters({ createdBy: value?.id || undefined })
              }}
              onInputChange={(_, value) => setCreatedByQuery(value)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField {...params} label={t('documents.col_created_by')} sx={{ bgcolor: 'background.paper' }} />
              )}
            />
          )}
          {isAdmin && (
            <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
              <InputLabel>{t('documents.col_archived')}</InputLabel>
              <Select
                label={t('documents.col_archived')}
                value={filters.archived ? 'yes' : 'no'}
                onChange={(e) => updateFilters({ archived: e.target.value === 'yes' || undefined })}
              >
                <MenuItem value="no">{t('common.no')}</MenuItem>
                <MenuItem value="yes">{t('common.yes')}</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      </Card>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      {bulkError && (
        <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setBulkError(null)}>
          {bulkError}
        </Alert>
      )}

      {/* ── Bulk action bar ────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <Card sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', bgcolor: alpha(theme.palette.primary.main, 0.05), borderColor: alpha(theme.palette.primary.main, 0.3) }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {t('documents.n_selected').replace('{count}', String(selectedIds.size))}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={clearSelection} disabled={bulkBusy}>{t('common.cancel')}</Button>
          <Button variant="secondary" size="sm" icon={<LocalOfferRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setBulkTagDialogOpen(true)} disabled={bulkBusy}>
            {t('documents.add_tag')}
          </Button>
          {isAdmin && (
            <Button variant="secondary" size="sm" icon={<LockRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setBulkPermissionDialogOpen(true)} disabled={bulkBusy}>
              {t('documents.manage_permission')}
            </Button>
          )}
          {filters.archived ? (
            <Button variant="primary" size="sm" icon={<UnarchiveRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => void handleBulkUnarchive()} loading={bulkBusy}>
              {t('documents.restore_selected')}
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => void handleBulkArchive()} loading={bulkBusy}>
              {t('documents.archive_selected')}
            </Button>
          )}
        </Card>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('documents.center_title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('documents.results_count').replace('{count}', String(total))}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={t('common.refresh')}>
              <span>
                <IconButton aria-label={t('common.refresh')} onClick={() => refresh()} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {/* Refetch indicator: shown when reloading over existing rows (filter/
            page/sort change) so a slow request doesn't look frozen or show
            stale data silently. First load uses skeletons below instead. */}
        {loading && documents.length > 0 && <LinearProgress sx={{ height: 2 }} />}

        {isMobile ? (
          /* ── Mobile: card layout ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
            {loading && documents.length === 0 ? (
              [0, 1, 2, 3].map((i) => (
                <Box key={i} sx={{ height: 110, borderRadius: 2, bgcolor: alpha(theme.palette.action.active, 0.05) }} />
              ))
            ) : documents.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>{t('documents.no_documents_found')}</Box>
            ) : (
              documents.map((doc) => {
                const restrictedLocked = !canViewDoc(doc)
                return (
                  <Box key={doc.id} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, p: 1.75 }}>
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Checkbox size="small" checked={selectedIds.has(doc.id)} onChange={() => toggleSelected(doc.id)} sx={{ mt: -0.5, ml: -1 }} />
                      <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.text.secondary, 0.08), color: 'text.secondary', flexShrink: 0 }}>
                        <DocumentTypeIcon mimeType={doc.mimeType} filename={doc.filename} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }} noWrap title={doc.filename}>{doc.filename}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatBytes(doc.size)} · {doc.ownerType === 'accident' ? t('documents.owner_accident') : t('documents.owner_officer')}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                          {doc.categories.map((cat) => (
                            <Chip key={cat} size="small" variant="outlined" label={categoryLabel(cat)} />
                          ))}
                          <Badge size="sm" variant={doc.ocrStatus ? OCR_BADGE_VARIANT[doc.ocrStatus] : 'default'} label={doc.ocrStatus ? t(`documents.ocr_${doc.ocrStatus}`) : t('documents.not_started')} />
                          {doc.visibleToRole && doc.visibleToRole !== 'officer' && (
                            <Chip
                              size="small"
                              color={VISIBLE_TO_ROLE_META[doc.visibleToRole]?.color ?? 'default'}
                              icon={<LockRoundedIcon sx={{ fontSize: 14 }} />}
                              label={t(VISIBLE_TO_ROLE_META[doc.visibleToRole]?.labelKey ?? 'admin_accounts.role_admin')}
                            />
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button variant="secondary" size="sm" icon={<VisibilityRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setPreviewDoc(doc)}>
                        {t('documents.preview')}
                      </Button>
                      <Button variant="secondary" size="sm" icon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => void handleDownload(doc)} disabled={restrictedLocked}>
                        {t('documents.download')}
                      </Button>
                      {canEditDoc(doc) && (
                        <Button variant="secondary" size="sm" icon={<EditRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setEditDoc(doc)}>
                          {t('common.edit')}
                        </Button>
                      )}
                      {canEditDoc(doc) && (
                        <Button variant="secondary" size="sm" icon={<NoteAddRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setAddVersionDoc(doc)}>
                          {t('documents.add_version')}
                        </Button>
                      )}
                      {canEditDoc(doc) && doc.ocrStatus === 'failed' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<AutorenewRoundedIcon sx={{ fontSize: 16 }} />}
                          onClick={() => void handleRetryOcr(doc.id)}
                          disabled={retryingOcrId === doc.id}
                        >
                          {t('documents.retry_ocr')}
                        </Button>
                      )}
                      {canEditDoc(doc) && (
                        <Button variant="danger" size="sm" icon={<DeleteForeverRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => setDeleteDoc(doc)}>
                          {t('common.delete')}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                )
              })
            )}
          </Box>
        ) : (
          /* ── Desktop: table ── */
          <Box sx={{ overflowX: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead sx={{ bgcolor: alpha(theme.palette.action.active, 0.02) }}>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      indeterminate={someOnPageSelected && !allOnPageSelected}
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      disabled={documents.length === 0}
                    />
                  </TableCell>
                  {renderSortableHeader(t('documents.col_file'), 'filename')}
                  {renderSortableHeader(t('documents.col_accident'), 'accidentReference')}
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{t('documents.col_category')}</TableCell>
                  {renderSortableHeader(t('documents.col_created'), 'createdAt')}
                  {renderSortableHeader(t('documents.col_permission'), 'visibleToRole')}
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              {loading && documents.length === 0 ? (
                <TableBody>
                  {[0, 1, 2, 3, 4].map((i) => <TableRowSkeleton key={i} index={i} />)}
                </TableBody>
              ) : documents.length === 0 ? (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 8, border: 0 }}>
                      <Stack alignItems="center" spacing={1.5}>
                        <DescriptionOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{t('documents.no_documents_found')}</Typography>
                        {activeFilterCount > 0 && (
                          <>
                            <Typography variant="body2" color="text.secondary">{t('documents.no_documents_hint')}</Typography>
                            <Button variant="secondary" size="sm" onClick={clearFilters}>{t('documents.clear_filters')}</Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                </TableBody>
              ) : (
                <TableBody>
                  {documents.map((doc) => {
                    const restrictedLocked = !canViewDoc(doc)
                    const hasMultipleVersions = (doc.currentVersion ?? 1) > 1
                    const isExpanded = expandedIds.has(doc.id)
                    return (
                    <Fragment key={doc.id}>
                      <TableRow selected={selectedIds.has(doc.id)} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }, transition: 'background-color 0.15s ease' }}>
                        <TableCell padding="checkbox">
                          {hasMultipleVersions && (
                            <Tooltip title={isExpanded ? t('documents.collapse_versions') : t('documents.expand_versions')} arrow>
                              <IconButton size="small" onClick={() => toggleExpand(doc)}>
                                {isExpanded ? <KeyboardArrowDownRoundedIcon fontSize="small" /> : <KeyboardArrowRightRoundedIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selectedIds.has(doc.id)} onChange={() => toggleSelected(doc.id)} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.text.secondary, 0.08), color: 'text.secondary', flexShrink: 0 }}>
                              <DocumentTypeIcon mimeType={doc.mimeType} filename={doc.filename} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.filename}>
                                  {doc.filename}
                                </Typography>
                                {doc.visibleToRole && doc.visibleToRole !== 'officer' && (
                                  <Tooltip title={t('documents.restricted_admin_only')} arrow>
                                    <LockRoundedIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0 }} />
                                  </Tooltip>
                                )}
                                {doc.archivedAt && (
                                  <Chip size="small" variant="outlined" label={t('documents.archived')} sx={{ height: 18, fontSize: 10 }} />
                                )}
                                {(doc.currentVersion ?? 1) > 1 && (
                                  <Tooltip title={t('documents.history')} arrow>
                                    <Chip size="small" variant="outlined" label={`v${doc.currentVersion}`} sx={{ height: 18, fontSize: 10 }} />
                                  </Tooltip>
                                )}
                              </Stack>
                              {doc.description && (
                                <Tooltip title={doc.description} arrow>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {doc.description}
                                  </Typography>
                                </Tooltip>
                              )}
                              {doc.tags.length > 0 && (
                                <Stack direction="row" spacing={0.5} sx={{ mt: 0.25, flexWrap: 'wrap' }}>
                                  {doc.tags.slice(0, 3).map((tag) => (
                                    <Chip key={tag} size="small" variant="outlined" label={tag} sx={{ height: 18, fontSize: 10 }} />
                                  ))}
                                </Stack>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {doc.ownerType === 'accident' ? (doc.accidentReference || t('documents.owner_accident')) : t('documents.owner_officer')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {doc.categories.map((cat) => (
                              <Chip key={cat} size="small" variant="outlined" label={categoryLabel(cat)} />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{doc.createdByName || '—'}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatDate(doc.createdAt)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={VISIBLE_TO_ROLE_META[doc.visibleToRole ?? 'officer']?.color ?? 'default'}
                            variant={doc.visibleToRole && doc.visibleToRole !== 'officer' ? 'filled' : 'outlined'}
                            icon={doc.visibleToRole && doc.visibleToRole !== 'officer' ? <LockRoundedIcon sx={{ fontSize: 14 }} /> : undefined}
                            label={t(VISIBLE_TO_ROLE_META[doc.visibleToRole ?? 'officer']?.labelKey ?? 'admin_accounts.role_officer')}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title={t('documents.preview')} arrow>
                              <IconButton size="small" onClick={() => setPreviewDoc(doc)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                                <VisibilityRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={restrictedLocked ? t('documents.restricted_admin_only') : t('documents.download')} arrow>
                              <span>
                                <IconButton size="small" onClick={() => void handleDownload(doc)} disabled={restrictedLocked} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                                  <DownloadRoundedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {canEditDoc(doc) && (
                              <Tooltip title={t('common.edit')} arrow>
                                <IconButton size="small" onClick={() => setEditDoc(doc)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canEditDoc(doc) && (
                              <Tooltip title={t('documents.add_version')} arrow>
                                <IconButton size="small" onClick={() => setAddVersionDoc(doc)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                                  <NoteAddRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canEditDoc(doc) && doc.ocrStatus === 'failed' && (
                              <Tooltip title={t('documents.retry_ocr')} arrow>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => void handleRetryOcr(doc.id)}
                                    disabled={retryingOcrId === doc.id}
                                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                                  >
                                    <AutorenewRoundedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                            {canEditDoc(doc) && (
                              <Tooltip title={t('common.delete')} arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteDoc(doc)}
                                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', color: 'error.main' }}
                                >
                                  <DeleteForeverRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {doc.ownerType === 'accident' && (
                              <Tooltip title={t('documents.view_incident')} arrow>
                                <IconButton size="small" onClick={() => handleOpenOwner(doc)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                                  <OpenInNewRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} sx={{ p: 0, bgcolor: alpha(theme.palette.action.active, 0.02) }}>
                            <Box sx={{ pl: 7, pr: 2, py: 1.5 }}>
                              {versionsLoading.has(doc.id) ? (
                                <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
                              ) : (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('documents.col_file')}</TableCell>
                                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('documents.col_note')}</TableCell>
                                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('documents.col_file_type')}</TableCell>
                                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('documents.col_version')}</TableCell>
                                      <TableCell align="right" />
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {(versionsByDoc[doc.id] ?? []).map((version) => (
                                      <TableRow key={version.id}>
                                        <TableCell>{version.filename}</TableCell>
                                        <TableCell sx={{ color: 'text.secondary' }}>{version.note || '—'}</TableCell>
                                        <TableCell sx={{ color: 'text.secondary' }}>{version.mimeType}</TableCell>
                                        <TableCell>v{version.versionNumber}</TableCell>
                                        <TableCell align="right">
                                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                            <Tooltip title={t('documents.download')} arrow>
                                              <IconButton size="small" onClick={() => void handleVersionDownload(doc.id, version.id)}>
                                                <DownloadRoundedIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                            {canEditDoc(doc) && version.versionNumber !== doc.currentVersion && (
                                              <Tooltip title={t('documents.rollback_to_version')} arrow>
                                                <span>
                                                  <IconButton
                                                    size="small"
                                                    onClick={() => void handleVersionRestore(doc.id, version.id)}
                                                    disabled={restoringVersionId === version.id}
                                                  >
                                                    <RestoreRoundedIcon fontSize="small" />
                                                  </IconButton>
                                                </span>
                                              </Tooltip>
                                            )}
                                            {canEditDoc(doc) && (
                                              <Tooltip title={t('common.delete')} arrow>
                                                <IconButton size="small" onClick={() => setDeleteVersionTarget({ doc, version })} sx={{ color: 'error.main' }}>
                                                  <DeleteForeverRoundedIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            )}
                                          </Stack>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                    )
                  })}
                </TableBody>
              )}
            </Table>
          </Box>
        )}

        <TablePagination
          component="div"
          count={total}
          page={Math.max(0, page - 1)}
          onPageChange={(_, newPage) => updateFilters({ page: newPage + 1 })}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => updateFilters({ pageSize: parseInt(e.target.value, 10), page: 1 })}
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Card>

      {/* ── Preview dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={Boolean(previewDoc)}
        onClose={() => { setPreviewDoc(null); setPreviewTab(0) }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap title={previewDoc?.filename}>
              {previewDoc?.filename}
            </Typography>
            {previewDoc && (
              <Typography variant="body2" color="text.secondary">
                {previewDoc.categories.map(categoryLabel).join(', ')} · {formatBytes(previewDoc.size)}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => { setPreviewDoc(null); setPreviewTab(0) }} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <Tabs value={previewTab} onChange={(_, value) => setPreviewTab(value)} sx={{ px: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Tab label={t('documents.details')} />
          <Tab label={t('documents.history')} />
        </Tabs>
        <DialogContent sx={{ pt: 2 }}>
          {previewDoc && previewTab === 0 && (
            <Stack spacing={1.5}>
              <DocumentPreview
                filename={previewDoc.filename}
                mimeType={previewDoc.mimeType}
                previewUrl={previewFileUrl ?? undefined}
                loading={previewFileLoading}
                pageImageUrls={previewPages ?? undefined}
                pagesLoading={previewPagesLoading}
                height={560}
                onOpenFile={() => void handleDownload(previewDoc)}
                restricted={Boolean(previewDoc.visibleToRole && previewDoc.visibleToRole !== 'officer')}
                canView={canViewDoc(previewDoc)}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Badge
                  size="sm"
                  variant={previewDoc.ocrStatus ? OCR_BADGE_VARIANT[previewDoc.ocrStatus] : 'default'}
                  label={previewDoc.ocrStatus ? t(`documents.ocr_${previewDoc.ocrStatus}`) : t('documents.not_started')}
                />
                {canEditDoc(previewDoc) && previewDoc.ocrStatus === 'failed' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<AutorenewRoundedIcon sx={{ fontSize: 16 }} />}
                    onClick={() => void handleRetryOcr(previewDoc.id)}
                    disabled={retryingOcrId === previewDoc.id}
                  >
                    {t('documents.retry_ocr')}
                  </Button>
                )}
                {previewDoc.visibleToRole && previewDoc.visibleToRole !== 'officer' && (
                  <Chip
                    size="small"
                    color={VISIBLE_TO_ROLE_META[previewDoc.visibleToRole]?.color ?? 'default'}
                    icon={<LockRoundedIcon sx={{ fontSize: 14 }} />}
                    label={t(VISIBLE_TO_ROLE_META[previewDoc.visibleToRole]?.labelKey ?? 'admin_accounts.role_admin')}
                  />
                )}
                {previewDoc.tags.map((tag) => (
                  <Chip key={tag} size="small" variant="outlined" label={tag} />
                ))}
              </Stack>
              {previewDoc.description && (
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('documents.col_note')}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.25 }}>{previewDoc.description}</Typography>
                </Box>
              )}
              {/* Document facts (RA-1361): uploader, dates, current version. */}
              <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('documents.col_created_by')}</Typography>
                  <Typography variant="body2">{previewDoc.createdByName || previewDoc.createdBy || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('documents.col_created')}</Typography>
                  <Typography variant="body2">{previewDoc.createdAt ? new Date(previewDoc.createdAt).toLocaleString() : '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('documents.updated_at')}</Typography>
                  <Typography variant="body2">{previewDoc.updatedAt ? new Date(previewDoc.updatedAt).toLocaleString() : '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('documents.col_version')}</Typography>
                  <Typography variant="body2">v{previewDoc.currentVersion ?? 1}</Typography>
                </Box>
                {canViewDoc(previewDoc) && previewDoc.metadata?.wordCount != null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('documents.word_count')}</Typography>
                    <Typography variant="body2">{previewDoc.metadata.wordCount}</Typography>
                  </Box>
                )}
              </Stack>
              {/* Extracted keywords (RA-1082). Gated with the same canView as content. */}
              {canViewDoc(previewDoc) && (previewDoc.keywords?.length ?? 0) > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('documents.keywords')}</Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {previewDoc.keywords!.map((k) => (
                      <Chip key={k} size="small" color="primary" variant="outlined" label={k} />
                    ))}
                  </Stack>
                </Box>
              )}
              {previewDoc.extractedText && canViewDoc(previewDoc) && (
                <Box sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, maxHeight: 240, overflow: 'auto' }}>
                  <Typography variant="caption" color="text.secondary">{t('documents.extracted_text')}</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.75 }}>{previewDoc.extractedText}</Typography>
                </Box>
              )}
              <Stack direction="row" spacing={1}>
                <Button variant="primary" size="sm" icon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => void handleDownload(previewDoc)} disabled={!canViewDoc(previewDoc)}>
                  {t('documents.download')}
                </Button>
                {previewDoc.ownerType === 'accident' && (
                  <Button variant="secondary" size="sm" icon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => handleOpenOwner(previewDoc)}>
                    {t('documents.view_incident')}
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
          {previewDoc && previewTab === 1 && <DocumentAuditTrail documentId={previewDoc.id} />}
        </DialogContent>
      </Dialog>

      {/* ── Save filter view dialog ────────────────────────────────────────── */}
      <Dialog open={saveViewDialogOpen} onClose={() => setSaveViewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('documents.save_current_filters')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            label={t('documents.view_name')}
            value={saveViewName}
            onChange={(e) => setSaveViewName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" size="sm" onClick={() => setSaveViewDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSaveCurrentView} disabled={!saveViewName.trim()}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk tag dialog ────────────────────────────────────────────────── */}
      <Dialog open={bulkTagDialogOpen} onClose={() => setBulkTagDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('documents.add_tag')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            label={t('documents.tags')}
            value={bulkTagValue}
            onChange={(e) => setBulkTagValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" size="sm" onClick={() => setBulkTagDialogOpen(false)} disabled={bulkBusy}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={() => void handleBulkTagConfirm()} loading={bulkBusy} disabled={!bulkTagValue.trim()}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkPermissionDialogOpen} onClose={() => setBulkPermissionDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('documents.manage_permission')}</DialogTitle>
        <DialogContent>
          <FormLabel id="bulk-permission-label" sx={{ fontSize: 13 }}>
            {t('documents.n_selected').replace('{count}', String(selectedIds.size))}
          </FormLabel>
          <RadioGroup
            aria-labelledby="bulk-permission-label"
            value={bulkPermissionValue}
            onChange={(e) => setBulkPermissionValue(e.target.value as 'officer' | 'supervisor' | 'admin')}
          >
            <FormControlLabel value="officer" control={<Radio size="small" />} label={t('admin_accounts.role_officer')} />
            <FormControlLabel value="supervisor" control={<Radio size="small" />} label={t('admin_accounts.role_supervisor')} />
            <FormControlLabel value="admin" control={<Radio size="small" />} label={t('admin_accounts.role_admin')} />
          </RadioGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" size="sm" onClick={() => setBulkPermissionDialogOpen(false)} disabled={bulkBusy}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={() => void handleBulkPermissionConfirm()} loading={bulkBusy}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <UploadDocumentDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={() => void refresh()} />
      <EditDocumentDialog open={Boolean(editDoc)} document={editDoc} onClose={() => setEditDoc(null)} onSaved={() => void refresh()} />
      <AddVersionDialog
        open={Boolean(addVersionDoc)}
        document={addVersionDoc}
        onClose={() => setAddVersionDoc(null)}
        onSaved={() => {
          if (addVersionDoc) void fetchVersions(addVersionDoc.id)
          void refresh()
        }}
      />

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <Dialog open={Boolean(deleteDoc)} onClose={() => (deleteBusy ? undefined : setDeleteDoc(null))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="error" />
          {t('documents.delete_document_title')}
        </DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ borderRadius: 2, mb: 1.5 }}>{deleteError}</Alert>}
          <Alert severity="warning" sx={{ borderRadius: 2, mb: 1.5 }}>
            {t('documents.delete_warning')}
          </Alert>
          <Typography variant="body2">
            {t('documents.delete_confirm_prompt').replace('{filename}', deleteDoc?.filename ?? '')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" size="sm" onClick={() => setDeleteDoc(null)} disabled={deleteBusy}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => void handleDeleteConfirm()} loading={deleteBusy}>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete version confirmation dialog ───────────────────────────── */}
      <Dialog open={Boolean(deleteVersionTarget)} onClose={() => (deleteVersionBusy ? undefined : setDeleteVersionTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="error" />
          {t('documents.delete_version_title')}
        </DialogTitle>
        <DialogContent>
          {deleteVersionError && <Alert severity="error" sx={{ borderRadius: 2, mb: 1.5 }}>{deleteVersionError}</Alert>}
          <Alert severity="warning" sx={{ borderRadius: 2, mb: 1.5 }}>
            {deleteVersionTarget?.version.versionNumber === 1
              ? t('documents.delete_version_1_warning')
              : t('documents.delete_version_warning')}
          </Alert>
          <Typography variant="body2">
            {t('documents.delete_version_confirm_prompt')
              .replace('{version}', String(deleteVersionTarget?.version.versionNumber ?? ''))
              .replace('{filename}', deleteVersionTarget?.version.filename ?? '')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" size="sm" onClick={() => setDeleteVersionTarget(null)} disabled={deleteVersionBusy}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => void handleDeleteVersionConfirm()} loading={deleteVersionBusy}>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
