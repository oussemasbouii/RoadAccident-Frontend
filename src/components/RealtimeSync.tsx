import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../store/store'
import { prependIncomingAlert } from '../features/alerts/slices/alertsSlice'
import { prependIncomingIncident } from '../features/incidents/slices/incidentsSlice'
import { prependIncomingReport } from '../features/reports/slices/reportsSlice'
import { updateDocumentOcrStatus } from '../features/documents/slices/documentsSlice'
import { connectSharedSocket } from '@/services/socketClient'
import { getRefreshToken } from '@/utils/tokenStore'

const SOCKET_EVENTS = ['notification', 'action:alert:send', 'alert', 'incident', 'accident', 'report', 'document', 'document:ocr'] as const

function classifyAndDispatch(payload: any, dispatch: ReturnType<typeof useAppDispatch>, currentUserId?: string) {
  const data = payload?.data || payload?.alert || payload?.incident || payload?.report || payload?.document || payload
  const type = (payload?.type || data?.type || '').toString().toLowerCase()

  const isAlertLike =
    type.includes('alert') ||
    Boolean(data?.alertId) ||
    (typeof data?.latitude === 'number' && typeof data?.longitude === 'number')

  const isIncidentLike =
    type.includes('incident') ||
    type.includes('accident') ||
    Boolean(data?.incidentId || data?.accidentId) ||
    data?.status === 'active' || data?.status === 'responded' || data?.status === 'resolved'

  const isReportLike =
    type.includes('report') ||
    Boolean(data?.reportId) ||
    (typeof data?.title === 'string' && type.includes('analytics'))

  const isDocumentLike = type.includes('document') || Boolean(data?.ocrStatus || data?.ocr_status)

  if (isAlertLike) dispatch(prependIncomingAlert(data))
  if (isIncidentLike) dispatch(prependIncomingIncident(data))
  if (isReportLike) dispatch(prependIncomingReport(data))
  if (isDocumentLike) {
    dispatch(updateDocumentOcrStatus(data))

    // Notify the uploader when their own document's OCR finishes — reuses the existing
    // alerts/bell UI rather than introducing a new notification surface.
    const ocrStatus = data?.ocrStatus ?? data?.ocr_status
    const createdBy = data?.createdBy ?? data?.created_by
    const isTerminal = ocrStatus === 'completed' || ocrStatus === 'failed'
    if (isTerminal && currentUserId && createdBy && String(createdBy) === String(currentUserId)) {
      const filename = data?.filename || 'Document'
      dispatch(
        prependIncomingAlert({
          id: `document-ocr-${data?.id ?? data?.documentId ?? filename}-${ocrStatus}`,
          type: 'system',
          title: ocrStatus === 'completed' ? 'OCR completed' : 'OCR failed',
          description:
            ocrStatus === 'completed'
              ? `Text extraction finished for "${filename}".`
              : `Text extraction failed for "${filename}".`,
          time: new Date().toISOString(),
          read: false,
        })
      )
    }
  }
}

export default function RealtimeSync() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((state) => state.auth.token)
  const currentUserId = useAppSelector((state) => state.auth.user?.id)

  useEffect(() => {
    if (!token) return

    const refreshToken = getRefreshToken()
    if (!refreshToken) return

    const socket = connectSharedSocket(refreshToken)
    if (!socket) return

    const onNotification = (payload: any) => classifyAndDispatch(payload, dispatch, currentUserId)

    SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, onNotification))

    return () => {
      SOCKET_EVENTS.forEach((eventName) => socket.off(eventName, onNotification))
    }
  }, [dispatch, token, currentUserId])

  return null
}
