import { useCallback, useState } from 'react'
import type { DocumentSearchParams } from '@/types/document'

export type SavedDocumentFilterView = {
  id: string
  name: string
  filters: DocumentSearchParams
}

const STORAGE_KEY = 'roadaccident:documents:saved-views'

const readSavedViews = (): SavedDocumentFilterView[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeSavedViews = (views: SavedDocumentFilterView[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

export function useSavedDocumentFilters() {
  const [savedViews, setSavedViews] = useState<SavedDocumentFilterView[]>(() => readSavedViews())

  const saveView = useCallback((name: string, filters: DocumentSearchParams) => {
    const view: SavedDocumentFilterView = { id: crypto.randomUUID(), name, filters }
    setSavedViews((prev) => {
      const next = [...prev, view]
      writeSavedViews(next)
      return next
    })
  }, [])

  const removeView = useCallback((id: string) => {
    setSavedViews((prev) => {
      const next = prev.filter((view) => view.id !== id)
      writeSavedViews(next)
      return next
    })
  }, [])

  return { savedViews, saveView, removeView }
}
