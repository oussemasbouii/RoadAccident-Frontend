import { io, Socket } from 'socket.io-client'

const BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || 'https://micladevops.com'
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/api/v2/socket.io'

const RECONNECTION_ATTEMPTS = 2147483647

let sharedSocket: Socket | null = null
let currentAuthToken: string | null = null

function createSocket(authToken: string) {
  return io(BASE_URL, {
    path: SOCKET_PATH,
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 20000,
    autoConnect: false,
  })
}

export function getSharedSocket() {
  return sharedSocket
}

export function connectSharedSocket(authToken: string) {
  if (!authToken) return null

  if (!sharedSocket) {
    sharedSocket = createSocket(authToken)
    currentAuthToken = authToken
  }

  const authChanged = currentAuthToken !== authToken
  if (authChanged && sharedSocket) {
    currentAuthToken = authToken
    sharedSocket.auth = { token: authToken }
    if (sharedSocket.connected) {
      sharedSocket.disconnect()
    }
  }

  if (!sharedSocket.connected) {
    sharedSocket.connect()
  }

  return sharedSocket
}

export function disconnectSharedSocket() {
  if (!sharedSocket) return
  sharedSocket.disconnect()
}

export function resetSharedSocket() {
  if (!sharedSocket) return
  sharedSocket.removeAllListeners()
  sharedSocket.disconnect()
  sharedSocket = null
  currentAuthToken = null
}
