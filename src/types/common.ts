// Common types used across the application

export type AttachmentTypeCode = 'photo' | 'sketch_png' | 'sketch_json'

export type UploadStatusCode = 'pending' | 'uploading' | 'completed' | 'failed'

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface ApiError {
  success: boolean
  message: string
  errors?: Array<{
    field: string
    message: string
    code?: string
  }>
}

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Status = 'active' | 'responded' | 'resolved'

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilterParams {
  search?: string
  severity?: Severity
  status?: Status
  dateFrom?: string
  dateTo?: string
  location?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}