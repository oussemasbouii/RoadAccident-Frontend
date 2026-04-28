import { useCallback, useEffect, useRef } from 'react'

type ToneSpec = {
  frequency: number
  duration: number
  delay: number
  gain: number
}

const RINGTONE_PATTERN: ToneSpec[] = [
  { frequency: 440, duration: 240, delay: 0, gain: 0.1 },
  { frequency: 494, duration: 240, delay: 280, gain: 0.1 },
]

const BEEP_PATTERN: ToneSpec[] = [
  { frequency: 659, duration: 120, delay: 0, gain: 0.08 },
]

function createAudioContext() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  return AudioCtx ? new AudioCtx() : null
}

function playToneSequence(ctx: AudioContext, tones: ToneSpec[]) {
  const destination = ctx.destination
  const startAt = ctx.currentTime + 0.02

  tones.forEach((tone) => {
    const noteStart = startAt + tone.delay / 1000
    const noteStop = noteStart + tone.duration / 1000

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, noteStart)
    masterGain.gain.linearRampToValueAtTime(tone.gain, noteStart + 0.018)
    masterGain.gain.linearRampToValueAtTime(tone.gain * 0.7, noteStart + 0.06)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, noteStop)

    const oscillator = ctx.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = tone.frequency
    oscillator.connect(masterGain)
    masterGain.connect(destination)

    oscillator.start(noteStart)
    oscillator.stop(noteStop + 0.03)
  })
}

export function useCallRingtone(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const ringTimerRef = useRef<number | null>(null)
  const unlockListenersRef = useRef<(() => void) | null>(null)
  const pendingStartRef = useRef(false)
  const isRingingRef = useRef(false)

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      ctxRef.current = createAudioContext()
    }
    return ctxRef.current
  }, [])

  const stop = useCallback(() => {
    pendingStartRef.current = false
    isRingingRef.current = false
    if (ringTimerRef.current !== null) {
      window.clearInterval(ringTimerRef.current)
      ringTimerRef.current = null
    }
    if (unlockListenersRef.current) {
      document.removeEventListener('pointerdown', unlockListenersRef.current)
      document.removeEventListener('keydown', unlockListenersRef.current)
      document.removeEventListener('touchstart', unlockListenersRef.current)
      unlockListenersRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    if (!enabled) {
      pendingStartRef.current = false
      return
    }

    const ctx = ensureContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      pendingStartRef.current = true
      return
    }

    if (isRingingRef.current) return
    isRingingRef.current = true
    pendingStartRef.current = false

    const playCycle = () => {
      if (!isRingingRef.current) return
      playToneSequence(ctx, RINGTONE_PATTERN)
      window.setTimeout(() => {
        if (!isRingingRef.current) return
        playToneSequence(ctx, BEEP_PATTERN)
      }, 40)
    }

    playCycle()
    ringTimerRef.current = window.setInterval(playCycle, 2600)
  }, [enabled, ensureContext])

  useEffect(() => {
    const ctx = ensureContext()
    if (!ctx) return

    const unlockAudio = async () => {
      if (!ctxRef.current) return
      if (ctxRef.current.state === 'suspended') {
        try {
          await ctxRef.current.resume()
        } catch (error) {
          console.warn('[CallAudio] unlock failed:', error)
          return
        }
      }
      if (pendingStartRef.current && enabled) {
        void start()
      }
    }

    unlockListenersRef.current = () => {
      void unlockAudio()
    }

    document.addEventListener('pointerdown', unlockListenersRef.current, { passive: true })
    document.addEventListener('keydown', unlockListenersRef.current, { passive: true })
    document.addEventListener('touchstart', unlockListenersRef.current, { passive: true })

    if (ctx.state === 'running' && enabled) {
      void start()
    }

    return () => {
      stop()
    }
  }, [enabled, ensureContext, start, stop])

  useEffect(() => {
    if (enabled) {
      void start()
    } else {
      stop()
    }
  }, [enabled, start, stop])

  return { start, stop }
}
