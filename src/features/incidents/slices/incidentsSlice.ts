import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiService } from '../../../services/api'

export interface Incident {
  id: string
  location: string
  latitude?: number
  longitude?: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'responded' | 'resolved'
  time: string
  timestamp?: string
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
  currentIncident: any | null
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

const unwrapResponseData = (payload: any) => payload?.data ?? payload

function toUiIncident(raw: any): Incident {
  const rawLatitude = raw?.latitude ?? raw?.lat ?? raw?.location?.latitude
  const rawLongitude = raw?.longitude ?? raw?.lng ?? raw?.location?.longitude
  const latitude = Number(rawLatitude)
  const longitude = Number(rawLongitude)

  const timestamp =
    raw?.time ||
    raw?.timestamp ||
    raw?.createdAt ||
    (raw?.accidentDate && raw?.infoDetails?.accidentTime
      ? `${raw.accidentDate}T${raw.infoDetails.accidentTime}`
      : raw?.accidentDate)

  const formattedTime =
    typeof timestamp === 'number'
      ? new Date(timestamp).toLocaleString()
      : (timestamp ? new Date(timestamp).toLocaleString() : 'Just now')
  const rawTimestamp =
    typeof timestamp === 'number'
      ? new Date(timestamp).toISOString()
      : (timestamp ? new Date(timestamp).toISOString() : undefined)

  const hospitalized = Number(raw?.damagesReport?.hospitalizedInjuredCount ?? 0)
  const lightly = Number(raw?.damagesReport?.lightlyInjuredCount ?? 0)
  const dead = Number(raw?.damagesReport?.deadCount ?? 0)
  const totalInjuries = hospitalized + lightly + dead

  const severityFromDamages: Incident['severity'] =
    dead > 0 || raw?.damagesReport?.fatalAccident
      ? 'critical'
      : hospitalized > 0
        ? 'high'
        : lightly > 0
          ? 'medium'
          : 'low'

  const roadName = String(raw?.roadConditions?.roadName ?? '').trim()
  const locationDescription = String(raw?.location?.description ?? '').trim()
  const rawLocation = String(raw?.location ?? '').trim()
  const address = String(raw?.address ?? '').trim()
  const governorate = String(raw?.infoDetails?.governorate ?? '').trim()
  const delegation = String(raw?.infoDetails?.delegation ?? '').trim()
  const municipality = String(raw?.infoDetails?.municipality ?? '').trim()
  const sector = String(raw?.infoDetails?.sector ?? '').trim()
  const summary = String(raw?.infoDetails?.summary ?? '').trim()
  const areaLabel = [sector, municipality, delegation, governorate].filter(Boolean).join(', ')

  return {
    id: String(raw?.id || raw?._id || raw?.incidentId || raw?.accidentId || crypto.randomUUID()),
    location:
      locationDescription ||
      roadName ||
      rawLocation ||
      address ||
      areaLabel ||
      summary ||
      (Number.isFinite(latitude) && Number.isFinite(longitude) ? `${latitude}, ${longitude}` : 'Unknown location'),
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    severity: (['critical', 'high', 'medium', 'low'].includes(raw?.severity)
      ? raw.severity
      : severityFromDamages) as Incident['severity'],
    status: (['active', 'responded', 'resolved'].includes(raw?.status)
      ? raw.status
      : 'active') as Incident['status'],
    time: formattedTime,
    timestamp: rawTimestamp,
    vehicles: Number(raw?.vehicles ?? raw?.vehicleCount ?? raw?.participants?.length ?? 0),
    injuries: Number(raw?.injuries ?? raw?.injuryCount ?? totalInjuries),
    description: raw?.description || raw?.comment || raw?.damagesReport?.damageDescription,
  }
}

function toAccidentCreatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  // If payload already matches the backend direct schema, pass through.
  if (payload.accidentDate && payload.infoDetails && payload.roadConditions && payload.environmentConditions) {
    const direct = payload as any
    const roadName = String(direct?.roadConditions?.roadName ?? '').trim()
    const governorate = String(direct?.infoDetails?.governorate ?? '').trim()
    const delegation = String(direct?.infoDetails?.delegation ?? '').trim()
    const municipality = String(direct?.infoDetails?.municipality ?? '').trim()
    const sector = String(direct?.infoDetails?.sector ?? '').trim()
    const summary = String(direct?.infoDetails?.summary ?? '').trim()
    const locationLabel =
      roadName ||
      [sector, municipality, delegation, governorate].filter(Boolean).join(', ') ||
      summary ||
      `${direct?.latitude ?? ''}, ${direct?.longitude ?? ''}`.trim()

    return {
      ...direct,
      location: direct?.location || locationLabel,
      description: direct?.description || summary,
    }
  }

