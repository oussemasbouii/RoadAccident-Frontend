import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiService } from '../../../services/api'

export interface Alert {
  id: string
  type: 'traffic' | 'weather' | 'hazard' | 'system'
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  time: string
  timestamp?: string
  read: boolean
  direction: 'received' | 'sent'
  senderId?: string
  latitude?: number
  longitude?: number
  comment?: string
  recipients?: Array<{
    id?: string
    recipientId?: string
    acknowledged?: boolean
    acknowledgedAt?: string
  }>
  recipientCount?: number
  acknowledgedCount?: number
}

interface AlertsState {
  list: Alert[]
  loading: boolean
  error: string | null
  unreadCount: number
  total: number
  page: number
}

function inferSeverity(comment: string): Alert['severity'] {
  const text = comment.toLowerCase()
  if (text.includes('fatal') || text.includes('dead') || text.includes('critical')) return 'critical'
  if (text.includes('urgent') || text.includes('high') || text.includes('severe')) return 'high'
  if (text.includes('minor') || text.includes('low')) return 'low'
  return 'medium'
}

function inferType(comment: string): Alert['type'] {
  const text = comment.toLowerCase()
  if (text.includes('rain') || text.includes('storm') || text.includes('weather') || text.includes('fog')) return 'weather'
  if (text.includes('traffic') || text.includes('congestion') || text.includes('jam')) return 'traffic'
  if (text.includes('system') || text.includes('server') || text.includes('platform')) return 'system'
  return 'hazard'
}

function toUiAlert(raw: any, direction: 'received' | 'sent' = 'received'): Alert {
  const timestamp = raw?.createdAt || raw?.time || raw?.timestamp
  const formattedTime = typeof timestamp === 'number'
    ? new Date(timestamp).toLocaleString()
    : (timestamp ? new Date(timestamp).toLocaleString() : 'Just now')
  const rawTimestamp = typeof timestamp === 'number'
    ? new Date(timestamp).toISOString()
    : (timestamp ? new Date(timestamp).toISOString() : undefined)

  const recipients = Array.isArray(raw?.recipients) ? raw.recipients : []
  const acknowledgedCount = recipients.filter((r: any) => Boolean(r?.acknowledged)).length
  const recipientCount = recipients.length
  const comment = String(raw?.comment || raw?.description || raw?.title || '').trim()
  const latitude = Number(raw?.latitude)
  const longitude = Number(raw?.longitude)
  const readFromRecipient = recipients.some((r: any) => Boolean(r?.acknowledged))
  const read = direction === 'sent'
    ? true
    : Boolean(raw?.read ?? raw?.seen ?? raw?.acknowledged ?? readFromRecipient)
  const senderId = raw?.senderId ? String(raw.senderId) : ''
  const senderLabel = senderId ? `Sender ${senderId}` : 'Unknown sender'
  const title = raw?.title
    ? String(raw.title)
    : direction === 'sent'
      ? 'Sent Alert'
      : `Alert from ${senderLabel}`
  const locationLine = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    : ''
  const description = [comment, locationLine].filter(Boolean).join(' | ')

  return {
    id: String(raw?.id || raw?.alertId || crypto.randomUUID()),
    type: (['traffic', 'weather', 'hazard', 'system'].includes(raw?.type)
      ? raw.type
      : inferType(comment || '')) as Alert['type'],
    title,
    description: description || 'Alert received from backend',
    severity: (['critical', 'high', 'medium', 'low'].includes(raw?.severity)
      ? raw.severity
      : inferSeverity(comment || '')) as Alert['severity'],
    time: formattedTime,
    timestamp: rawTimestamp,
    read,
    direction,
    senderId: senderId || undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    comment: comment || undefined,
    recipients,
    recipientCount,
    acknowledgedCount,
  }
}

