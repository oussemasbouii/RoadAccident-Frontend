let accessToken: string | null = null
let refreshToken: string | null = null
let deviceId: string | null = null
const ACCESS_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'
const DEVICE_KEY = 'deviceId'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readStorage(key: string) {
  if (!canUseStorage()) return null
  return window.localStorage.getItem(key)
}

function writeStorage(key: string, value: string | null) {
  if (!canUseStorage()) return
  if (value) window.localStorage.setItem(key, value)
  else window.localStorage.removeItem(key)
}

export function getAccessToken() {
  if (!accessToken) accessToken = readStorage(ACCESS_KEY)
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  writeStorage(ACCESS_KEY, token)
}

export function getRefreshToken() {
  if (!refreshToken) refreshToken = readStorage(REFRESH_KEY)
  return refreshToken
}

export function setRefreshToken(token: string | null) {
  refreshToken = token
  writeStorage(REFRESH_KEY, token)
}

export function getDeviceId() {
  if (!deviceId) deviceId = readStorage(DEVICE_KEY)
  return deviceId
}

export function setDeviceId(value: string | null) {
  deviceId = value
  writeStorage(DEVICE_KEY, value)
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
  deviceId = null
  writeStorage(ACCESS_KEY, null)
  writeStorage(REFRESH_KEY, null)
  writeStorage(DEVICE_KEY, null)
}
