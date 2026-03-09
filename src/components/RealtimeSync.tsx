import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppDispatch, useAppSelector } from '../store/store'
import { prependIncomingAlert } from '../features/alerts/slices/alertsSlice'
import { prependIncomingIncident } from '../features/incidents/slices/incidentsSlice'
import { prependIncomingReport } from '../features/reports/slices/reportsSlice'

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || 'https://micladevops.com'
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/api/v2/socket.io'
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

    const socket: Socket = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      auth: { token },
    })

    const onNotification = (payload: any) => classifyAndDispatch(payload, dispatch)

    SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, onNotification))

    return () => {
      SOCKET_EVENTS.forEach((eventName) => socket.off(eventName, onNotification))
      socket.disconnect()
    }
  }, [dispatch, token])

  return null
}
