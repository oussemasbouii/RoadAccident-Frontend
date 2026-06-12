import { clearTokens } from './tokenStore'

export function clearAuthStorage() {
  if (import.meta.env.DEV) {
    console.trace('🗑️ clearAuthStorage called - clearing auth tokens')
  }
  clearTokens()
}

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isTokenExpired(token: string) {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  const nowSeconds = Math.floor(Date.now() / 1000)
  return nowSeconds >= Number(payload.exp)
}

const IDLE_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

export function startIdleWatcher(timeoutMs: number, onTimeout: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>

  const reset = () => {
    clearTimeout(timer)
    timer = setTimeout(onTimeout, timeoutMs)
  }

  IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
  reset()

  return () => {
    clearTimeout(timer)
    IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset))
  }
}
