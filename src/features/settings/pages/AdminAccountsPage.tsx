import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import PendingRoundedIcon from '@mui/icons-material/PendingRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded'

import Card from '../../../components/Common/Card'
import Badge from '../../../components/Common/Badge'
import { apiService } from '../../../services/api'
import { useAppSelector } from '../../../store/store'
import { useTranslation } from '../../../themeMode'

type OfficerRecord = {
  id?: string
  _id?: string
  officerId?: string
  firstName?: string
  lastName?: string
  displayName?: string
  name?: string
  status?: 'active' | 'blocked' | 'restricted' | string
  validated?: boolean
  center?: string
  isValid?: boolean
  isFrozen?: boolean
  phoneNumber?: string
  role?: string
  email?: string
}

// Helper to derive UI status from backend isValid/isFrozen fields
const deriveStatus = (o: OfficerRecord): 'active' | 'restricted' | 'blocked' => {
  if (o.isValid === false) return 'blocked'
  if (o.isFrozen === true) return 'restricted'
  return 'active'
}

// Status Dropdown Button Component
function StatusDropdownButton({ 
  currentStatus, 
  onStatusChange, 
  disabled,
  theme,
  t,
}: { 
  currentStatus: 'active' | 'restricted' | 'blocked'
  onStatusChange: (status: 'active' | 'restricted' | 'blocked') => void
  disabled: boolean
  theme: any
  t: (key: any, params?: any) => string
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const rowDirection = theme.direction === 'rtl' ? 'row-reverse' : 'row'

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSelect = (status: 'active' | 'restricted' | 'blocked') => {
    onStatusChange(status)
    handleClose()
  }

  const statusConfig = {
    active: { 
      icon: <CheckCircleRoundedIcon fontSize="small" />,
      color: theme.palette.success.main,
      bg: alpha(theme.palette.success.main, 0.15),
      label: t('admin_accounts.active')
    },
    restricted: { 
      icon: <WarningRoundedIcon fontSize="small" />,
      color: theme.palette.warning.main,
      bg: alpha(theme.palette.warning.main, 0.15),
      label: t('admin_accounts.restricted')
    },
    blocked: { 
      icon: <CancelRoundedIcon fontSize="small" />,
      color: theme.palette.error.main,
      bg: alpha(theme.palette.error.main, 0.15),
      label: t('admin_accounts.blocked')
    },
  }

  const current = statusConfig[currentStatus]

  return (
    <>
      <Button
        size="small"
        onClick={handleClick}
        disabled={disabled}
        startIcon={current.icon}
        endIcon={<ArrowDropDownRoundedIcon fontSize="small" />}
        sx={{ 
          bgcolor: current.bg,
          color: current.color,
          fontWeight: 700,
          fontSize: 11,
          textTransform: 'uppercase',
          borderRadius: '8px',
          minWidth: 110,
          '&:hover': { bgcolor: current.bg },
          '&.Mui-disabled': { opacity: 0.5 },
        }}
      >
        {current.label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: theme.direction === 'rtl' ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: theme.direction === 'rtl' ? 'right' : 'left' }}
        PaperProps={{
          sx: { 
            borderRadius: '12px', 
            minWidth: 160,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            mt: 1,
          }
        }}
      >
        <MenuItem 
          onClick={() => handleSelect('active')}
          sx={{ 
            py: 1.5,
            px: 2,
            ...(currentStatus === 'active' && {
              bgcolor: alpha(theme.palette.success.main, 0.08),
            }),
            '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1) },
          }}
        >
          <Stack direction={rowDirection} spacing={1.5} alignItems="center">
            <CheckCircleRoundedIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('admin_accounts.active')}</Typography>
            {currentStatus === 'active' && (
              <Typography variant="caption" color="success.main" sx={{ marginInlineStart: 'auto' }}>{t('admin_accounts.current')}</Typography>
            )}
          </Stack>
        </MenuItem>
        <MenuItem 
          onClick={() => handleSelect('restricted')}
          sx={{ 
            py: 1.5,
            px: 2,
            ...(currentStatus === 'restricted' && {
              bgcolor: alpha(theme.palette.warning.main, 0.08),
            }),
            '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.1) },
          }}
        >
          <Stack direction={rowDirection} spacing={1.5} alignItems="center">
            <WarningRoundedIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('admin_accounts.restricted')}</Typography>
            {currentStatus === 'restricted' && (
              <Typography variant="caption" color="warning.main" sx={{ marginInlineStart: 'auto' }}>{t('admin_accounts.current')}</Typography>
            )}
          </Stack>
        </MenuItem>
        <MenuItem 
          onClick={() => handleSelect('blocked')}
          sx={{ 
            py: 1.5,
            px: 2,
            ...(currentStatus === 'blocked' && {
              bgcolor: alpha(theme.palette.error.main, 0.08),
            }),
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) },
          }}
        >
          <Stack direction={rowDirection} spacing={1.5} alignItems="center">
            <CancelRoundedIcon fontSize="small" sx={{ color: theme.palette.error.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('admin_accounts.blocked')}</Typography>
            {currentStatus === 'blocked' && (
              <Typography variant="caption" color="error.main" sx={{ marginInlineStart: 'auto' }}>{t('admin_accounts.current')}</Typography>
            )}
          </Stack>
        </MenuItem>
      </Menu>
    </>
  )
}

