import { createSlice } from '@reduxjs/toolkit'

export interface AuthUser {
  id: string
  officerId?: string
  firstName?: string
  lastName?: string
  displayName?: string
  center?: string
  role?: 'admin' | 'dispatch' | 'officer' | string
  phoneNumber?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('accessToken'),
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
      localStorage.setItem('accessToken', action.payload)
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
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    },
  },
})

export const { setUser, setToken, setLoading, setError, logout } = authSlice.actions
export default authSlice.reducer
