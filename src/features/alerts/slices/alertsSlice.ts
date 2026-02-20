import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiService } from '../../../services/api'

export interface Alert {
  id: string
  type: 'traffic' | 'weather' | 'hazard' | 'system'
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  time: string
  read: boolean
}

interface AlertsState {
  list: Alert[]
  loading: boolean
  error: string | null
  unreadCount: number
  total: number
  page: number
}

function toUiAlert(raw: any): Alert {
  const timestamp = raw?.time || raw?.timestamp
  const formattedTime = typeof timestamp === 'number'
    ? new Date(timestamp).toLocaleString()
    : (timestamp || 'Just now')

  return {
    id: String(raw?.id || raw?.alertId || crypto.randomUUID()),
    type: (['traffic', 'weather', 'hazard', 'system'].includes(raw?.type)
      ? raw.type
      : 'hazard') as Alert['type'],
    title: raw?.title || raw?.comment || 'Incoming Alert',
    description:
      raw?.description ||
      raw?.comment ||
      (raw?.latitude && raw?.longitude
        ? `Location: ${raw.latitude}, ${raw.longitude}`
        : 'Alert received from backend'),
    severity: (['critical', 'high', 'medium', 'low'].includes(raw?.severity)
      ? raw.severity
      : 'medium') as Alert['severity'],
    time: formattedTime,
    read: Boolean(raw?.read ?? raw?.seen ?? false),
  }
}

function extractAlertList(payload: any): Alert[] {
  const root = payload?.data ?? payload
  const list = Array.isArray(root)
    ? root
    : Array.isArray(root?.data)
      ? root.data
      : []
  return list.map(toUiAlert)
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
  async (data: Partial<Alert>, { rejectWithValue }) => {
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
      const received = extractAlertList(action.payload?.received)
      const sent = extractAlertList(action.payload?.sent).map((item) => ({ ...item, read: true }))
      const merged = [...received, ...sent]
      const byId = new Map<string, Alert>()
      merged.forEach((item) => byId.set(item.id, item))
      state.list = Array.from(byId.values())
      const { total, page } = extractPaginationMeta(action.payload?.received)
      state.total = total
      state.page = page
      state.unreadCount = state.list.filter((a) => !a.read).length
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
      const list = extractAlertList(action.payload)
      state.unreadCount = list.filter((a) => !a.read).length
    })
    builder.addCase(fetchUnreadCount.rejected, (state, action) => {
      state.error = action.payload as string
    })

    // Create alert
    builder.addCase(createAlert.pending, (state) => {
      state.error = null
    })
    builder.addCase(createAlert.fulfilled, (state, action) => {
      state.list.unshift(toUiAlert(action.payload?.data ?? action.payload))
      state.unreadCount += 1
    })
    builder.addCase(createAlert.rejected, (state, action) => {
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
