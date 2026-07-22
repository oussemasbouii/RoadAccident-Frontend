import { useEffect, useState } from 'react'
import { Box, Button, CircularProgress, IconButton, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded'
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { useTranslation } from '@/themeMode'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

// Page-width zoom for the scrollable multi-page view (Office / multi-page docs).
const MIN_PAGE_ZOOM = 0.5
const MAX_PAGE_ZOOM = 2.5
const PAGE_ZOOM_STEP = 0.25

// Formats a browser can't render natively but Mayan can convert to page
// images via its LibreOffice-backed converter (confirmed for .docx) — checked
// by mimeType first, filename as a fallback for generic/inaccurate mime types.
const OFFICE_EXTENSIONS = ['.doc', '.docx', '.odt', '.ppt', '.pptx', '.xls', '.xlsx', '.rtf']

type Props = {
  filename: string
  mimeType: string
  previewUrl?: string
  loading?: boolean
  // Rendered page images for non-natively-previewable / multi-page docs. When
  // present these are shown as a scrollable page stack (the proper multi-page
  // preview). `previewImageUrl` is the legacy single-page fallback.
  pageImageUrls?: string[]
  pagesLoading?: boolean
  previewImageUrl?: string
  previewImageLoading?: boolean
  onOpenFile?: () => void
  height?: number
  restricted?: boolean
  canView?: boolean
}

export default function DocumentPreview({
  filename,
  mimeType,
  previewUrl,
  loading = false,
  pageImageUrls,
  pagesLoading = false,
  previewImageUrl,
  previewImageLoading = false,
  onOpenFile,
  height = 320,
  restricted = false,
  canView = true,
}: Props) {
  const theme = useTheme()
  const { t } = useTranslation()

  const isImagePreview = Boolean(mimeType?.startsWith('image/'))
  const isPdfPreview = Boolean(mimeType?.includes('pdf')) || filename.toLowerCase().endsWith('.pdf')
  const isOfficePreview =
    Boolean(mimeType?.includes('word')) ||
    Boolean(mimeType?.includes('msword')) ||
    Boolean(mimeType?.includes('officedocument')) ||
    Boolean(mimeType?.includes('opendocument')) ||
    Boolean(mimeType?.includes('ms-excel')) ||
    Boolean(mimeType?.includes('ms-powerpoint')) ||
    OFFICE_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))

  // Multi-page scrollable view: used for Office docs (and any multi-page doc)
  // that resolved page images. Takes priority over the single-image fallback.
  const hasPages = Array.isArray(pageImageUrls) && pageImageUrls.length > 0

  // Single-image (zoom/pan) view drives real images and the legacy one-page
  // Office fallback when the page list isn't available.
  const singleImageSrc = isImagePreview ? previewUrl : isOfficePreview && !hasPages ? previewImageUrl : undefined
  const isBusy = isOfficePreview ? pagesLoading || (previewImageLoading && !hasPages) : loading

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [pageZoom, setPageZoom] = useState(1)

  // A fresh preview shouldn't inherit zoom/pan/page-zoom from the previous one.
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setPageZoom(1)
  }, [previewUrl, previewImageUrl, pageImageUrls])

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

  const applyZoom = (next: number) => {
    const clamped = clampZoom(next)
    setZoom(clamped)
    if (clamped === MIN_ZOOM) setPan({ x: 0, y: 0 })
  }

  const zoomIn = () => applyZoom(zoom + ZOOM_STEP)
  const zoomOut = () => applyZoom(zoom - ZOOM_STEP)
  const resetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const pageZoomIn = () => setPageZoom((z) => Math.min(MAX_PAGE_ZOOM, z + PAGE_ZOOM_STEP))
  const pageZoomOut = () => setPageZoom((z) => Math.max(MIN_PAGE_ZOOM, z - PAGE_ZOOM_STEP))

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
    applyZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP / 2 : -ZOOM_STEP / 2))
  }

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (zoom <= MIN_ZOOM) return
    setDragging(true)
    setDragStart({ x: event.clientX, y: event.clientY })
    setPanStart(pan)
  }

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!dragging) return
    setPan({ x: panStart.x + (event.clientX - dragStart.x), y: panStart.y + (event.clientY - dragStart.y) })
  }

  const stopDragging = () => setDragging(false)

  const zoomControls = (
    onOut: () => void,
    onReset: (() => void) | undefined,
    onIn: () => void,
    outDisabled: boolean,
    inDisabled: boolean,
  ) => (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        bgcolor: alpha(theme.palette.background.paper, 0.92),
        borderRadius: 2,
        p: 0.5,
        boxShadow: theme.shadows[2],
        zIndex: 2,
      }}
    >
      <Tooltip title={t('documents.zoom_out')}>
        <span>
          <IconButton size="small" aria-label={t('documents.zoom_out')} onClick={onOut} disabled={outDisabled}>
            <ZoomOutRoundedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {onReset && (
        <Tooltip title={t('documents.reset_zoom')}>
          <span>
            <IconButton size="small" aria-label={t('documents.reset_zoom')} onClick={onReset}>
              <RestartAltRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Tooltip title={t('documents.zoom_in')}>
        <span>
          <IconButton size="small" aria-label={t('documents.zoom_in')} onClick={onIn} disabled={inDisabled}>
            <ZoomInRoundedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )

  if (restricted && !canView) {
    return (
      <Box
        sx={{
          position: 'relative',
          borderRadius: 2.5,
          overflow: 'hidden',
          minHeight: height,
          bgcolor: alpha(theme.palette.warning.main, 0.05),
          border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
        }}
      >
        <Stack sx={{ height }} alignItems="center" justifyContent="center" spacing={1}>
          <LockRoundedIcon sx={{ fontSize: 40, color: 'warning.main' }} />
          <Typography sx={{ fontWeight: 700 }}>{t('documents.restricted_document')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('documents.restricted_admin_only')}</Typography>
        </Stack>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2.5,
        overflow: 'hidden',
        minHeight: height,
        bgcolor: alpha(theme.palette.action.active, 0.04),
        border: `1px solid ${alpha(theme.palette.divider, 0.78)}`,
      }}
    >
      {isBusy ? (
        <Stack sx={{ height }} alignItems="center" justifyContent="center">
          <CircularProgress size={28} />
        </Stack>
      ) : hasPages ? (
        // ── Scrollable multi-page view (PDF-like) for Office / multi-page docs ──
        <>
          <Box
            sx={{
              height,
              overflowY: 'auto',
              overflowX: 'auto',
              bgcolor: alpha(theme.palette.common.black, 0.06),
              px: 2,
              py: 2,
            }}
          >
            <Stack spacing={2} alignItems="center">
              {pageImageUrls!.map((url, i) => (
                <Box key={url} sx={{ width: `${pageZoom * 100}%`, maxWidth: pageZoom <= 1 ? 900 : 'none', flexShrink: 0 }}>
                  <Box
                    component="img"
                    src={url}
                    alt={`${filename} — ${t('documents.page')} ${i + 1}`}
                    loading="lazy"
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      borderRadius: 1,
                      boxShadow: theme.shadows[2],
                      bgcolor: 'background.paper',
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 0.5 }}
                  >
                    {t('documents.page')} {i + 1} / {pageImageUrls!.length}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
          {zoomControls(pageZoomOut, undefined, pageZoomIn, pageZoom <= MIN_PAGE_ZOOM, pageZoom >= MAX_PAGE_ZOOM)}
        </>
      ) : isPdfPreview && previewUrl ? (
        // ── Native, scrollable PDF viewer ──
        <Box
          component="iframe"
          title={filename}
          src={previewUrl}
          sx={{ width: '100%', height, border: 'none', bgcolor: 'background.paper' }}
        />
      ) : singleImageSrc ? (
        // ── Single image (real images + one-page Office fallback): zoom + pan ──
        <>
          <Box
            sx={{
              height,
              overflow: 'hidden',
              cursor: zoom > MIN_ZOOM ? (dragging ? 'grabbing' : 'grab') : 'default',
              touchAction: 'none',
              bgcolor: alpha(theme.palette.common.black, 0.04),
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
          >
            <Box
              component="img"
              src={singleImageSrc}
              alt={filename}
              draggable={false}
              sx={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: dragging ? 'none' : 'transform 0.15s ease-out',
                userSelect: 'none',
              }}
            />
          </Box>
          {zoomControls(zoomOut, resetZoom, zoomIn, zoom <= MIN_ZOOM, zoom >= MAX_ZOOM)}
        </>
      ) : (
        <Stack sx={{ height }} alignItems="center" justifyContent="center" spacing={1}>
          <DescriptionOutlinedIcon sx={{ fontSize: 48, color: theme.palette.text.secondary }} />
          <Typography color="text.secondary">{t('documents.preview_unavailable_for_this_file_type')}</Typography>
          {previewUrl && onOpenFile && (
            <Button variant="outlined" size="small" onClick={onOpenFile}>
              {t('documents.open_file')}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  )
}
