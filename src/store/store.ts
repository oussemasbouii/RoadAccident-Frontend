import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import authReducer from '../features/auth/slices/authSlice'
import incidentsReducer from '../features/incidents/slices/incidentsSlice'
import alertsReducer from '../features/alerts/slices/alertsSlice'
import reportsReducer from '../features/reports/slices/reportsSlice'

const store = configureStore({
  reducer: {
    auth: authReducer,
    incidents: incidentsReducer,
    alerts: alertsReducer,
    reports: reportsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Export hooks
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector = (selector: (state: RootState) => any) => useSelector(selector)

export default store
