import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiService } from '@/services/api'
import type {
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

export function useIncidentDocuments(accidentId?: string | null) {
  const [documents, setDocuments] = useState<IncidentDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accidentKey = accidentId ? String(accidentId) : null

  const refresh = useCallback(async () => {
    if (!accidentKey) {
      setDocuments([])
      return []
    }

    setLoading(true)
    setError(null)
    try {
      const resp = await apiService.incidentDocuments.list(accidentKey)
      const data = unwrapPayload(resp.data)
      const list = Array.isArray(data) ? data : Array.isArray(data?.documents) ? data.documents : Array.isArray(data?.data) ? data.data : []
      const normalized = list.map((item: any) => normalizeDocument(item, accidentKey))
      setDocuments(normalized)
      return normalized
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to load incident documents')
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [accidentKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requestUpload = useCallback(
    async (file: File, metadata: IncidentDocumentMetadata) => {
      if (!accidentKey) throw new Error('Incident id is required before uploading documents')

      const requestResp = await apiService.incidentDocuments.requestUpload(accidentKey, {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        documentType: metadata.documentType,
        description: metadata.description,
        tags: metadata.tags || [],
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
        tags: metadata.tags || [],
      })

      const confirmData = unwrapPayload(confirmResp.data)
      return normalizeDocument(
        {
          ...confirmData,
          accidentId: accidentKey,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          documentType: metadata.documentType,
          description: metadata.description,
          tags: metadata.tags || [],
        },
        accidentKey
      )
    },
    [accidentKey]
  )

  const uploadDocuments = useCallback(
    async (files: File[], metadata: IncidentDocumentMetadata): Promise<UploadDocResult> => {
      if (!accidentKey) throw new Error('Incident id is required before uploading documents')
      if (!files.length) return { documents: [] }

      setUploading(true)
      setError(null)
      try {
        const created: IncidentDocument[] = []
        for (const file of files) {
          if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            throw new Error('Only image and PDF documents are supported for incident documents')
          }
          created.push(await requestUpload(file, metadata))
        }
        await refresh()
        return { documents: created }
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to upload incident documents')
        setError(message)
        throw err
      } finally {
        setUploading(false)
      }
    },
    [accidentKey, requestUpload, refresh]
  )

  const updateDocument = useCallback(
    async (documentId: string, patch: IncidentDocumentUpdateRequest) => {
      if (!accidentKey) throw new Error('Incident id is required before updating documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        await apiService.incidentDocuments.update(accidentKey, documentId, patch)
        await refresh()
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to update document metadata')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, refresh]
  )

  const archiveDocument = useCallback(
    async (documentId: string, reason?: string) => {
      if (!accidentKey) throw new Error('Incident id is required before archiving documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        await apiService.incidentDocuments.archive(accidentKey, documentId, reason ? { reason } : undefined)
        await refresh()
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to archive document')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, refresh]
  )

  const removeDocument = useCallback(
    async (documentId: string, reason?: string) => {
      if (!accidentKey) throw new Error('Incident id is required before removing documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        await apiService.incidentDocuments.remove(accidentKey, documentId, reason ? { reason } : undefined)
        await refresh()
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to remove document')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, refresh]
  )

  const replaceDocument = useCallback(
    async (documentId: string, file: File, metadata: IncidentDocumentMetadata) => {
      if (!accidentKey) throw new Error('Incident id is required before replacing documents')
      setSavingDocumentId(documentId)
      setError(null)
      try {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          throw new Error('Only image and PDF documents are supported for incident documents')
        }

        const requestResp = await apiService.incidentDocuments.requestUpload(accidentKey, {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          documentType: metadata.documentType,
          description: metadata.description,
          tags: metadata.tags || [],
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

        await apiService.incidentDocuments.replace(accidentKey, documentId, {
          clientId: crypto.randomUUID(),
          key,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          documentType: metadata.documentType,
          description: metadata.description,
          tags: metadata.tags || [],
          replacedByDocumentId: documentId,
        })

        await refresh()
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to replace document')
        setError(message)
        throw err
      } finally {
        setSavingDocumentId(null)
      }
    },
    [accidentKey, refresh]
  )

  const selectedDocument = useMemo(
    () => documents[0] || null,
    [documents]
  )

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
    selectedDocument,
    setDocuments,
  }
}
