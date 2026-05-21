import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiService } from '@/services/api'
import type {
  AttachmentFileTypeCode,
  IncidentDocument,
  IncidentDocumentLifecycleStatus,
  IncidentDocumentTypeCode,
  IncidentDocumentUpdateRequest,
} from '@/types/accident'

type IncidentDocumentMetadata = {
  documentType: IncidentDocumentTypeCode | string
  description?: string
  tags?: string[]
}

type UploadDocResult = {
  documents: IncidentDocument[]
}

const STORAGE_PREFIX = 'roadaccident:incident-documents:'

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

const resolveFileType = (file: File): AttachmentFileTypeCode => {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF'
  if (file.type.startsWith('image/')) return 'IMAGE'
  return 'OTHER'
}

const normalizeDocument = (raw: any, accidentId: string): IncidentDocument => {
  const id = String(raw?.id ?? raw?._id ?? raw?.documentId ?? crypto.randomUUID())
  const status = String(raw?.status ?? raw?.lifecycleStatus ?? raw?.uploadStatus ?? 'available').toLowerCase()
  const normalizedStatus: IncidentDocumentLifecycleStatus =
    status === 'uploaded' || status === 'processing' || status === 'archived' || status === 'failed'
      ? status
      : 'available'

  return {
    id,
    accidentId: String(raw?.accidentId ?? raw?.accident_id ?? accidentId),
    filename: String(raw?.filename ?? raw?.name ?? raw?.originalName ?? 'document'),
    mimeType: String(raw?.mimeType ?? raw?.mime_type ?? 'application/octet-stream'),
    size: Number(raw?.size ?? raw?.fileSize ?? 0),
    documentType: String(raw?.documentType ?? raw?.type ?? 'OTHER'),
    description: String(raw?.description ?? raw?.notes ?? ''),
    tags: normalizeTags(raw?.tags),
    status: normalizedStatus,
    createdAt: raw?.createdAt ?? raw?.created_at,
    createdBy: raw?.createdBy ?? raw?.created_by,
    updatedAt: raw?.updatedAt ?? raw?.updated_at,
    archivedAt: raw?.archivedAt ?? raw?.archived_at,
    downloadUrl: raw?.downloadUrl ?? raw?.download_url ?? raw?.url ?? raw?.fileUrl ?? raw?.file_url,
    previewUrl: raw?.previewUrl ?? raw?.preview_url,
    extractedText: raw?.extractedText ?? raw?.ocrText,
    ocrStatus: raw?.ocrStatus ?? raw?.ocr_status,
  }
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as any
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback
}

const getStorageKey = (scopeKey: string) => `${STORAGE_PREFIX}${scopeKey}`

const mergeDocuments = (existing: IncidentDocument[], incoming: IncidentDocument[]) => {
  const byId = new Map<string, IncidentDocument>()
  for (const document of existing) byId.set(document.id, document)
  for (const document of incoming) byId.set(document.id, document)
  return Array.from(byId.values())
}

const readStoredDocuments = (scopeKey: string): IncidentDocument[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(getStorageKey(scopeKey))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => normalizeDocument(item, scopeKey))
  } catch {
    return []
  }
}

const saveStoredDocuments = (scopeKey: string, documents: IncidentDocument[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getStorageKey(scopeKey), JSON.stringify(documents))
}

const createPreviewUrl = (file: File, downloadUrl?: string) => {
  if (downloadUrl) return downloadUrl
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file)
  }
  return undefined
}

export const moveStoredDocuments = (sourceKey: string, targetKey: string) => {
  if (typeof window === 'undefined' || !sourceKey || !targetKey || sourceKey === targetKey) return
  const source = readStoredDocuments(sourceKey)
  const target = readStoredDocuments(targetKey)
  saveStoredDocuments(targetKey, mergeDocuments(target, source))
  window.localStorage.removeItem(getStorageKey(sourceKey))
}

const buildLocalDocument = (
  scopeKey: string,
  file: File,
  metadata: IncidentDocumentMetadata,
  id: string,
  downloadUrl?: string
): IncidentDocument => ({
  id,
  accidentId: scopeKey,
  filename: file.name,
  mimeType: file.type || 'application/octet-stream',
  size: file.size,
  documentType: metadata.documentType,
  description: metadata.description || '',
  tags: metadata.tags || [],
  status: 'available',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  downloadUrl,
  previewUrl: createPreviewUrl(file, downloadUrl),
})