function extractAlertList(payload: any, direction: 'received' | 'sent'): Alert[] {
  const root = payload?.data ?? payload
  const list = Array.isArray(root)
    ? root
    : Array.isArray(root?.data)
      ? root.data
      : []
  return list.map((item: any) => toUiAlert(item, direction))
}

function extractPaginationMeta(payload: any) {
  const root = payload?.data ?? payload
  return {
    total: Number(root?.total ?? 0),
    page: Number(root?.page ?? 1),
  }
}

const initialState: AlertsState = {
  list: [],
  loading: false,
  error: null,
  unreadCount: 0,
  total: 0,
  page: 1,
}

// Async thunks
export const fetchAlerts = createAsyncThunk(
  'alerts/fetchAlerts',
  async (_: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const [receivedResponse, sentResponse] = await Promise.all([
        apiService.alerts.getReceived(),
        apiService.alerts.getSent(),
      ])
      return {
        received: receivedResponse.data,
        sent: sentResponse.data,
      }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch alerts')
    }
  }
)

export const fetchUnreadCount = createAsyncThunk(
  'alerts/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.alerts.getReceived()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch unread count')
    }
  }
)

export const createAlert = createAsyncThunk(
  'alerts/createAlert',
  async (data: {
    recipientIds: string[]
    latitude: number
    longitude: number
    comment: string
  }, { rejectWithValue }) => {
    try {
      const response = await apiService.alerts.create(data)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create alert')
    }
  }
)

export const markAlertAsRead = createAsyncThunk(
  'alerts/markAsRead',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await apiService.alerts.acknowledge(id)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark alert as read')
    }
  }
)

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    prependIncomingAlert: (state, action: PayloadAction<any>) => {
      const incoming = toUiAlert(action.payload)
      const existingIndex = state.list.findIndex((a) => a.id === incoming.id)
      if (existingIndex === -1) {
        state.list.unshift(incoming)
        if (!incoming.read) state.unreadCount += 1
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch alerts
    builder.addCase(fetchAlerts.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchAlerts.fulfilled, (state, action) => {
      state.loading = false
      const received = extractAlertList(action.payload?.received, 'received')
      const sent = extractAlertList(action.payload?.sent, 'sent').map((item) => ({ ...item, read: true }))
      state.list = [...received, ...sent].sort((a, b) => {
        const t1 = new Date(a.time).getTime()
        const t2 = new Date(b.time).getTime()
        if (Number.isFinite(t1) && Number.isFinite(t2)) return t2 - t1
        return 0
      })
      const { total, page } = extractPaginationMeta(action.payload?.received)
      state.total = total
      state.page = page
      state.unreadCount = received.filter((a) => !a.read).length
    })
    builder.addCase(fetchAlerts.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Fetch unread count
    builder.addCase(fetchUnreadCount.pending, (state) => {
      state.error = null
    })
    builder.addCase(fetchUnreadCount.fulfilled, (state, action) => {
      const list = extractAlertList(action.payload, 'received')
      state.unreadCount = list.filter((a) => !a.read).length
    })
    builder.addCase(fetchUnreadCount.rejected, (state, action) => {
      state.error = action.payload as string
    })

    // Create alert
    builder.addCase(createAlert.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(createAlert.fulfilled, (state, action) => {
      state.loading = false
      const createdRaw = action.payload?.alert ?? action.payload?.data?.alert ?? action.payload?.data ?? action.payload
      if (createdRaw) state.list.unshift(toUiAlert(createdRaw, 'sent'))
    })
    builder.addCase(createAlert.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Mark as read
    builder.addCase(markAlertAsRead.fulfilled, (state, action) => {
      const acknowledgedId = String(
        action.payload?.alertId ||
        action.payload?.id ||
        action.meta.arg
      )
      const index = state.list.findIndex((a) => a.id === acknowledgedId)
      if (index !== -1) {
        state.list[index].read = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    })
  },
})

export const { clearError, prependIncomingAlert } = alertsSlice.actions
export default alertsSlice.reducer
