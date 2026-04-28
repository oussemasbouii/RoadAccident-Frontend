import { useState, useEffect } from 'react'

export function useCallTimer(startedAt: number | undefined) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0)
      return
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt])

  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return { elapsed, formatted: formatElapsed(elapsed) }
}

