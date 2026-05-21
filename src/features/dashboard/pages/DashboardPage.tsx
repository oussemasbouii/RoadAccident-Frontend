import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Button as MuiButton
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { listParent, listChild, fadeIn, spring } from "../../../utils/motion";
import { ListRowSkeleton } from "../../../components/Common/Skeletons";

// Icons
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import AddAlertRoundedIcon from "@mui/icons-material/AddAlertRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CircleIcon from "@mui/icons-material/Circle";

// Redux & Components
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchIncidents } from "../../incidents/slices/incidentsSlice";
import type { Incident } from "../../incidents/slices/incidentsSlice";
import { fetchAlerts } from "../../alerts/slices/alertsSlice";
import type { Alert } from "../../alerts/slices/alertsSlice";
import StatCard from "../../../components/Common/StatCard";
import Card from "../../../components/Common/Card";
import NationalKpiDashboard from "../components/NationalKpiDashboard";
import { useTranslation } from "../../../themeMode";

const MotionBox = motion(Box)

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const {
    list: incidents,
    loading: incidentsLoading,
    stats: incidentStats,
  } = useAppSelector((state) => state.incidents);
  
  const {
    list: alerts,
    unreadCount,
    error: alertsError,
  } = useAppSelector((state) => state.alerts);

  const refreshData = () => {
    setIsRefreshing(true);
    dispatch(fetchIncidents({ page: 1, limit: 50 }) as any);
    dispatch(fetchAlerts({ page: 1, limit: 50 }) as any);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    refreshData();
  }, [dispatch]);

  const totalIncidents = incidents.length
  const openIncidents = incidents.filter((i: any) => i.status !== "resolved").length
  const resolvedIncidents = incidents.filter((i: any) => i.status === "resolved").length
  const criticalIncidents = incidents.filter((i: any) => i.severity?.toLowerCase() === "critical").length
  const highIncidents = incidents.filter((i: any) => i.severity?.toLowerCase() === "high").length
  const priorityIncidents = criticalIncidents + highIncidents
  const totalInjuries = incidents.reduce((sum: number, i: any) => sum + Number(i.injuries || 0), 0)
  const avgInjuriesPerIncident = totalIncidents > 0 ? (totalInjuries / totalIncidents).toFixed(1) : "0.0"
  const activeZones = new Set(incidents.map((i: any) => i.location).filter(Boolean)).size
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0

  const stats = [
    {
      icon: <WarningRoundedIcon />,
      label: t('dashboard.open_incidents'),
      value: openIncidents,
      trend: openIncidents > resolvedIncidents ? "up" as const : "neutral" as const,
      trendValue: t('dashboard.percent_resolved', { n: resolutionRate }),
      intent: "danger" as const,
    },
    {
      icon: <NotificationsActiveRoundedIcon />,
      label: t('dashboard.unread_alerts'),
      value: unreadCount,
      trend: unreadCount > 0 ? "up" as const : "neutral" as const,
      trendValue: unreadCount > 0 ? t('dashboard.requires_attention') : t('dashboard.all_caught_up'),
      intent: "warning" as const,
    },
    {
      icon: <PlaceRoundedIcon />,
      label: t('dashboard.active_zones'),
      value: activeZones,
      trend: "neutral" as const,
      trendValue: t('dashboard.priority_cases', { n: priorityIncidents }),
      intent: "info" as const,
    },
    {
      icon: <TimerRoundedIcon />,
      label: t('dashboard.avg_response'),
      value: incidentStats.avgResponseTime > 0 ? `${incidentStats.avgResponseTime}m` : '12m',
      trend: incidentStats.avgResponseTime > 0 && incidentStats.avgResponseTime <= 12 ? "down" as const : "neutral" as const,
      trendValue: t('dashboard.injuries_per_incident', { n: avgInjuriesPerIncident }),
      intent: "success" as const,
    },
  ];

  const recentIncidents = incidents.slice(0, 5);
  const recentAlerts = alerts.slice(0, 4);

  const severityConfig: Record<string, { color: "error" | "warning" | "info" | "success" | "default", label: string }> = {
    critical: { color: "error", label: t('dashboard.critical') },
    high: { color: "warning", label: t('dashboard.high') },
    medium: { color: "info", label: t('dashboard.medium') },
    low: { color: "success", label: t('dashboard.low') },
  };

  return (
    <Box
      sx={{
        pb: 5,
        maxWidth: 1600,
        mx: 'auto',
        px: { xs: 0, md: 0.5 },
      }}
    >
      {/* Header Section */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        mb: 3.5,
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.5 }}>
            {t('dashboard.overview')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('dashboard.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title={t('dashboard.refresh_data')}>
            <IconButton
              onClick={refreshData}
              size="small"
              sx={{
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 'var(--radius-m3-full, 100px)',
                p: 1.25,
                transition: 'background-color 0.18s ease',
                '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.04) },
              }}
            >
              <motion.div
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={
                  isRefreshing
                    ? { duration: 0.7, ease: 'linear', repeat: Infinity, repeatDelay: 0 }
                    : { duration: 0.4, ease: [0.0, 0.0, 0.2, 1.0] }
                }
                style={{ display: 'flex' }}
              >
                <RefreshRoundedIcon fontSize="small" />
              </motion.div>
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Stats Grid — staggered entrance */}
      <MotionBox
        variants={listParent}
        initial="initial"
        animate="animate"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: 2.25,
          mb: 3.5,
        }}
      >
        {stats.map((stat, idx: number) => (
          <StatCard key={idx} {...stat} />
        ))}
      </MotionBox>

      <Box sx={{ mb: 3.5 }}>
        <NationalKpiDashboard incidents={incidents as Incident[]} alerts={alerts as Alert[]} />
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.7fr) minmax(320px, 0.95fr)' }, 
        gap: 2.5 
      }}>
        {/* Main Content Column */}
        <Box>
          <Card sx={{ height: '100%', p: 0, overflow: 'hidden' }}>
            <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t('dashboard.recent_incidents')}
              </Typography>
              <MuiButton 
                component={RouterLink} 
                to="/incidents" 
                endIcon={<ArrowForwardRoundedIcon />} 
                size="small"
                sx={{ borderRadius: '100px' }}
              >
                {t('common.view_all')}
              </MuiButton>
            </Box>
            
            <AnimatePresence mode="wait">
              {incidentsLoading ? (
                <motion.div key="loading" variants={fadeIn} initial="initial" animate="animate" exit={{ opacity: 0 }}>
                  {[0, 1, 2, 3, 4].map((i) => <ListRowSkeleton key={i} index={i} />)}
                </motion.div>
              ) : recentIncidents.length === 0 ? (
                <motion.div key="empty" variants={fadeIn} initial="initial" animate="animate">
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">{t('dashboard.no_incidents')}</Typography>
                  </Box>
                </motion.div>
              ) : (
                <motion.div
                  key="data"
                  variants={listParent}
                  initial="initial"
                  animate="animate"
                >
                  <List disablePadding>
                    {recentIncidents.map((incident: any, idx: number) => {
                      const severity = severityConfig[incident.severity?.toLowerCase()] || { color: 'default', label: incident.severity };
                      return (
                        <motion.div key={incident.id || idx} variants={listChild}>
                          <ListItem
                            divider={idx !== recentIncidents.length - 1}
                            sx={{
                              px: 3,
                              py: 2,
                              transition: 'background-color 0.15s ease',
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                            }}
                            secondaryAction={
                              <Chip
                                label={severity.label}
                                color={severity.color}
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 600, borderRadius: 1.5 }}
                              />
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', borderRadius: 'var(--radius-m3-md, 12px)' }}>
                                <PlaceRoundedIcon fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={<Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{incident.location}</Typography>}
                              secondary={
                                <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                                  <Typography component="span" variant="caption" color="text.secondary">{incident.time || t('dashboard.just_now')}</Typography>
                                  <CircleIcon sx={{ fontSize: 4, color: 'text.disabled' }} />
                                  <Typography component="span" variant="caption" color="text.secondary">{incident.vehicles} {t('dashboard.vehicles_involved')}</Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        </motion.div>
                      );
                    })}
                  </List>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </Box>

        {/* Sidebar Column */}
        <Box>
          <Stack spacing={3}>
            {/* Quick Actions */}
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>{t('dashboard.quick_access')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  {
                    label: t('dashboard.active_incidents'),
                    sublabel: `${openIncidents} ${t('dashboard.open_count')}`,
                    to: '/incidents',
                    icon: <WarningRoundedIcon />,
                    color: theme.palette.error.main
                  },
                  {
                    label: t('dashboard.unread_alerts'),
                    sublabel: `${unreadCount} ${t('dashboard.pending_count')}`,
                    to: '/alerts',
                    icon: <NotificationsActiveRoundedIcon />,
                    color: theme.palette.warning.main
                  },
                  {
                    label: t('dashboard.analytics'),
                    sublabel: t('dashboard.reports_view'),
                    to: '/reports',
                    icon: <InsightsRoundedIcon />,
                    color: theme.palette.info.main
                  },
                  {
                    label: t('dashboard.create_alert'),
                    sublabel: t('dashboard.broadcast_now'),
                    to: '/alerts',
                    icon: <AddAlertRoundedIcon />,
                    color: theme.palette.success.main
                  },
                ].map((action) => (
                  <MuiButton
                    key={action.label}
                    component={RouterLink}
                    to={action.to}
                    sx={{
                      width: '100%',
                      p: 2,
                      borderRadius: 'var(--radius-m3-xl, 24px)',
                      border: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1.25,
                      textTransform: 'none',
                      color: 'text.primary',
                      bgcolor: 'background.paper',
                      boxShadow: 'none',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: alpha(action.color, 0.08),
                        borderColor: alpha(action.color, 0.3),
                        boxShadow: `0 4px 12px ${alpha(action.color, 0.1)}`,
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(action.color, 0.12), 
                        color: action.color,
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-m3-md, 12px)',
                        boxShadow: `0 2px 6px ${alpha(action.color, 0.15)}`
                      }}
                    >
                      {React.cloneElement(action.icon as React.ReactElement, { fontSize: 'small' })}
                    </Avatar>
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>{action.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                      {action.sublabel}
                    </Typography>
                  </MuiButton>
                ))}
              </Box>
            </Card>

            {/* Alerts Section */}
            <Card sx={{ p: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'warning.dark', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NotificationsActiveRoundedIcon fontSize="small" />
                  {t('alerts.title')}
                </Typography>
              </Box>
              
              <List disablePadding>
                {recentAlerts.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">{t('dashboard.no_alerts')}</Typography>
                  </Box>
                ) : (
                  recentAlerts.map((alert: any, idx: number) => (
                    <ListItem 
                      key={alert.id || idx} 
                      divider={idx !== recentAlerts.length - 1}
                      alignItems="flex-start"
                      sx={{ py: 1.5 }}
                    >
                      <ListItemText 
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {(alert as any).direction === 'sent' ? t('alerts.sent_alert') : (alert.title || t('dashboard.system_notification'))}
                      </Typography>
                        }
                        secondary={
                          <Typography component="span" variant="caption" color="text.secondary">
                            {alert.time || t('dashboard.just_now')}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))
                )}
              </List>
              <Box sx={{ p: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
                <MuiButton fullWidth size="small" sx={{ borderRadius: '100px' }}>
                  {t('common.view_all')}
                </MuiButton>
              </Box>
            </Card>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
