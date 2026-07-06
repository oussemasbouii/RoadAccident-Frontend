import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startIdleWatcher } from './authSecurity'

describe('startIdleWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onTimeout after the specified timeout with no activity', () => {
    const onTimeout = vi.fn()
    const stop = startIdleWatcher(5000, onTimeout)
    vi.advanceTimersByTime(5001)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('resets the timer on mouse activity', () => {
    const onTimeout = vi.fn()
    const stop = startIdleWatcher(5000, onTimeout)
    vi.advanceTimersByTime(3000)
    window.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(3000)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2001)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stop() prevents the callback from firing', () => {
    const onTimeout = vi.fn()
    const stop = startIdleWatcher(5000, onTimeout)
    vi.advanceTimersByTime(3000)
    stop()
    vi.advanceTimersByTime(5000)
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
