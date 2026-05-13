import axios from 'axios'
import { 
  AccidentReport, 
  CreateAccidentResponse, 
  CreateAccidentErrorResponse,
  IncidentDocumentUploadConfirmRequest,
  IncidentDocumentUploadRequest,
  IncidentDocumentUpdateRequest,
} from '@/types/accident'
import { clearAuthStorage } from '@/utils/authSecurity'
import { getAccessToken, getDeviceId, getRefreshToken, setAccessToken, setRefreshToken } from '@/utils/tokenStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

let isRefreshing = false
let failedQueue: Array<any> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

const extractTokens = (payload: any) => {
  const source = payload?.data || payload || {}
  return {
    accessToken: source.accessToken,
    refreshToken: source.refreshToken,
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const requestUrl = originalRequest?.url || ''
    const isAuthEndpoint =
      requestUrl.includes('/auth/signin') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/signout')
    const isSignin = requestUrl.includes('/auth/signin')
    const status = error.response?.status
    const shouldLogVerbose =
      import.meta.env.DEV &&
      !(isSignin && (status === 401 || status === 403 || status === 423 || status === 500))

    if (shouldLogVerbose) {
      console.error('API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: originalRequest?.url,
        method: originalRequest?.method,
        message: error.message,
      })
    }

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = getRefreshToken()
      const deviceId = getDeviceId()
      const useRefreshCookie = import.meta.env.VITE_USE_REFRESH_COOKIE === 'true'

      if (!refreshToken && !useRefreshCookie) {
        isRefreshing = false
        return Promise.reject(error)
      }

      try {
        const refreshPayload = refreshToken
          ? (deviceId ? { refreshToken, deviceId } : { refreshToken })
          : {}
        const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, refreshPayload, {
          withCredentials: true,
        })
        const { accessToken, refreshToken: newRefresh } = extractTokens(resp.data)

        if (!accessToken) {
          throw new Error('Refresh succeeded but no access token was returned')
        }

        setAccessToken(accessToken)
        if (newRefresh) setRefreshToken(newRefresh)
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
        processQueue(null, accessToken)
        return api(originalRequest)
      } catch (err) {
        processQueue(err, null)
        clearAuthStorage()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// API service methods
export const apiService = {
  // Auth
  auth: {
    signin: (data: {
      officerId: string
      password: string
      deviceInfo: {
        deviceId: string
        name: string
        model: string
        operatingSystem: string
        osVersion: string
        manufacturer: string
      }
    }) => api.post('/auth/signin', data),
    signup: (data: {
      officerId: string
      password: string
      center: string
      firstName: string
      lastName: string
      role: string
      phoneNumber: string
    }) => api.post('/auth/signup', data),
    adminSignup: (data: {
      officerId?: string
      email?: string
      password: string
      firstName: string
      lastName: string
      phoneNumber?: string
      center?: string
      role?: 'admin'
    }) => api.post('/auth/admin/signup', data),
    requestPasswordReset: (data: { email?: string; officerId?: string }) =>
      api.post('/auth/password/forgot', data),
    verifyPasswordResetToken: (data: { token: string; email?: string; officerId?: string }) =>
      api.post('/auth/password/verify', data),
    resetPassword: (data: {
      token: string
      newPassword: string
      confirmPassword?: string
      email?: string
      officerId?: string
    }) => api.post('/auth/password/reset', data),
    refresh: (data: { refreshToken?: string; deviceId?: string } = {}) => api.post('/auth/refresh', data),
    signout: () => api.post('/auth/signout'),
  },

  // Incidents
  incidents: {
    getAll: (page = 1, limit = 10) => api.get('/accidents/', { params: { page, limit } }),
    getById: (id: string) => api.get(`/accidents/${id}`),
    create: (data: Record<string, unknown>) => api.post<CreateAccidentResponse>('/accidents/', data),
    update: (id: string, data: Record<string, unknown>) => api.put(`/accidents/${id}`, data),
  },

  // Accidents
  accidents: {
    create: (data: AccidentReport) => api.post<CreateAccidentResponse>('/accidents/', data),
    getAll: (page = 1, limit = 10) => api.get('/accidents/', { params: { page, limit } }),
    getById: (id: string) => api.get(`/accidents/${id}`),
  },

  // Alerts
  alerts: {
    create: (data: any) => api.post('/alerts/', data),
    getSent: () => api.get('/alerts/sent'),
    getReceived: () => api.get('/alerts/received'),
    acknowledge: (alertId: string) => api.post(`/alerts/${alertId}/acknowledge`),
  },

  // Reports
  reports: {
    getAll: (page = 1, limit = 10) => api.get('/reports', { params: { page, limit } }),
    getById: (id: string) => api.get(`/reports/${id}`),
    create: (data: any) => api.post('/reports', data),
    getAnalytics: () => api.get('/reports/analytics'),
    getStats: () => api.get('/reports/stats'),
    getIncidentsByLocation: () => api.get('/reports/incidents-by-location'),
  },

  // Dashboard
  dashboard: {
    getSummary: () => api.get('/dashboard/summary'),
    getRecentIncidents: (limit = 5) => api.get('/dashboard/recent-incidents', { params: { limit } }),
    getSystemStatus: () => api.get('/dashboard/system-status'),
  },

  // Users
  users: {
    getMe: () => api.get('/users/me'),
    updateMe: (data: Record<string, unknown>) => api.patch('/users/me', data),
    list: (params?: { search?: string; page?: number; limit?: number }) =>
      api.get('/users/', { params: { search: params?.search, page: params?.page, limit: params?.limit } }),
    getById: (id: string) => api.get(`/users/${id}`),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/users/${id}`, data),
    updateStatus: (
      id: string,
      data: { isValid?: boolean; isFrozen?: boolean; reason?: string }
    ) => api.patch(`/users/${id}/status`, data),
    updatePassword: (id: string, data: { newPassword: string }) => api.patch(`/users/${id}/password`, data),
    revokeSessions: (id: string) => api.post(`/users/${id}/sessions/revoke`),
    // Check user status by officerId (for login assistance)
    checkStatus: (officerId: string) => api.get(`/users/status/${officerId}`),
  },

  // Chat
  chat: {
    status: (userIds: string[]) =>
      api.get('/chat/status', { params: { userIds: userIds.join(',') } }),
  },

  // Calls
  calls: {
    initiate: (data: { calleeId: string; roomId: string; callType: 'audio' | 'video' }) =>
      api.post('/calls/initiate', data),
  },

  // Administration
  admin: {
    listOfficers: (params?: { query?: string; page?: number; limit?: number }) =>
      api.get('/admin/officers', { params }),
    getOfficerLocations: () => api.get('/admin/officers/locations'),
    validateOfficer: (officerId: string, data: { reason?: string; actorId?: string }) =>
      api.post(`/admin/officers/${officerId}/validate`, data),
    updateOfficerStatus: (
      officerId: string,
      data: { status: 'active' | 'blocked' | 'restricted'; reason?: string; actorId?: string; expiresAt?: string }
    ) => api.patch(`/admin/officers/${officerId}/status`, data),
    deleteOfficer: (officerId: string, data: { reason?: string; actorId?: string }) =>
      api.delete(`/admin/officers/${officerId}`, { data }),
    triggerOfficerPasswordReset: (officerId: string, data: { reason?: string; actorId?: string }) =>
      api.post(`/admin/officers/${officerId}/password-reset`, data),
  },

  // Attachments
  attachments: {
    requestUpload: (data: { filename: string; mimeType: string; fileType: 'IMAGE'; size: number }) =>
      api.post('/attachments/request-upload', data),
    confirmUpload: (data: {
      clientId: string
      key: string
      filename: string
      mimeType: string
      fileType: 'IMAGE'
      size: number
    }) => api.post('/attachments/confirm-upload', data),
    getDownload: (id: string) => api.get(`/attachments/${id}`),
  },

  // Incident documents
  incidentDocuments: {
    requestUpload: (accidentId: string, data: IncidentDocumentUploadRequest) =>
      api.post(`/accidents/${accidentId}/documents/request-upload`, data),
    confirmUpload: (accidentId: string, data: IncidentDocumentUploadConfirmRequest) =>
      api.post(`/accidents/${accidentId}/documents/confirm-upload`, data),
    list: (accidentId: string) => api.get(`/accidents/${accidentId}/documents`),
    getDownload: (accidentId: string, documentId: string) =>
      api.get(`/accidents/${accidentId}/documents/${documentId}/download`),
    update: (accidentId: string, documentId: string, data: IncidentDocumentUpdateRequest) =>
      api.patch(`/accidents/${accidentId}/documents/${documentId}`, data),
    archive: (accidentId: string, documentId: string, data?: { reason?: string }) =>
      api.post(`/accidents/${accidentId}/documents/${documentId}/archive`, data || {}),
    remove: (accidentId: string, documentId: string, data?: { reason?: string }) =>
      api.delete(`/accidents/${accidentId}/documents/${documentId}`, { data }),
    replace: (
      accidentId: string,
      documentId: string,
      data: IncidentDocumentUploadConfirmRequest & { replacedByDocumentId?: string }
    ) => api.post(`/accidents/${accidentId}/documents/${documentId}/replace`, data),
  },
}

export default api












