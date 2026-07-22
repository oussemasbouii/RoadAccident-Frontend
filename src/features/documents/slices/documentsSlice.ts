import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiService } from '@/services/api'
import type { DocumentSearchParams, GedDocument } from '@/types/document'

interface DocumentsState {
  list: GedDocument[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
}

const initialState: DocumentsState = {
  list: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
}

const unwrapPayload = (payload: any) => payload?.data?.data ?? payload?.data ?? payload ?? {}

const normalizeTags = (tags: unknown): string[] => {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean)
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return []
}

function toGedDocument(raw: any): GedDocument {
  return {
    id: String(raw?.id ?? raw?._id ?? raw?.documentId ?? crypto.randomUUID()),
    ownerType: (raw?.ownerType ?? (raw?.accidentId ? 'accident' : raw?.officerId ? 'officer' : 'accident')) as GedDocument['ownerType'],
    ownerId: String(raw?.ownerId ?? raw?.accidentId ?? raw?.officerId ?? ''),
    filename: String(raw?.filename ?? raw?.name ?? raw?.originalName ?? 'document'),
    mimeType: String(raw?.mimeType ?? raw?.mime_type ?? 'application/octet-stream'),
    size: Number(raw?.size ?? raw?.fileSize ?? 0),
    categories: Array.isArray(raw?.categories) ? raw.categories : [],
    description: raw?.description ?? raw?.notes ?? '',
    tags: normalizeTags(raw?.tags),
    status: raw?.status ?? raw?.lifecycleStatus ?? 'available',
    createdAt: raw?.createdAt ?? raw?.created_at,
    createdBy: raw?.createdBy ?? raw?.created_by,
    updatedAt: raw?.updatedAt ?? raw?.updated_at,
    archivedAt: raw?.archivedAt ?? raw?.archived_at,
    downloadUrl: raw?.downloadUrl ?? raw?.download_url ?? raw?.url ?? raw?.fileUrl,
    previewUrl: raw?.previewUrl ?? raw?.preview_url,
    extractedText: raw?.extractedText ?? raw?.ocrText,
    ocrStatus: raw?.ocrStatus ?? raw?.ocr_status,
    visibleToRole: raw?.visibleToRole ?? raw?.visible_to_role ?? 'officer',
    deletedAt: raw?.deletedAt ?? raw?.deleted_at,
    currentVersion: Number(raw?.currentVersion ?? raw?.current_version ?? 1),
    accidentReference: raw?.accidentReference ?? raw?.accident_reference,
    createdByName: raw?.createdByName ?? raw?.created_by_name,
    keywords: Array.isArray(raw?.keywords) ? raw.keywords : [],
    metadata: raw?.metadata ?? undefined,
  }
}

export const searchDocuments = createAsyncThunk(
  'documents/search',
  async (params: DocumentSearchParams, { rejectWithValue }) => {
    try {
      const response = await apiService.documents.search(params)
      return unwrapPayload(response.data)
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to search documents')
    }
  }
)

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    updateDocumentOcrStatus: (state, action: PayloadAction<any>) => {
      const incoming = toGedDocument(action.payload)
      const index = state.list.findIndex((doc) => doc.id === incoming.id)
      if (index !== -1) {
        state.list[index] = { ...state.list[index], ...incoming }
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(searchDocuments.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(searchDocuments.fulfilled, (state, action) => {
      state.loading = false
      const payload = action.payload || {}
      const rawList = Array.isArray(payload) ? payload : Array.isArray(payload.documents) ? payload.documents : Array.isArray(payload.data) ? payload.data : []
      state.list = rawList.map(toGedDocument)
      state.total = payload.total ?? state.list.length
      state.page = payload.page ?? 1
      state.pageSize = payload.pageSize ?? state.pageSize
    })
    builder.addCase(searchDocuments.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
  },
})

export const { clearError, updateDocumentOcrStatus } = documentsSlice.actions
export default documentsSlice.reducer
