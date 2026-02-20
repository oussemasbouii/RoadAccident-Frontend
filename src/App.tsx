import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import store from './store/store'
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
import { clearAuthStorage, isTokenExpired } from './utils/authSecurity'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token || isTokenExpired(token)) {
      clearAuthStorage()
      setIsAuth(false)
      setLoading(false)
      return
    }
    setIsAuth(true)
    setLoading(false)
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen bg-surface">Loading...</div>
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Provider store={store}>
      <Router>
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
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin/accounts" element={<AdminAccountsPage />} />
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
