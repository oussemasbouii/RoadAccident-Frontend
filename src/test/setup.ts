import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── Polyfills for libraries that touch browser globals at import time ──────────
// maplibre-gl references Worker on import (used by several map components/utils),
// which happy-dom doesn't provide — stub it so those modules load under test.
if (typeof (globalThis as any).Worker === 'undefined') {
  class WorkerStub {
    onmessage: ((e: any) => void) | null = null
    onerror: ((e: any) => void) | null = null
    postMessage(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
    terminate(): void {}
  }
  ;(globalThis as any).Worker = WorkerStub as unknown as typeof Worker
}

// maplibre-gl also constructs ImageData asynchronously in its worker state sync,
// which the test DOM doesn't provide → stub it to avoid unhandled rejections.
if (typeof (globalThis as any).ImageData === 'undefined') {
  class ImageDataStub {
    width: number
    height: number
    data: Uint8ClampedArray
    constructor(a: number | Uint8ClampedArray, b?: number, c?: number) {
      if (typeof a === 'number') {
        this.width = a
        this.height = b ?? 0
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else {
        this.data = a
        this.width = b ?? 0
        this.height = c ?? 0
      }
    }
  }
  ;(globalThis as any).ImageData = ImageDataStub as unknown as typeof ImageData
}

if (typeof URL !== 'undefined' && typeof (URL as any).createObjectURL === 'undefined') {
  ;(URL as any).createObjectURL = () => 'blob:stub'
  ;(URL as any).revokeObjectURL = () => {}
}

// MUI's useMediaQuery needs matchMedia; default to "no match" (desktop layout) in tests.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  ;(window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// ── Neutralize network in tests ────────────────────────────────────────────────
// Any apiService.<group>.<method>(...) call resolves with empty data, so tests
// never hit a real backend (was causing ECONNREFUSED to localhost:3000). Mocking
// by the alias also covers relative imports — they resolve to the same module.
vi.mock('@/services/api', () => {
  const resolved = () => Promise.resolve({ data: { data: [] } })
  const makeProxy = (): any => new Proxy(resolved, { get: () => makeProxy() })
  return { apiService: makeProxy(), default: makeProxy() }
})
