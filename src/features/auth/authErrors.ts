// Shared parsing of auth-form (signup / register) backend errors into friendly,
// field-level messages. Translates AJV / validation strings such as
// "body must have required property 'center'" into readable, per-field errors.

// Human-readable label per backend field name.
const FIELD_LABELS: Record<string, string> = {
  officerId: 'Officer ID',
  firstName: 'First name',
  lastName: 'Last name',
  phoneNumber: 'Phone number',
  center: 'Center / Station',
  password: 'Password',
  role: 'Role',
}

// Map a backend field name to the form's field-error key (state uses `phone`, API uses `phoneNumber`).
const FIELD_KEY: Record<string, string> = {
  officerId: 'officerId',
  firstName: 'firstName',
  lastName: 'lastName',
  phoneNumber: 'phone',
  center: 'center',
  password: 'password',
  role: 'role',
}

// Turn a single backend/AJV validation string into a friendly message + the field it refers to.
function humanizeValidationMessage(raw: string): { field?: string; message: string } {
  const s = String(raw || '').trim()
  // "body must have required property 'center'"
  let m = s.match(/required property ['"]?(\w+)['"]?/i)
  if (m) return { field: m[1], message: `${FIELD_LABELS[m[1]] ?? m[1]} is required.` }
  // "body/password must NOT have fewer than 12 characters"
  m = s.match(/(?:body\/)?(\w+)\b.*fewer than (\d+) characters/i)
  if (m) return { field: m[1], message: `${FIELD_LABELS[m[1]] ?? m[1]} must be at least ${m[2]} characters.` }
  // "body/phoneNumber must match format/pattern ..."
  m = s.match(/(?:body\/)?(\w+)\b.*must match (?:format|pattern)/i)
  if (m) return { field: m[1], message: `${FIELD_LABELS[m[1]] ?? m[1]} has an invalid format.` }
  // generic "body/<field> <rest>"
  m = s.match(/^body\/(\w+)\s+(.*)$/i)
  if (m) return { field: m[1], message: `${FIELD_LABELS[m[1]] ?? m[1]} ${m[2]}` }
  return { message: s }
}

export interface ParsedAuthError {
  status?: number
  message: string
  fieldErrors: Record<string, string>
}

// Parse an axios error from a signup/register request into a user-facing summary
// plus per-field errors mapped to the form's field keys.
export function parseAuthFormError(err: any): ParsedAuthError {
  const fieldErrors: Record<string, string> = {}
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return { message: 'No internet connection. Please check your network.', fieldErrors }

  const status = err?.response?.status
  const data   = err?.response?.data

  // Gather raw validation strings from the common response shapes.
  const rawMessages: string[] = []
  if (Array.isArray(data?.errors)) data.errors.forEach((e: any) => rawMessages.push(e?.message || e?.msg || String(e)))
  if (Array.isArray(data?.message)) (data.message as any[]).forEach((mm) => rawMessages.push(String(mm)))
  else if (typeof data?.message === 'string') rawMessages.push(data.message)
  else if (typeof data?.error === 'string') rawMessages.push(data.error)
  else if (typeof data?.detail === 'string') rawMessages.push(data.detail)

  const friendly: string[] = []
  for (const raw of rawMessages) {
    const { field, message } = humanizeValidationMessage(raw)
    friendly.push(message)
    if (field) {
      const key = FIELD_KEY[field] ?? field
      if (!fieldErrors[key]) fieldErrors[key] = message
    }
  }

  const fieldList = Object.values(fieldErrors)
  if (fieldList.length > 0) {
    return {
      status,
      message: fieldList.length === 1 ? fieldList[0] : `Please fix ${fieldList.length} fields below.`,
      fieldErrors,
    }
  }

  const combined = friendly.filter(Boolean).join(' · ')
  if (status === 400) return { status, message: combined || 'Invalid request — please check the fields.', fieldErrors }
  if (status === 401) return { status, message: 'Your session expired. Please sign in again.', fieldErrors }
  if (status === 403) return { status, message: 'You do not have permission to perform this action.', fieldErrors }
  if (status === 409) return { status, message: combined || 'An account with this Officer ID already exists.', fieldErrors }
  if (status === 422) return { status, message: combined || 'Some fields are invalid — please review and try again.', fieldErrors }
  if (status === 429) return { status, message: 'Too many attempts. Please wait a moment and try again.', fieldErrors }
  if (status != null && status >= 500) return { status, message: 'Server error. Please try again later.', fieldErrors }
  return { status, message: combined || err?.message || 'Operation failed. Please try again.', fieldErrors }
}