export default function AdminAccountsPage() {
  const currentUser = useAppSelector((s) => s.auth.user)
  const theme = useTheme()
  const { t } = useTranslation()
  const rowDirection = theme.direction === 'rtl' ? 'row-reverse' : 'row'
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [officers, setOfficers] = useState<OfficerRecord[]>([])

  const fetchOfficers = async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await apiService.users.list({ search: query.trim() || undefined, page: 1, limit: 50 })
      
      // Debug: Log the full response to understand the data structure
      if (import.meta.env.DEV) {
        console.log('🔍 Users List Response:', resp)
        console.log('🔍 Response Data:', resp.data)
        console.log('🔍 Response Data.data:', resp.data?.data)
        console.log('🔍 Response Data.items:', resp.data?.items)
        console.log('🔍 Response Data.rows:', resp.data?.rows)
      }
      
      // Try multiple possible response structures
      const raw = resp.data?.data ?? resp.data?.items ?? resp.data?.rows ?? resp.data?.users ?? resp.data
      const rows = Array.isArray(raw) ? raw : []
      
      if (import.meta.env.DEV) {
        console.log('🔍 Extracted rows:', rows)
        console.log('🔍 Rows count:', rows.length)
      }
      
      setOfficers(rows)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 || status === 501) {
        setError(t('admin_accounts.users_api_not_available_yet'))
      } else {
        setError(err?.response?.data?.message || err?.message || t('admin_accounts.failed_to_load_users'))
      }
      setOfficers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOfficers()
  }, [])

  // Backend user id for API calls (id or _id)
  const apiId = (o: OfficerRecord) => String(o.id ?? o._id ?? o.officerId ?? '')
  const safeId = (o: OfficerRecord) => String(o.id ?? o._id ?? o.officerId ?? '')

  const doAction = async (action: () => Promise<any>, successMessage: string) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      await action()
      setSuccess(successMessage)
      await fetchOfficers()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('admin_accounts.action_failed'))
    } finally {
      setLoading(false)
    }
  }

  const badgeVariant = (status?: string) => {
    if (status === 'blocked') return 'danger'
    if (status === 'restricted') return 'warning'
    return 'success'
  }

  // Client-side filtering
  const filteredOfficers = useMemo(() => {
    return officers.filter((o) => {
      // Role filter
      if (roleFilter && o.role !== roleFilter) return false
      
      // Status filter
      if (statusFilter) {
        const status = deriveStatus(o)
        if (status !== statusFilter) return false
      }
      
      // Search query (client-side additional filtering)
      if (query.trim()) {
        const searchLower = query.toLowerCase().trim()
        const matchesName = (o.firstName?.toLowerCase().includes(searchLower) ||
                            o.lastName?.toLowerCase().includes(searchLower) ||
                            o.displayName?.toLowerCase().includes(searchLower) ||
                            o.name?.toLowerCase().includes(searchLower))
        const matchesEmail = o.email?.toLowerCase().includes(searchLower)
        const matchesOfficerId = o.officerId?.toLowerCase().includes(searchLower)
        if (!matchesName && !matchesEmail && !matchesOfficerId) return false
      }
      
      return true
    })
  }, [officers, roleFilter, statusFilter, query])

  return (
    <Stack spacing={4} sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>{t('admin_accounts.user_accounts')}</Typography>
          <Typography color="text.secondary">{t('admin_accounts.validate_manage_secure')}</Typography>
        </Box>
        <Tooltip title={t('admin_accounts.refresh_records')}>
           <IconButton onClick={fetchOfficers} sx={{ bgcolor: 'background.paper', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
             <RefreshRoundedIcon />
           </IconButton>
        </Tooltip>
      </Box>

      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, alignItems: 'end' }}>
          <TextField
            label={t('admin_accounts.search_users')}
            variant="outlined"
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label={t('admin_accounts.officer_id')}
            variant="outlined"
            size="small"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ bgcolor: 'background.paper' }}
          />
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>{t('admin_accounts.role')}</InputLabel>
            <Select
              value={roleFilter}
              label={t('admin_accounts.role')}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value="">{t('admin_accounts.all_roles')}</MenuItem>
              <MenuItem value="admin">{t('admin_accounts.role_admin')}</MenuItem>
              <MenuItem value="dispatch">{t('admin_accounts.role_dispatch')}</MenuItem>
              <MenuItem value="officer">{t('admin_accounts.role_officer')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ bgcolor: 'background.paper' }}>
            <InputLabel>{t('admin_accounts.status')}</InputLabel>
            <Select
              value={statusFilter}
              label={t('admin_accounts.status')}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">{t('admin_accounts.all_status')}</MenuItem>
              <MenuItem value="active">{t('admin_accounts.active')}</MenuItem>
              <MenuItem value="restricted">{t('admin_accounts.restricted')}</MenuItem>
              <MenuItem value="blocked">{t('admin_accounts.blocked')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {error && <Alert severity="error" sx={{ borderRadius: 'var(--radius-m3-md, 12px)' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ borderRadius: 'var(--radius-m3-md, 12px)' }}>{success}</Alert>}

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{t('admin_accounts.account_registry')}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {filteredOfficers.length !== officers.length && (
              <Chip 
                label={`${filteredOfficers.length} / ${officers.length}`}
                size="small"
                onDelete={() => { setQuery(''); setRoleFilter(''); setStatusFilter(''); }}
                sx={{ fontWeight: 600, fontSize: 11 }}
              />
            )}
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', px: 2, py: 0.5, bgcolor: alpha(theme.palette.action.active, 0.05), borderRadius: 1 }}>
              {officers.length} {t('admin_accounts.registered_officers')}
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.action.active, 0.02) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 2, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.officer')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.officer_id')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.role')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.phone')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('settings.center')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.validation')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.status')}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOfficers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 12, color: 'text.secondary' }}>
                    <Stack spacing={2} alignItems="center">
                      <PersonRoundedIcon sx={{ fontSize: 64, color: 'text.disabled', opacity: 0.5 }} />
                      <Typography variant="h6" color="text.secondary">
                        {loading ? t('admin_accounts.loading_account_database') : t('admin_accounts.no_officer_accounts_found')}
                      </Typography>
                      <Typography variant="body2" color="text.disabled">
                        {loading ? t('admin_accounts.please_wait') : t('admin_accounts.try_adjusting_search_criteria')}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : filteredOfficers.map((o) => {
                const status = deriveStatus(o)
                const roleColors: Record<string, { bg: string; color: string }> = {
                  admin: { bg: alpha(theme.palette.error.main, 0.1), color: theme.palette.error.main },
                  dispatch: { bg: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main },
                  officer: { bg: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main },
                }
                const roleStyle = roleColors[o.role || 'officer'] || roleColors.officer
                
                return (
                <TableRow 
                  key={safeId(o)}
                  sx={{ 
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <TableCell sx={{ py: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar 
                        sx={{ 
                          width: 44, 
                          height: 44, 
                          bgcolor: alpha(theme.palette.primary.main, 0.1), 
                          color: 'primary.main',
                          fontWeight: 700, 
                          fontSize: 16, 
                          borderRadius: '12px',
                          border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        }}
                      >
                        {(o.firstName || o.displayName || o.officerId || 'U')[0].toUpperCase()}
                      </Avatar>
                      <Stack spacing={0.5}>
                        <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {o.firstName && o.lastName ? `${o.firstName} ${o.lastName}` : (o.displayName || o.name || t('admin_accounts.unknown_officer'))}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PersonRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.disabled">{o.email || t('admin_accounts.no_email')}</Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <BadgeRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {o.officerId || '-'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={<AdminPanelSettingsRoundedIcon sx={{ fontSize: 16 }} />}
                      label={o.role === 'admin' ? t('admin_accounts.role_admin') : o.role === 'dispatch' ? t('admin_accounts.role_dispatch') : t('admin_accounts.role_officer')}
                      size="small"
                      sx={{ 
                        bgcolor: roleStyle.bg, 
                        color: roleStyle.color,
                        fontWeight: 700,
                        fontSize: 11,
                        '& .MuiChip-icon': { color: roleStyle.color },
                      }} 
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      <Typography variant="body2" color="text.secondary">
                        {o.phoneNumber || '-'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LocationOnRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      <Typography variant="body2" color="text.secondary">
                        {o.center || '-'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      icon={o.validated ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> : <PendingRoundedIcon sx={{ fontSize: 16 }} />}
                      label={o.validated ? t('admin_accounts.validated') : t('admin_accounts.pending')} 
                      size="small"
                      sx={{ 
                        bgcolor: o.validated ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.grey[500], 0.1),
                        color: o.validated ? theme.palette.success.main : theme.palette.grey[600],
                        fontWeight: 700,
                        fontSize: 11,
                        '& .MuiChip-icon': { color: o.validated ? theme.palette.success.main : theme.palette.grey[600] },
                      }} 
                    />
                  </TableCell>
                  <TableCell>
                      <StatusDropdownButton
                      currentStatus={status}
                      disabled={loading}
                      theme={theme}
                      t={t}
                      onStatusChange={(newStatus) => {
                        const statusData = {
                          active: { isValid: true, isFrozen: false },
                          restricted: { isValid: true, isFrozen: true },
                          blocked: { isValid: false, isFrozen: true },
                        }[newStatus]
                        doAction(
                          () => apiService.users.updateStatus(apiId(o), statusData),
                          t('admin_accounts.status_set_to').replace('{status}', newStatus)
                        )
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                      <Tooltip title={t('admin_accounts.validate_account')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => doAction(() => apiService.users.update(apiId(o), { validated: true }), t('admin_accounts.validated'))}
                          disabled={loading || !!o.validated}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                        >
                          <VerifiedUserRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={t('admin_accounts.reset_password')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newPassword = window.prompt(t('admin_accounts.reset_password'))
                            if (newPassword == null || newPassword.length < 8) {
                              if (newPassword !== null) setError(t('admin_accounts.password_must_be_at_least_8_characters'))
                              return
                            }
                            doAction(
                              () => apiService.users.updatePassword(apiId(o), { newPassword }),
                              t('admin_accounts.password_updated_user_should_change_it_on_next_login')
                            )
                          }}
                          disabled={loading}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                        >
                          <LockResetRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={t('admin_accounts.revoke_sessions')}>
                        <IconButton
                          size="small"
                          onClick={() => doAction(() => apiService.users.revokeSessions(apiId(o)), t('admin_accounts.sessions_revoked'))}
                          disabled={loading}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                        >
                          <LogoutRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={t('admin_accounts.delete_user_not_available')}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Stack>
  )
}
