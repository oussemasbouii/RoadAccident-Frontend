import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { searchDocuments } from '../slices/documentsSlice'
import type { DocumentSearchParams, GedDocument } from '@/types/document'

const DEBOUNCE_MS = 350

type DocumentsState = {
  list: GedDocument[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
}

export function useDocumentsSearch(initialFilters: DocumentSearchParams = {}) {
  const dispatch = useAppDispatch()
  const { list, total, page, pageSize, loading, error } = useAppSelector((state) => state.documents) as DocumentsState
  const [filters, setFilters] = useState<DocumentSearchParams>({ page: 1, pageSize: 20, ...initialFilters })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevFiltersRef = useRef<DocumentSearchParams>(filters)

  useEffect(() => {
    // Only the free-text `q` box should be debounced (it changes per keystroke).
    // Structured filters and pagination — category, dates, page, page size, etc.
    // — dispatch immediately so a dropdown/page change feels instant instead of
    // sitting behind the 350 ms text-search delay.
    const prev = prevFiltersRef.current
    const nonQChanged = (Object.keys({ ...prev, ...filters }) as (keyof DocumentSearchParams)[]).some(
      (k) => k !== 'q' && prev[k] !== filters[k],
    )
    prevFiltersRef.current = filters
    const delay = nonQChanged ? 0 : DEBOUNCE_MS

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void dispatch(searchDocuments(filters) as any)
    }, delay)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [dispatch, filters])

  const updateFilters = (patch: Partial<DocumentSearchParams>) => {
    setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }))
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / (pageSize || 20))), [total, pageSize])

  return {
    documents: list,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    filters,
    updateFilters,
    refresh: () => dispatch(searchDocuments(filters) as any),
  }
}
