import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiService } from '../../../services/api'

export interface Report {
  id: string
  title: string
  type: string
  generatedAt: string
  data: any
}

interface ReportsState {
  list: Report[]
  analytics: any
  stats: any
  incidentsByLocation: any[]
  loading: boolean
  error: string | null
  total: number
  page: number
}

const initialState: ReportsState = {
  list: [],
  analytics: null,
  stats: null,
  incidentsByLocation: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
}

function toUiReport(raw: any): Report {
  return {
    id: String(raw?.id || raw?.reportId || crypto.randomUUID()),
    title: raw?.title || raw?.name || 'Report',
    type: raw?.type || 'general',
    generatedAt: raw?.generatedAt || raw?.createdAt || new Date().toISOString(),
    data: raw?.data ?? raw,
  }
}

// Async thunks
export const fetchReports = createAsyncThunk(
  'reports/fetchReports',
  async ({ page = 1, limit = 10 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await apiService.reports.getAll(page, limit)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports')
    }
  }
)

export const fetchAnalytics = createAsyncThunk(
  'reports/fetchAnalytics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.reports.getAnalytics()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch analytics')
    }
  }
)

export const fetchStats = createAsyncThunk(
  'reports/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.reports.getStats()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats')
    }
  }
)

export const fetchIncidentsByLocation = createAsyncThunk(
  'reports/fetchIncidentsByLocation',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.reports.getIncidentsByLocation()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch incidents by location')
    }
  }
)

export const createReport = createAsyncThunk(
  'reports/createReport',
  async (data: Partial<Report>, { rejectWithValue }) => {
    try {
      const response = await apiService.reports.create(data)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create report')
    }
  }
)

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    prependIncomingReport: (state, action: PayloadAction<any>) => {
      const incoming = toUiReport(action.payload)
      const existingIndex = state.list.findIndex((r) => r.id === incoming.id)
      if (existingIndex === -1) {
        state.list.unshift(incoming)
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch reports
    builder.addCase(fetchReports.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchReports.fulfilled, (state, action) => {
      state.loading = false
      const root = action.payload?.data ?? action.payload ?? {}
      const list = Array.isArray(root) ? root : (Array.isArray(root.data) ? root.data : [])
      state.list = list.map(toUiReport)
      state.total = action.payload.total || 0
      state.page = action.payload.page || 1
    })
    builder.addCase(fetchReports.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Fetch analytics
    builder.addCase(fetchAnalytics.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchAnalytics.fulfilled, (state, action) => {
      state.loading = false
      state.analytics = action.payload
    })
    builder.addCase(fetchAnalytics.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Fetch stats
    builder.addCase(fetchStats.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchStats.fulfilled, (state, action) => {
      state.loading = false
      state.stats = action.payload
    })
    builder.addCase(fetchStats.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Fetch incidents by location
    builder.addCase(fetchIncidentsByLocation.pending, (state) => {
      state.error = null
    })
    builder.addCase(fetchIncidentsByLocation.fulfilled, (state, action) => {
      state.incidentsByLocation = action.payload
    })
    builder.addCase(fetchIncidentsByLocation.rejected, (state, action) => {
      state.error = action.payload as string
    })

    // Create report
    builder.addCase(createReport.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(createReport.fulfilled, (state, action) => {
      state.loading = false
      state.list.unshift(toUiReport(action.payload?.data ?? action.payload))
    })
    builder.addCase(createReport.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
  },
})

export const { clearError, prependIncomingReport } = reportsSlice.actions
export default reportsSlice.reducer
