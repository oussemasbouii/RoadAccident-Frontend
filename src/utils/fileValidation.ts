// Mirrors the backend's REQUEST_UPLOAD_BODY_SCHEMA / CONFIRM_UPLOAD_BODY_SCHEMA
// size cap (documents.schemas.ts) — checked here too so an oversized file is
// rejected before any network transfer, not after a round-trip to the API.
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

// Allow-list, not a blocklist — anything not explicitly a document, image, or
// video extension is rejected, which covers .zip/.exe/etc without having to
// enumerate every disallowed type.
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'odt', 'ods', 'odp', 'rtf']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tiff', 'tif', 'svg']
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp']

const ALLOWED_EXTENSIONS = new Set([...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS])

export const ACCEPTED_FILE_INPUT_ACCEPT =
  'image/*,video/*,application/pdf,' +
  DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',')

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

export type FileValidationResult = { ok: true } | { ok: false; message: string }

export function validateFile(file: File, t: (key: string) => string): FileValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: t('documents.file_too_large') }
  }
  const ext = extensionOf(file.name)
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, message: t('documents.file_type_not_allowed').replace('{ext}', ext ? `.${ext}` : file.name) }
  }
  return { ok: true }
}
