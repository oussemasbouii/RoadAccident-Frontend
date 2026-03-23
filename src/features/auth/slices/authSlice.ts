import { createSlice } from '@reduxjs/toolkit'
import { getAccessToken, setAccessToken, clearTokens } from '../../../utils/tokenStore'

export interface AuthUser {
  id: string
  officerId?: string
  firstName?: string
  lastName?: string
  displayName?: string
  center?: string
  role?: 'admin' | 'dispatch' | 'officer' | string
  phoneNumber?: string
  isValid?: boolean
  isFrozen?: boolean
  validated?: boolean
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  token: getAccessToken(),
  isLoading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload
    },
    setToken: (state, action) => {
      state.token = action.payload
      setAccessToken(action.payload)
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
    },
    logout: (state) => {
      state.user = null
      state.token = null
      clearTokens()
    },
  },
})

export const { setUser, setToken, setLoading, setError, logout } = authSlice.actions
export default authSlice.reducer