  const locationText = String(payload.location ?? '').trim()
  const latitude = Number(payload.latitude ?? 0)
  const longitude = Number(payload.longitude ?? 0)
  const description = String(payload.description ?? '')
  const severity = String(payload.severity ?? 'medium')
  const vehiclesCount = Number(payload.vehicles ?? 0)
  const injuries = Number(payload.injuries ?? 0)
  const now = new Date(String(payload.time ?? new Date().toISOString()))
  const accidentDate = Number.isNaN(now.getTime()) ? new Date() : now
  const datePart = accidentDate.toISOString().slice(0, 10) // YYYY-MM-DD
  const timePart = accidentDate.toTimeString().slice(0, 8) // HH:mm:ss

  const severityToCauseId: Record<string, string> = {
    critical: 'ALCOHOL_DRUGS',
    high: 'INAPPROPRIATE_SPEED',
    medium: 'INATTENTION',
    low: 'OTHER',
  }

  const severityToTypeId: Record<string, string> = {
    critical: 'COLLISION_MOVING',
    high: 'COLLISION_OBSTACLE',
    medium: 'OTHER',
    low: 'OTHER',
  }

  const severityToSubTypeId: Record<string, string> = {
    critical: 'MULTIPLE',
    high: 'FRONT',
    medium: 'OTHER',
    low: 'OTHER',
  }

