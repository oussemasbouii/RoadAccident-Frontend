const DEFAULT_INSTITUTIONAL_DOMAIN = 'institution.gov'

export const INSTITUTIONAL_DOMAIN =
  import.meta.env.VITE_INSTITUTIONAL_EMAIL_DOMAIN || DEFAULT_INSTITUTIONAL_DOMAIN

export function isInstitutionalEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return normalized.endsWith(`@${INSTITUTIONAL_DOMAIN.toLowerCase()}`)
}
