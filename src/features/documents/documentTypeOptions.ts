import type { IncidentDocumentTypeCode } from '@/types/accident'

export const getDocumentTypeOptions = (t: (key: string) => string): { value: IncidentDocumentTypeCode; label: string }[] => [
  { value: 'PHOTO', label: t('documents.photo') },
  { value: 'PDF', label: t('documents.pdf') },
  { value: 'SCANNED_DOCUMENT', label: t('documents.scanned_document') },
  { value: 'SKETCH', label: t('documents.sketch') },
  { value: 'REPORT', label: t('documents.report') },
  { value: 'IDENTITY_DOCUMENT', label: t('documents.identity_document') },
  { value: 'INSURANCE_DOCUMENT', label: t('documents.insurance_document') },
  { value: 'VIDEO', label: t('documents.video') },
  { value: 'OTHER', label: t('documents.other') },
]