export function useIncidentDocuments(accidentId?: string | null, storageKey?: string | null) {
  const [documents, setDocuments] = useState<IncidentDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accidentKey = accidentId ? String(accidentId) : null
  const scopeKey = storageKey ? String(storageKey) : accidentKey

  const persistDocuments = useCallback(
    (nextDocuments: IncidentDocument[]) => {
      setDocuments(nextDocuments)
      if (scopeKey) {
        saveStoredDocuments(scopeKey, nextDocuments)
      }
    },
    [scopeKey]
  )

  const refresh = useCallback(async () => {
    if (!scopeKey) {
      setDocuments([])
      return []
    }

    const stored = readStoredDocuments(scopeKey)
    if (!accidentKey) {
      setDocuments(stored)
      return stored
    }

    setLoading(true)
    setError(null)
    try {
      const response = await apiService.incidentDocuments.list(accidentKey)
      const payload = unwrapPayload(response.data)
      const remote = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      const normalizedRemote = remote.map((item: any) => normalizeDocument(item, accidentKey))
      const merged = mergeDocuments(stored, normalizedRemote)
      saveStoredDocuments(scopeKey, merged)
      setDocuments(merged)
      return merged
    } catch (err) {
      setDocuments(stored)
      const message = getErrorMessage(err, 'Failed to load incident documents')
      setError(message)
      return stored
    } finally {
      setLoading(false)
    }
  }, [accidentKey, scopeKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const resolveDownloadUrl = useCallback(
    async (documentId: string) => {
      const existing = documents.find((document) => document.id === documentId)
      if (existing?.downloadUrl) return existing.downloadUrl

      try {
        const response = accidentKey
          ? await apiService.incidentDocuments.getDownload(accidentKey, documentId)
          : await apiService.attachments.getDownload(documentId)
        const data = unwrapPayload(response.data)
        const downloadUrl = data?.downloadUrl || data?.path
        if (!downloadUrl) return null

        persistDocuments(
          documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  downloadUrl,
                  previewUrl: document.previewUrl || downloadUrl,
                  updatedAt: new Date().toISOString(),
                }
              : document
          )
        )

        return downloadUrl
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to resolve download URL')
        setError(message)
        return null
      }
    },
    [accidentKey, documents, persistDocuments]
  )

  const requestUpload = useCallback(
    async (file: File, metadata: IncidentDocumentMetadata) => {
      if (!scopeKey) throw new Error('A document scope is required before uploading documents')

      if (!accidentKey) {
        return buildLocalDocument(scopeKey, file, metadata, crypto.randomUUID())
      }

      const requestResp = await apiService.incidentDocuments.requestUpload(accidentKey, {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        documentType: metadata.documentType,
        description: metadata.description,
        tags: metadata.tags,
      })

      const requestData = unwrapPayload(requestResp.data)
      const uploadUrl = requestData.uploadUrl
      const key = requestData.key
      if (!uploadUrl || !key) throw new Error('Upload URL missing')

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      })

      const confirmResp = await apiService.incidentDocuments.confirmUpload(accidentKey, {
        clientId: crypto.randomUUID(),
        key,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        documentType: metadata.documentType,
        description: metadata.description,
        tags: metadata.tags,
      })

      const confirmData = unwrapPayload(confirmResp.data)
      const documentId = String(confirmData?.id || crypto.randomUUID())
      const downloadUrl = confirmData?.path || confirmData?.downloadUrl || (await resolveDownloadUrl(documentId)) || undefined

      return buildLocalDocument(scopeKey, file, metadata, documentId, downloadUrl)
    },
    [accidentKey, resolveDownloadUrl, scopeKey]
  )

  const uploadDocuments = useCallback(
    async (files: File[], metadata: IncidentDocumentMetadata): Promise<UploadDocResult> => {
      if (!scopeKey) throw new Error('A document scope is required before uploading documents')
      if (!files.length) return { documents: [] }

      setUploading(true)
      setError(null)
      try {
        const created: IncidentDocument[] = []
        for (const file of files) {
          if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            throw new Error('Only image and PDF documents are supported for incident documents')
          }
          created.push(await requestUpload(file, metadata))
        }

        persistDocuments(mergeDocuments(created, documents))
        return { documents: created }
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to upload incident documents')
        setError(message)
        throw err
      } finally {
        setUploading(false)
      }
    },
    [documents, persistDocuments, requestUpload, scopeKey]
  )

  const updateDocument = useCallback(
    async (documentId: string, patch: IncidentDocumentUpdateRequest) => {
      if (!scopeKey) throw new Error('A document scope is required before updating documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        if (accidentKey) {
          const response = await apiService.incidentDocuments.update(accidentKey, documentId, patch)
          const updated = normalizeDocument(
            unwrapPayload(response.data) || { id: documentId, accidentId: accidentKey, ...patch },
            accidentKey
          )
          persistDocuments(
            documents.map((document) => (document.id === documentId ? { ...document, ...updated } : document))
          )
          return
        }

        persistDocuments(
          documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  documentType: patch.documentType ?? document.documentType,
                  description: patch.description ?? document.description,
                  tags: patch.tags ?? document.tags,
                  status: patch.status ?? document.status,
                  archivedAt: patch.status === 'archived' ? new Date().toISOString() : document.archivedAt,
                  updatedAt: new Date().toISOString(),
                }
              : document
          )
        )
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to update document metadata')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, documents, persistDocuments, scopeKey]
  )

  const archiveDocument = useCallback(
    async (documentId: string) => {
      if (!scopeKey) throw new Error('A document scope is required before archiving documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        if (accidentKey) {
          await apiService.incidentDocuments.archive(accidentKey, documentId)
        }
        await updateDocument(documentId, { status: 'archived' })
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to archive document')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, scopeKey, updateDocument]
  )

  const removeDocument = useCallback(
    async (documentId: string) => {
      if (!scopeKey) throw new Error('A document scope is required before removing documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        if (accidentKey) {
          await apiService.incidentDocuments.remove(accidentKey, documentId)
        }
        persistDocuments(documents.filter((document) => document.id !== documentId))
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to remove document')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, documents, persistDocuments, scopeKey]
  )

  const replaceDocument = useCallback(
    async (documentId: string, file: File, metadata: IncidentDocumentMetadata) => {
      if (!scopeKey) throw new Error('A document scope is required before replacing documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          throw new Error('Only image and PDF documents are supported for incident documents')
        }

        if (!accidentKey) {
          const next = documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  filename: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  size: file.size,
                  documentType: metadata.documentType,
                  description: metadata.description || '',
                  tags: metadata.tags || [],
                  downloadUrl: undefined,
                  previewUrl: createPreviewUrl(file),
                  updatedAt: new Date().toISOString(),
                }
              : document
          )
          persistDocuments(next)
          return
        }

        const requestResp = await apiService.incidentDocuments.requestUpload(accidentKey, {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          documentType: metadata.documentType,
          description: metadata.description,
          tags: metadata.tags,
        })

        const requestData = unwrapPayload(requestResp.data)
        const uploadUrl = requestData.uploadUrl
        const key = requestData.key
        if (!uploadUrl || !key) throw new Error('Upload URL missing')

        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        })

        const confirmResp = await apiService.incidentDocuments.confirmUpload(accidentKey, {
          clientId: crypto.randomUUID(),
          key,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          documentType: metadata.documentType,
          description: metadata.description,
          tags: metadata.tags,
        })

        const confirmData = unwrapPayload(confirmResp.data)
        const newAttachmentId = String(confirmData?.id || crypto.randomUUID())
        const downloadUrl = confirmData?.path || confirmData?.downloadUrl || (await resolveDownloadUrl(newAttachmentId)) || undefined

        persistDocuments(
          documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  id: newAttachmentId,
                  filename: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  size: file.size,
                  documentType: metadata.documentType,
                  description: metadata.description || '',
                  tags: metadata.tags || [],
                  downloadUrl,
                  previewUrl: downloadUrl,
                  updatedAt: new Date().toISOString(),
                }
              : document
          )
        )
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to replace document')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, documents, persistDocuments, resolveDownloadUrl, scopeKey]
  )

  const selectedDocument = useMemo(() => documents[0] || null, [documents])

  return {
    documents,
    loading,
    uploading,
    savingDocumentId,
    error,
    refresh,
    uploadDocuments,
    updateDocument,
    archiveDocument,
    removeDocument,
    replaceDocument,
    resolveDownloadUrl,
    selectedDocument,
    setDocuments: persistDocuments,
  }
}
