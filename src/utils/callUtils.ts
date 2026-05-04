export function decodeJwtSub(token?: string | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const payload = JSON.parse(atob(parts[1]))
    return payload?.sub ? String(payload.sub) : null
  } catch {
    return null
  }
}

export function hasLiveKitUrl() {
  return Boolean(import.meta.env.VITE_LIVEKIT_URL?.trim())
}

export async function requestMicrophonePermission(contextLabel: string) {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.warn(`[CallFlow] ${contextLabel} - mediaDevices.getUserMedia is unavailable`)
    return false
  }

  console.log(`[CallFlow] ${contextLabel} - requesting microphone permission`)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    stream.getTracks().forEach((track) => track.stop())
    console.log(`[CallFlow] ${contextLabel} - microphone permission granted`)
    return true
  } catch (error) {
    console.error(`[CallFlow] ${contextLabel} - microphone permission denied`, error)
    return false
  }
}

export function isUuidLike(value?: string | null) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

export function shortIdentifier(value?: string | null) {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed.length <= 8 ? trimmed : trimmed.slice(-6)
}
