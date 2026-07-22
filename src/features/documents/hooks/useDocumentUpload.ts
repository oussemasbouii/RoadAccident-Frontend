import { useState } from 'react'
import axios from 'axios'
import { apiService } from '@/services/api'
import type { DocumentCategory, DocumentLanguage, DocumentOwnerType, GedDocument, VisibleToRole } from '@/types/document'

type UploadMetadata = {
  categories: DocumentCategory[]
  description?: string
  tags?: string[]
  visibleToRole?: VisibleToRole
  language?: DocumentLanguage
  // Only meaningful for a single-file upload — renaming every file in a batch
  // to the same name would collide, so callers only pass this when files.length === 1.
  filenameOverride?: string
}

// Per-call hooks the dialog uses to drive a determinate progress bar and to
// cancel an in-flight upload. Both optional so existing callers keep working.
type UploadControls = {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

const unwrapPayload = (payload: any) => payload?.data?.data ?? payload?.data ?? payload ?? {}

// Raised when the user aborts — callers use this to distinguish a deliberate
// cancel from a real failure (no error toast, no "failed" chip).
export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled')
    this.name = 'UploadCancelledError'
  }
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as any
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback
}

/**
 * Single implementation of "PUT a file to a MinIO presigned URL", shared by the
 * upload hook and the Edit / Add-version dialogs so all three behave the same
 * (progress, cancel, error message). Bare axios — the presigned URL is absolute
 * and must NOT carry the app's baseURL or Bearer-auth interceptor. axios (unlike
 * fetch) exposes onUploadProgress and honours an AbortSignal.
 */
export async function putToPresignedUrl(
  uploadUrl: string,
  file: File,
  opts: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  if (opts.signal?.aborted) throw new UploadCancelledError()
  try {
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      signal: opts.signal,
      onUploadProgress: (e) => {
        if (opts.onProgress && e.total) opts.onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
  } catch (putErr) {
    if (axios.isCancel(putErr) || (putErr as any)?.code === 'ERR_CANCELED') throw new UploadCancelledError()
    const status = (putErr as any)?.response?.status
    throw new Error(`Failed to upload file to storage${status ? ` (status ${status})` : ''}. The storage backend may be unavailable or full.`)
  }
}

export function useDocumentUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadDocument = async (
    ownerType: DocumentOwnerType,
    ownerId: string,
    file: File,
    metadata: UploadMetadata,
    controls: UploadControls = {}
  ): Promise<GedDocument> => {
    setUploading(true)
    setError(null)
    try {
      if (controls.signal?.aborted) throw new UploadCancelledError()
      const filename = metadata.filenameOverride?.trim() || file.name
      const requestResp = await apiService.documents.requestUpload({
        ownerType,
        ownerId,
        filename,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        categories: metadata.categories,
        description: metadata.description,
        tags: metadata.tags,
        visibleToRole: metadata.visibleToRole,
      })

      const requestData = unwrapPayload(requestResp.data)
      const uploadUrl = requestData.uploadUrl
      const key = requestData.key
      if (!uploadUrl || !key) throw new Error('Upload URL missing')

      await putToPresignedUrl(uploadUrl, file, { onProgress: controls.onProgress, signal: controls.signal })

      const confirmResp = await apiService.documents.confirmUpload({
        ownerType,
        ownerId,
        clientId: crypto.randomUUID(),
        key,
        filename,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        categories: metadata.categories,
        description: metadata.description,
        tags: metadata.tags,
        visibleToRole: metadata.visibleToRole,
        language: metadata.language,
      })

      const confirmData = unwrapPayload(confirmResp.data)
      return {
        id: String(confirmData?.id ?? crypto.randomUUID()),
        ownerType,
        ownerId,
        filename,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        categories: metadata.categories,
        description: metadata.description || '',
        tags: metadata.tags || [],
        status: confirmData?.status ?? 'uploaded',
        visibleToRole: metadata.visibleToRole,
        createdAt: confirmData?.createdAt ?? new Date().toISOString(),
        downloadUrl: confirmData?.downloadUrl ?? confirmData?.path,
      }
    } catch (err) {
      // A user-initiated cancel isn't an error state — don't surface it.
      if (!(err instanceof UploadCancelledError)) {
        setError(getErrorMessage(err, 'Failed to upload document'))
      }
      throw err
    } finally {
      setUploading(false)
    }
  }

  return { uploadDocument, uploading, error, setError }
}
