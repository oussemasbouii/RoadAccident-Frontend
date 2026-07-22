import type { DocumentCategory } from '@/types/document'

// Business-domain classification for the Document Center (GED) — distinct
// from the legacy per-incident attachment type codes in documentTypeOptions.ts.
export const getDocumentCategoryOptions = (t: (key: string) => string): { value: DocumentCategory; label: string }[] => [
  { value: 'accident', label: t('documents.category_accident') },
  { value: 'legal', label: t('documents.category_legal') },
  { value: 'administrative', label: t('documents.category_administrative') },
  { value: 'financial', label: t('documents.category_financial') },
  { value: 'report', label: t('documents.category_report') },
  { value: 'other', label: t('documents.category_other') },
]