  return {
    accidentDate: datePart,
    latitude,
    longitude,
    infoDetails: {
      accidentTime: timePart,
      governorate: 'Unknown',
      delegation: 'Unknown',
      municipality: 'Unknown',
      sector: 'Unknown',
      summary: description || locationText || `${latitude}, ${longitude}`,
      dayTypeId: 'WORKING',
      accidentSituationId: 'ON_ROAD',
      schoolPoint: false,
      zoneId: 'ROAD',
      urbanityId: 'OUTSIDE_AGGLOMERATION',
    },
    roadConditions: {
      roadSinuosityId: 'UNIQUE',
      roadMarkingId: 'NONEXISTENT',
      planLayoutId: 'STRAIGHT',
      roadName: locationText || 'Unknown road',
      addressNumber: '',
      betweenStreet: '',
      andStreet: '',
      intersectionStreet: '',
      designation: '',
      roadTypeId: 'CONVENTIONAL_2X1',
      networkCategoryId: 'LOCAL',
      trafficRegimeId: 'BIDIRECTIONAL',
      trafficDirectionId: 'BOTH',
      numberOfLanes: 1,
      speedLimit: 50,
      hasTpc: false,
      roadWidthId: 'LESS_325',
      laneWidthId: 'LESS_6',
    },
    environmentConditions: {
      luminosityId: 'FULL_DAYLIGHT',
      atmosphericConditionsId: 'GOOD_WEATHER',
      visibilityId: 'CLEAR',
      roadPavementConditionId: 'PAVED',
      roadCharacteristics: '',
      roadSurfaceCondition: '',
      roadConditionText: '',
      obstacles: '',
      circumstances1: '',
      circumstances2: '',
    },
    participants: Array.from({ length: Math.max(1, vehiclesCount) }).map((_, idx) => ({
      id: `P-${Date.now()}-${idx}`,
      firstName: '',
      lastName: '',
      cin: '',
      taxId: '',
      passportNumber: '',
      eHouwiya: '',
      participantType: 'DRIVER',
      registrationNumber: '',
      brand: '',
      vehicleType: 'VEHICLE_ALONE',
      commercialType: '',
      specialType: 'NONE',
      usageType: '',
      vehicleNationality: '',
      registrationCardNumber: '',
      chassisNumber: '',
      insurance: 'YES',
      insuranceContractNumber: '',
      insuranceContractDate: '',
      orangeCardNumber: '',
      insurerCompanyName: '',
      insurerAddress: '',
      insurerPhoneNumber: '',
      insurerFax: '',
      insurerEmail: '',
      insuredPersonName: '',
      insuredPersonAddress: '',
      insuredPhoneNumber: '',
      validityStartDate: '',
      validityEndDate: '',
      territorialValidity: '',
      cardDate: '',
      engineNumber: '',
      vehicleDamageMarkers: [],
      vehiclePosition: 'FRONT_LEFT',
      pedestrianLocation: 'ROAD',
      action: 'DRIVER_STRAIGHT',
      travelReason: 'OTHER',
      plannedTrip: 'UNKNOWN',
      continuousDrivingHours: '',
      safetyEquipmentUse: 'SEATBELT',
      injurySeverity: injuries > 0 ? 'LIGHT_INJURY' : 'UNINJURED',
      alcoholTest: 'NOT_DONE',
      alcoholLevel: '',
      drugTest: 'NOT_DONE',
      infraction: 'NONE',
    })),
    damagesReport: {
      responsiblePartyIds: [],
      fatalAccident: false,
      accidentCauseId: severityToCauseId[severity] || 'OTHER',
      deadCount: 0,
      hospitalizedInjuredCount: injuries,
      lightlyInjuredCount: injuries,
      unharmedCount: Math.max(0, vehiclesCount - injuries),
      accidentTypeId: severityToTypeId[severity] || 'OTHER',
      accidentSubTypeId: severityToSubTypeId[severity] || 'OTHER',
      damageDescription: description,
      attachments: [],
    },

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

export const createIncident = createAsyncThunk(
  'incidents/createIncident',
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const response = await apiService.incidents.create(toAccidentCreatePayload(payload) as any)
      return response.data
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message
          || error.response?.data?.error
          || (typeof error.response?.data === 'string' ? error.response.data : 'Failed to create incident')
      )
    }
  }
)

export const updateIncident = createAsyncThunk(
  'incidents/updateIncident',
  async ({ id, payload }: { id: string; payload: Record<string, unknown> }, { rejectWithValue }) => {
    try {
      const response = await apiService.incidents.update(id, payload)
      return response.data
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message
          || error.response?.data?.error
          || (typeof error.response?.data === 'string' ? error.response.data : 'Failed to update incident')
      )
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
      state.currentIncident = unwrapResponseData(action.payload)
    })
    builder.addCase(fetchIncidentById.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })

    // Create incident
    builder.addCase(createIncident.fulfilled, (state, action) => {
      state.error = null
      const created = unwrapResponseData(action.payload)
      if (created) {
        const incoming = toUiIncident(created)
        const existingIndex = state.list.findIndex((i) => i.id === incoming.id)
        if (existingIndex === -1) {
          state.list.unshift(incoming)
        }
      }
    })
    builder.addCase(createIncident.rejected, (state, action) => {
      state.error = action.payload as string
    })

    // Update incident
    builder.addCase(updateIncident.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(updateIncident.fulfilled, (state, action) => {
      state.loading = false
      state.error = null
      const updated = unwrapResponseData(action.payload)
      if (!updated) return
      const incoming = toUiIncident(updated)
      const idx = state.list.findIndex((i) => i.id === incoming.id)
      if (idx >= 0) {
        state.list[idx] = incoming
      } else {
        state.list.unshift(incoming)
      }
      state.currentIncident = updated
    })
    builder.addCase(updateIncident.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
  },
})

export const { clearError, clearCurrentIncident, prependIncomingIncident } = incidentsSlice.actions
export default incidentsSlice.reducer
