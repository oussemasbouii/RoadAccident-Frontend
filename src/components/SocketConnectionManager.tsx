import { useEffect } from 'react'
import { useAppSelector } from '@/store/store'
import { getRefreshToken } from '@/utils/tokenStore'
import { connectSharedSocket, disconnectSharedSocket } from '@/services/socketClient'

export default function SocketConnectionManager() {
  const token = useAppSelector((state) => state.auth.token)

  useEffect(() => {
    if (!token) {
      disconnectSharedSocket()
      return
    }

    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      if (import.meta.env.DEV) {
        console.warn('[Socket] Missing refresh token, skipping socket connection')
      }
      disconnectSharedSocket()
      return
    }

    connectSharedSocket(refreshToken)
  }, [token])

  return null
}
