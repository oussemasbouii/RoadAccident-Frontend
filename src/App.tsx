import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import store, { RootState } from './store/store'
import LoginPage from './features/auth/pages/LoginPage'
import AdminSignupPage from './features/auth/pages/AdminSignupPage'
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage'
import DashboardLayout from './components/Layout/DashboardLayout'
import DashboardPage from './features/dashboard/pages/DashboardPage'
import IncidentsPage from './features/incidents/pages/IncidentsPage'
import AlertsPage from './features/alerts/pages/AlertsPage'
import ReportsPage from './features/reports/pages/ReportsPage'
import SettingsPage from './features/settings/pages/SettingsPage'
import AdminAccountsPage from './features/settings/pages/AdminAccountsPage'
import OfficerTrackingPage from './features/admin/pages/OfficerTrackingPage'
import CommsHubPage from './features/communications/pages/CommsHubPage'
import OfficerLocationPublisher from './components/OfficerLocationPublisher'
import RealtimeSync from './components/RealtimeSync'
import ChatRealtimeManager from './components/ChatRealtimeManager'
import ChatDockManager from './components/ChatDockManager'
import CommandBar from './components/CommandBar'
import SocketConnectionManager from './components/SocketConnectionManager'
import CallManager from './components/CallManager'
import { clearAuthStorage, isTokenExpired } from './utils/authSecurity'
import { getAccessToken, setAccessToken, setRefreshToken } from './utils/tokenStore'
import { apiService } from './services/api'
import { setUser } from './features/auth/slices/authSlice'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const dispatch = useDispatch()

  useEffect(() => {
    let mounted = true
    const useRefreshCookie = import.meta.env.VITE_USE_REFRESH_COOKIE === 'true'
    const token = getAccessToken()
    if (token && !isTokenExpired(token)) {
      if (mounted) {
        setIsAuth(true)
        setLoading(false)
      }
      apiService.users.getMe()
        .then((resp) => {
          const user = resp.data?.data ?? resp.data
          if (mounted) dispatch(setUser(user))
        })
        .catch(() => {
          // ignore user fetch errors here; auth remains valid
        })
      return () => {
        mounted = false
      }
    }

    if (!useRefreshCookie) {
      clearAuthStorage()
      if (mounted) {
        dispatch(setUser(null))
        setIsAuth(false)
        setLoading(false)
      }
      return () => {
        mounted = false
      }
    }

    apiService.auth
      .refresh()
      .then((resp) => {
        const payload = resp.data?.data || resp.data || {}
        const { accessToken, refreshToken } = payload
        if (accessToken && !isTokenExpired(accessToken)) {
          setAccessToken(accessToken)
          if (refreshToken) setRefreshToken(refreshToken)
          if (mounted) setIsAuth(true)
          apiService.users.getMe()
            .then((resp) => {
              const user = resp.data?.data ?? resp.data
              if (mounted) dispatch(setUser(user))
            })
            .catch(() => {
              // ignore user fetch errors here; auth remains valid
            })
        } else {
          clearAuthStorage()
          if (mounted) {
            dispatch(setUser(null))
            setIsAuth(false)
          }
        }
      })
      .catch(() => {
        clearAuthStorage()
        if (mounted) {
          dispatch(setUser(null))
          setIsAuth(false)
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen bg-surface">Loading...</div>
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useSelector((state: RootState) => state.auth.user)
  const isAdmin = user?.role === 'admin'
  return isAdmin ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function App() {
  function AuthenticatedServices() {
    const user = useSelector((state: RootState) => state.auth.user)
    const token = useSelector((state: RootState) => state.auth.token)
    const isAuthed = Boolean(user || token)
    if (!isAuthed) return null
    return (
      <>
        <ChatRealtimeManager />
        <ChatDockManager />
        <CommandBar />
        <CallManager />
        <OfficerLocationPublisher />
      </>
    )
  }

  return (
    <Provider store={store}>
      <Router>
        <SocketConnectionManager />
        <RealtimeSync />
        <AuthenticatedServices />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/admin-signup" element={<AdminSignupPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="communications" element={<CommsHubPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin/accounts" element={<AdminRoute><AdminAccountsPage /></AdminRoute>} />
            <Route path="admin/officer-tracking" element={<AdminRoute><OfficerTrackingPage /></AdminRoute>} />
            <Route index element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </Provider>
  )
}

export default App
