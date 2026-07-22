import type { IncidentDocumentLifecycleStatus } from './accident'

export type DocumentOwnerType = 'accident' | 'officer'

// Business-domain classification, not file format — a document can belong to
// several at once (e.g. an accident-related invoice is both "accident" and
// "financial").
export type DocumentCategory = 'accident' | 'legal' | 'administrative' | 'financial' | 'report' | 'other'

// Mayan's OCR (Tesseract) language — a document can only be tagged with one,
// so a mixed French/Arabic report is OCR'd accurately in one language only.
export type DocumentLanguage = 'fra' | 'ara' | 'eng'

// Hierarchical: the minimum role required to view a document's content.
// "officer" means everyone; "admin" means admin-only.
export type VisibleToRole = 'officer' | 'supervisor' | 'admin'

export interface GedDocument {
  id: string
  ownerType: DocumentOwnerType
  ownerId: string
  filename: string
  mimeType: string
  size: number
  categories: DocumentCategory[]
  description?: string
  tags: string[]
  status: IncidentDocumentLifecycleStatus
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  archivedAt?: string
  downloadUrl?: string
  previewUrl?: string
  extractedText?: string
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  visibleToRole?: VisibleToRole
  deletedAt?: string
  currentVersion?: number
  // Cached accident reference (e.g. "2611_0042") — only set when ownerType is 'accident'.
  accidentReference?: string
  createdByName?: string
  // OCR-derived (RA-1082): searchable keywords + content metadata.
  keywords?: string[]
  metadata?: DocumentContentMetadata
}

// Derived from OCR text once extraction completes.
export interface DocumentContentMetadata {
  wordCount?: number
  charCount?: number
  language?: string | null
  keywordCount?: number
  extractedAt?: string
}

// Kept in sync with the backend's DOCUMENT_SORT_BY_ENUM (documents.schemas.ts).
export type DocumentSortBy = 'filename' | 'createdAt' | 'currentVersion' | 'archivedAt' | 'visibleToRole' | 'accidentReference' | 'createdBy'

export interface DocumentSearchParams {
  q?: string
  category?: DocumentCategory
  ownerType?: DocumentOwnerType
  ownerId?: string
  tags?: string
  ocrStatus?: GedDocument['ocrStatus']
  dateFrom?: string
  dateTo?: string
  createdBy?: string
  accidentReference?: string
  // Admin-only in effect — the backend ignores this for non-admins.
  archived?: boolean
  sortBy?: DocumentSortBy
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface DocumentSearchResult {
  documents: GedDocument[]
  total: number
  page: number
  pageSize: number
}

export type DocumentAuditAction =
  | 'uploaded'
  | 'replaced'
  | 'archived'
  | 'restored'
  | 'restricted_changed'
  | 'downloaded'
  | 'ocr_completed'
  | 'ocr_failed'
  | 'edited'
  | 'version_deleted'
  | 'tagged'
  | 'ocr_language_retry'
  | 'ocr_retry'

export interface DocumentVersionInfo {
  id: string
  versionNumber: number
  filename: string
  mimeType: string
  size: number
  note?: string
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  extractedText?: string
  createdBy: string
  createdAt: string
}

export interface DocumentAuditEvent {
  id: string
  documentId: string
  action: DocumentAuditAction
  actorId?: string
  actorName?: string
  timestamp: string
  note?: string
}

export interface DocumentUploadRequest {
  ownerType: DocumentOwnerType
  ownerId: string
  filename: string
  mimeType: string
  size: number
  categories: DocumentCategory[]
  description?: string
  tags?: string[]
  visibleToRole?: VisibleToRole
}

export interface DocumentUploadConfirmRequest extends DocumentUploadRequest {
  clientId: string
  key: string
  language?: DocumentLanguage
}

// Same fields exposed at creation; all optional since editing can touch just
// one of them. `file` is only set when the user chose to replace the bytes
// (staged the same request-upload -> PUT way as creation) — its presence is
// what makes the backend re-run OCR.
export interface DocumentEditRequest {
  filename?: string
  description?: string
  categories?: DocumentCategory[]
  visibleToRole?: VisibleToRole
  ownerType?: DocumentOwnerType
  ownerId?: string
  file?: { key: string; mimeType: string; size: number }
}
