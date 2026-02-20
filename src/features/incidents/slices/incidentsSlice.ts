import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiService } from '../../../services/api'

export interface Incident {
  id: string
  location: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'responded' | 'resolved'
  time: string
  vehicles: number
  injuries: number
  description?: string
}

interface IncidentStats {
  open: number
  resolved: number
  fatalities: number
  avgResponseTime: number
}

interface IncidentsState {
  list: Incident[]
  loading: boolean
  error: string | null
  currentIncident: Incident | null
  total: number
  page: number
  stats: IncidentStats
}

const initialState: IncidentsState = {
  list: [],
  loading: false,
  error: null,
  currentIncident: null,
  total: 0,
  page: 1,
  stats: { open: 0, resolved: 0, fatalities: 0, avgResponseTime: 0 },
}

function toUiIncident(raw: any): Incident {
  const timestamp = raw?.time || raw?.timestamp || raw?.createdAt
  const formattedTime = typeof timestamp === 'number'
    ? new Date(timestamp).toLocaleString()
    : (timestamp || 'Just now')

  return {
    id: String(raw?.id || raw?.incidentId || raw?.accidentId || crypto.randomUUID()),
    location: raw?.location || raw?.address || (raw?.latitude && raw?.longitude ? `${raw.latitude}, ${raw.longitude}` : 'Unknown location'),
    severity: (['critical', 'high', 'medium', 'low'].includes(raw?.severity)
      ? raw.severity
      : 'medium') as Incident['severity'],
    status: (['active', 'responded', 'resolved'].includes(raw?.status)
      ? raw.status
      : 'active') as Incident['status'],
    time: formattedTime,
    vehicles: Number(raw?.vehicles ?? raw?.vehicleCount ?? 0),
    injuries: Number(raw?.injuries ?? raw?.injuryCount ?? 0),
    description: raw?.description || raw?.comment,
  }
}

// Async thunks
export const fetchIncidents = createAsyncThunk(
  'incidents/fetchIncidents',
  async ({ page = 1, limit = 10 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await apiService.incidents.getAll(page, limit)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch incidents')
    }
  }
)

export const fetchIncidentById = createAsyncThunk(
  'incidents/fetchIncidentById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await apiService.incidents.getById(id)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch incident')
    }
  }
)

const incidentsSlice = createSlice({
  name: 'incidents',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearCurrentIncident: (state) => {
      state.currentIncident = null
    },
    prependIncomingIncident: (state, action: PayloadAction<any>) => {
      const incoming = toUiIncident(action.payload)
      const existingIndex = state.list.findIndex((i) => i.id === incoming.id)
      if (existingIndex === -1) {
        state.list.unshift(incoming)
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch incidents
    builder.addCase(fetchIncidents.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchIncidents.fulfilled, (state, action) => {
      state.loading = false
      const root = action.payload?.data ?? action.payload ?? {}
      const list = Array.isArray(root) ? root : (Array.isArray(root.data) ? root.data : [])
      state.list = list.map(toUiIncident)
      state.total = Number(root?.total ?? state.list.length)
      state.page = Number(root?.page ?? 1)
      state.stats = {
        open: state.list.filter((i) => i.status !== 'resolved').length,
        resolved: state.list.filter((i) => i.status === 'resolved').length,
        fatalities: 0,
        avgResponseTime: state.stats.avgResponseTime,
      }
    })
    builder.addCase(fetchIncidents.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Fetch single incident
    builder.addCase(fetchIncidentById.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchIncidentById.fulfilled, (state, action) => {
      state.loading = false
      state.currentIncident = action.payload
    })
    builder.addCase(fetchIncidentById.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

  },
})

export const { clearError, clearCurrentIncident, prependIncomingIncident } = incidentsSlice.actions
export default incidentsSlice.reducer
