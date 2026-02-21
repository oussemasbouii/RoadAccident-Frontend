import React, { useEffect } from "react";
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

// Icons
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import AddAlertRoundedIcon from "@mui/icons-material/AddAlertRounded";
import ContactSupportRoundedIcon from "@mui/icons-material/ContactSupportRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CircleIcon from "@mui/icons-material/Circle";

// Redux & Components
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchIncidents } from "../../incidents/slices/incidentsSlice";
import { fetchAlerts } from "../../alerts/slices/alertsSlice";
import StatCard from "../../../components/Common/StatCard";
import Button from "../../../components/Common/Button";
import Card from "../../../components/Common/Card";

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  
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
    dispatch(fetchIncidents({ page: 1, limit: 5 }) as any);
    dispatch(fetchAlerts({ page: 1, limit: 10 }) as any);
  };

  useEffect(() => {
    refreshData();
  }, [dispatch]);

  const stats = [
    {
      icon: <WarningRoundedIcon />,
      label: "Open Incidents",
      value: incidents.filter((i: any) => i.status !== "resolved").length,
      trend: "neutral" as const,
      trendValue: `${incidents.length} total`,
      intent: "danger" as const,
    },
    {
      icon: <NotificationsActiveRoundedIcon />,
      label: "Unread Alerts",
      value: unreadCount,
      trend: unreadCount > 0 ? "up" as const : "neutral" as const,
      trendValue: `${unreadCount} unread`,
      intent: "warning" as const,
    },
    {
      icon: <PlaceRoundedIcon />,
      label: "Active Zones",
      value: new Set(incidents.map((i: any) => i.location)).size,
      trend: "neutral" as const,
      trendValue: "Geographic spread",
      intent: "info" as const,
    },
    {
      icon: <TimerRoundedIcon />,
      label: "Avg Response",
      value: incidentStats.avgResponseTime > 0 ? `${incidentStats.avgResponseTime}m` : "12m",
      trend: "down" as const,
      trendValue: "15% faster",
      intent: "success" as const,
    },
  ];

  const recentIncidents = incidents.slice(0, 5);
  const recentAlerts = alerts.slice(0, 4);

  const severityConfig: Record<string, { color: "error" | "warning" | "info" | "success" | "default", label: string }> = {
    critical: { color: "error", label: "Critical" },
    high: { color: "warning", label: "High" },
    medium: { color: "info", label: "Medium" },
    low: { color: "success", label: "Low" },
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1600, mx: 'auto' }}>
      {/* Header Section */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        mb: 4,
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.5 }}>
            Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time monitoring and operational insights.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title="Refresh Data">
            <IconButton 
              onClick={refreshData}
              size="small"
              sx={{ 
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 'var(--radius-m3-full, 100px)',
                p: 1.25,
                transition: 'all 0.2s',
                '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.04) }
              }}
            >
              <RefreshRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="primary" icon={<AddAlertRoundedIcon fontSize="small" />}>
            New Incident
          </Button>
        </Stack>
      </Box>

      {/* Stats Grid */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, 
        gap: 2, 
        mb: 4 
      }}>
        {stats.map((stat, idx: number) => (
          <StatCard key={idx} {...stat} />
        ))}
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, 
        gap: 3 
      }}>
        {/* Main Content Column */}
        <Box>
          <Card sx={{ height: '100%', p: 0, overflow: 'hidden' }}>
            <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Recent Incidents
              </Typography>
              <MuiButton 
                component={RouterLink} 
                to="/incidents" 
                endIcon={<ArrowForwardRoundedIcon />} 
                size="small"
                sx={{ borderRadius: '100px' }}
              >
                View All
              </MuiButton>
            </Box>
            
            {recentIncidents.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {incidentsLoading ? "Loading incidents..." : "No active incidents found."}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {recentIncidents.map((incident: any, idx: number) => {
                  const severity = severityConfig[incident.severity?.toLowerCase()] || { color: "default", label: incident.severity };
                  return (
                    <ListItem 
                      key={incident.id || idx}
                      divider={idx !== recentIncidents.length - 1}
                      sx={{ 
                        px: 3, 
                        py: 2,
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                        transition: 'background-color 0.2s'
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
                        primary={
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {incident.location}
                          </Typography>
                        }
                        secondary={
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {incident.time || 'Just now'}
                            </Typography>
                            <CircleIcon sx={{ fontSize: 4, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary">
                              {incident.vehicles} Vehicles involved
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Card>
        </Box>

        {/* Sidebar Column */}
        <Box>
          <Stack spacing={3}>
            {/* Quick Actions */}
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Quick Actions</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'Broadcast', icon: <CampaignRoundedIcon />, color: theme.palette.warning.main },
                  { label: 'Analytics', icon: <InsightsRoundedIcon />, color: theme.palette.info.main },
                  { label: 'Support', icon: <ContactSupportRoundedIcon />, color: theme.palette.success.main },
                  { label: 'Settings', icon: <SettingsRoundedIcon />, color: theme.palette.secondary.main },
                ].map((action) => (
                  <Box
                    key={action.label}
                    component={MuiButton}
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
                  </Box>
                ))}
              </Box>
            </Card>

            {/* Alerts Section */}
            <Card sx={{ p: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'warning.dark', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NotificationsActiveRoundedIcon fontSize="small" />
                  System Alerts
                </Typography>
              </Box>
              
              <List disablePadding>
                {recentAlerts.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">No new alerts.</Typography>
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
                            {alert.title || "System Notification"}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {alert.time || 'Just now'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))
                )}
              </List>
              <Box sx={{ p: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
                <MuiButton fullWidth size="small" sx={{ borderRadius: '100px' }}>
                  View All Alerts
                </MuiButton>
              </Box>
            </Card>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}