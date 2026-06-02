// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import incidentsReducer, {
  approveIncident,
  rejectIncident,
} from './incidentsSlice'

vi.mock('../../../services/api', () => ({
  apiService: {
    incidents: {
      approve: vi.fn(),
      reject: vi.fn(),
    },
  },
}))

import { apiService } from '../../../services/api'

const makeStore = (preloaded = {}) =>
  configureStore({ reducer: { incidents: incidentsReducer }, preloadedState: preloaded })

describe('approveIncident thunk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets approvalStatus to approved on fulfillment', async () => {
    const incident = { id: '42', location: 'Tunis', severity: 'high', status: 'active', vehicles: 1, injuries: 0, time: 'now', approvalStatus: 'pending' as const }
    const store = makeStore({ incidents: { list: [incident], loading: false, error: null, currentIncident: null, total: 1, page: 1, stats: { open: 1, resolved: 0, fatalities: 0, avgResponseTime: 0 } } })

    ;(apiService.incidents.approve as any).mockResolvedValueOnce({ data: { data: { ...incident, approvalStatus: 'approved' } } })

    await store.dispatch(approveIncident({ id: '42', comment: 'Looks correct' }) as any)

    const updated = store.getState().incidents.list.find((i) => i.id === '42')
    expect(updated?.approvalStatus).toBe('approved')
  })

  it('sets error on rejection', async () => {
    const store = makeStore({ incidents: { list: [], loading: false, error: null, currentIncident: null, total: 0, page: 1, stats: { open: 0, resolved: 0, fatalities: 0, avgResponseTime: 0 } } })

    ;(apiService.incidents.approve as any).mockRejectedValueOnce({ response: { data: { message: 'Not found' } } })

    await store.dispatch(approveIncident({ id: '99', comment: 'x' }) as any)

    expect(store.getState().incidents.error).toBe('Not found')
  })
})

describe('rejectIncident thunk', () => {
  it('sets approvalStatus to rejected on fulfillment', async () => {
    const incident = { id: '7', location: 'Sfax', severity: 'low', status: 'active', vehicles: 1, injuries: 0, time: 'now', approvalStatus: 'pending' as const }
    const store = makeStore({ incidents: { list: [incident], loading: false, error: null, currentIncident: null, total: 1, page: 1, stats: { open: 1, resolved: 0, fatalities: 0, avgResponseTime: 0 } } })

    ;(apiService.incidents.reject as any).mockResolvedValueOnce({ data: { data: { ...incident, approvalStatus: 'rejected' } } })

    await store.dispatch(rejectIncident({ id: '7', comment: 'Incomplete data' }) as any)

    const updated = store.getState().incidents.list.find((i) => i.id === '7')
    expect(updated?.approvalStatus).toBe('rejected')
  })
})
