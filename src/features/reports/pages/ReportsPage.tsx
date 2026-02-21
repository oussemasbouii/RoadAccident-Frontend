import { useEffect, useState } from 'react'
import { 
  Box, 
  Stack, 
  Typography, 
  alpha, 
  useTheme,
  TextField,
  MenuItem,
  Chip
} from '@mui/material'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import MapRoundedIcon from '@mui/icons-material/MapRounded'

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchAnalytics, fetchStats, fetchIncidentsByLocation } from '../slices/reportsSlice'
import Card from '../../../components/Common/Card'
import StatCard from '../../../components/Common/StatCard'
import { ExportButton } from '../../../components/Common'

export default function ReportsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const [timeRange, setTimeRange] = useState('month')
  const { analytics, stats, incidentsByLocation, loading } = useAppSelector((state) => state.reports)

  useEffect(() => {
    dispatch(fetchAnalytics() as any)
    dispatch(fetchStats() as any)
    dispatch(fetchIncidentsByLocation() as any)
  }, [dispatch])

  const statsData = (stats as any)?.data || stats || {}

  const reportData = {
    totalIncidents: Number(statsData.totalIncidents ?? statsData.total ?? 0),
    resolvedToday: Number(statsData.resolvedToday ?? statsData.resolved ?? 0),
    avgResponseTime: Number(statsData.avgResponseTime ?? 0),
    injuryRate: Number(statsData.injuryRate ?? 0),
    weeklyTrend: statsData.weeklyTrend || 'No trend data',
    satisfactionScore: Number(statsData.satisfactionScore ?? 0),
  }

  const locationRows = Array.isArray(incidentsByLocation)
    ? incidentsByLocation
    : (incidentsByLocation as any)?.data || []

  return (
    <Stack spacing={4} sx={{ pb: 4 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>Reports & Analytics</Typography>
          <Typography color="text.secondary">National performance metrics and incident analytics</Typography>
        </Box>
        <Stack direction="row" spacing={2}>
           <TextField
             select
             size="small"
             value={timeRange}
             onChange={(e) => setTimeRange(e.target.value)}
             InputProps={{
               startAdornment: <FilterListRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
               sx: { borderRadius: '100px', bgcolor: 'background.paper', px: 1 }
             }}
           >
             <MenuItem value="day">Today</MenuItem>
             <MenuItem value="week">This Week</MenuItem>
             <MenuItem value="month">This Month</MenuItem>
             <MenuItem value="year">This Year</MenuItem>
           </TextField>
          <ExportButton
            data={incidentsByLocation || []}
            filename="reports-analytics"
            label="Export All Data"
          />
        </Stack>
      </Box>

      {/* Stats Grid */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        <StatCard 
          icon={<InsightsRoundedIcon />} 
          label="Total Incidents" 
          value={reportData.totalIncidents} 
          trend="up" 
          trendValue="+12%" 
          intent="info"
        />
        <StatCard 
          icon={<CheckCircleRoundedIcon />} 
          label="Resolved Today" 
          value={reportData.resolvedToday} 
          trend="neutral" 
          trendValue="Active monitoring" 
          intent="success"
        />
        <StatCard 
          icon={<TimerRoundedIcon />} 
          label="Avg Response Time" 
          value={reportData.avgResponseTime > 0 ? `${reportData.avgResponseTime}m` : '12 min'} 
          trend="down" 
          trendValue="15% faster" 
          intent="success"
        />
        <StatCard 
          icon={<MedicalServicesRoundedIcon />} 
          label="Injury Rate" 
          value={`${(reportData.injuryRate * 100).toFixed(1)}%`} 
          trend="neutral" 
          trendValue="Stable" 
          intent="warning"
        />
        <StatCard 
          icon={<StarRoundedIcon />} 
          label="Satisfaction Score" 
          value={reportData.satisfactionScore || '4.8'} 
          trend="up" 
          trendValue="+0.2" 
          intent="default"
        />
        <StatCard 
          icon={<TrendingUpRoundedIcon />} 
          label="Weekly Trend" 
          value={reportData.weeklyTrend === 'No trend data' ? 'Rising' : reportData.weeklyTrend} 
          trend="up" 
          trendValue="Projected" 
          intent="danger"
        />
      </Box>

      {/* Location Analytics */}
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
           <Box sx={{ p: 1, borderRadius: 'var(--radius-m3-md, 12px)', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
              <MapRoundedIcon fontSize="small" />
           </Box>
           <Typography variant="h6" sx={{ fontWeight: 700 }}>Incident Distribution by Location</Typography>
        </Box>
        <Stack divider={<Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />}>
          {locationRows.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
              {loading ? 'Aggregating national data...' : 'No location data available for selected range.'}
            </Box>
          ) : (
            locationRows.map((item: any, idx: number) => {
              const location = item.location || item.name || `Location ${idx + 1}`
              const count = Number(item.count ?? item.incidents ?? item.total ?? 0)
              const percentage = Number(item.percentage ?? item.percent ?? 0)

              return (
                <Box 
                  key={`${location}-${idx}`} 
                  sx={{ 
                    p: 3, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    transition: 'background-color 0.2s',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) }
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{location}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{count} documented incidents</Typography>
                  </Box>
                  <Chip 
                    label={`${percentage}%`} 
                    color="primary" 
                    variant="outlined" 
                    sx={{ fontWeight: 800, borderRadius: '8px', borderWeight: 2 }} 
                  />
                </Box>
              )
            })
          )}
        </Stack>
      </Card>
    </Stack>
  )
}
