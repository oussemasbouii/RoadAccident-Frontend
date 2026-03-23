import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../store/store'
import { prependIncomingAlert } from '../features/alerts/slices/alertsSlice'
import { prependIncomingIncident } from '../features/incidents/slices/incidentsSlice'
import { prependIncomingReport } from '../features/reports/slices/reportsSlice'
import { connectSharedSocket } from '@/services/socketClient'
import { getRefreshToken } from '@/utils/tokenStore'

const SOCKET_EVENTS = ['notification', 'action:alert:send', 'alert', 'incident', 'accident', 'report'] as const

function classifyAndDispatch(payload: any, dispatch: ReturnType<typeof useAppDispatch>) {
  const data = payload?.data || payload?.alert || payload?.incident || payload?.report || payload
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

  if (isAlertLike) dispatch(prependIncomingAlert(data))
  if (isIncidentLike) dispatch(prependIncomingIncident(data))
  if (isReportLike) dispatch(prependIncomingReport(data))
}

export default function RealtimeSync() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((state) => state.auth.token)

  useEffect(() => {
    if (!token) return

    const refreshToken = getRefreshToken()
    if (!refreshToken) return

    const socket = connectSharedSocket(refreshToken)
    if (!socket) return

    const onNotification = (payload: any) => classifyAndDispatch(payload, dispatch)

    SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, onNotification))

    return () => {
      SOCKET_EVENTS.forEach((eventName) => socket.off(eventName, onNotification))
    }
  }, [dispatch, token])

  return null
}
