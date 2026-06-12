import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Box, useMediaQuery, useTheme, Drawer, Alert, Collapse, IconButton, alpha, Typography, Stack } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppSelector } from '../../store/store'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useThemeMode, useTranslation } from '../../themeMode'
import { pageVariants } from '../../utils/motion'

const SIDEBAR_WIDTH = 280
const COLLAPSED_SIDEBAR_WIDTH = 88

export default function DashboardLayout() {
  const location = useLocation()
  const theme = useTheme()
  const { t } = useTranslation()
  const { direction } = useThemeMode()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)
  const [showWarning, setShowWarning] = useState(true)
  
  // Get user from Redux store
  const user = useAppSelector((state) => state.auth.user)
  
  // Check if user account is restricted
  const isRestricted = user?.isFrozen === true
  
  // Check if we navigated here with a warning state
  const navigationWarning = location.state?.accountWarning

  // Sync sidebar state with mobile/desktop view
  useEffect(() => {
    setSidebarOpen(!isMobile)
  }, [isMobile])
  
  // Show warning on navigation
  useEffect(() => {
    if (navigationWarning === 'restricted') {
      setShowWarning(true)
    }
  }, [navigationWarning])

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  const drawerTransition = theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: sidebarOpen 
      ? theme.transitions.duration.enteringScreen 
      : theme.transitions.duration.leavingScreen,
  })

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        overflowX: 'hidden',
      }}
    >
      <Drawer
        anchor={direction === 'rtl' ? 'right' : 'left'}
        variant={isMobile ? 'temporary' : 'permanent'}
        open={sidebarOpen}
        onClose={toggleSidebar}
        sx={{
          width: sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          zIndex: 1000, // Lower z-index than the AddIncidentDrawer
          '& .MuiDrawer-paper': {
            width: sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH,
            transition: drawerTransition,
            overflowX: 'hidden',
            borderInlineEnd: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
          },
        }}
      >
        <Sidebar collapsed={!sidebarOpen} />
      </Drawer>

      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minWidth: 0,
          width: '100%',
        }}
      >
        <Topbar onMenuClick={toggleSidebar} />
        
        {/* Restricted Account Warning Banner */}
        <Collapse in={isRestricted && showWarning}>
          <Alert 
            severity="warning"
            icon={<WarningRoundedIcon />}
            sx={{ 
              borderRadius: 0,
              py: 1.5,
              px: 2,
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              borderInlineStart: `4px solid ${theme.palette.warning.main}`,
              '& .MuiAlert-icon': { 
                color: theme.palette.warning.main,
                fontSize: 24,
              },
              '& .MuiAlert-message': { width: '100%' },
            }}
            action={
              <IconButton
                size="small"
                onClick={() => setShowWarning(false)}
                sx={{ 
                  color: theme.palette.warning.main,
                  '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.1) }
                }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            }
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.palette.warning.dark }}>
                {t('auth.restricted')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('auth.blocked')}
              </Typography>
            </Stack>
          </Alert>
        </Collapse>
        
        <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
          <Box
            sx={{
              p: { xs: 1.5, sm: 2, md: 3 },
              maxWidth: 1440,
              width: '100%',
              mx: 'auto',
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
