import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
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
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import PersonOffRoundedIcon from '@mui/icons-material/PersonOffRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../../services/api'
import { useAppDispatch, useAppSelector } from '../../../store/store'
import { useTranslation } from '../../../themeMode'
import { setPendingAccountsCount } from '../../notifications/slices/notificationsSlice'

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
  deletedAt?: string | null
  deletedBy?: string | null
  deletedReason?: string | null
  restorable?: boolean
  restoreExpiresAt?: string | null
}

const deriveStatus = (o: OfficerRecord): 'active' | 'restricted' | 'blocked' => {
  if (o.isValid === false) return 'blocked'
  if (o.isFrozen === true) return 'restricted'
  return 'active'
}

const isPending = (o: OfficerRecord) => o.validated === false
const isDeactivated = (o: OfficerRecord) => Boolean(o.deletedAt)

const extractError = (err: any): string => {
  if (typeof window !== 'undefined' && !navigator.onLine)
    return 'No internet connection. Please check your network.'
  const status = err?.response?.status
  const msg =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    (typeof err?.response?.data === 'string' ? err.response.data : null) ||
    err?.message
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'Account not found. It may have been deleted.'
  if (status === 409) return msg || 'Conflict — the account may already be in that state.'
  if (status === 422) return msg || 'Invalid data sent to the server.'
  if (status >= 500) return 'Server error. Please try again later.'
  return msg || 'Operation failed. Please try again.'
}

// ── Reset Password Dialog ────────────────────────────────────────────────────
function ResetPasswordDialog({
  open,
  officerName,
  onClose,
  onConfirm,
  t,
}: {
  open: boolean
  officerName: string
  onClose: () => void
  onConfirm: (password: string) => void
  t: (key: any) => string
}) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touched, setTouched] = useState(false)

  const tooShort = pwd.length > 0 && pwd.length < 12
  const mismatch = touched && confirm.length > 0 && pwd !== confirm
  const canSubmit = pwd.length >= 12 && pwd === confirm

  const handleClose = () => {
    setPwd('')
    setConfirm('')
    setTouched(false)
    onClose()
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onConfirm(pwd)
    setPwd('')
    setConfirm('')
    setTouched(false)
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        {t('admin_accounts.reset_password_title')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('admin_accounts.reset_password_for').replace('{name}', officerName)}
        </Typography>
        <Stack spacing={2}>
          <TextField
            label={t('admin_accounts.new_password')}
            type={showPwd ? 'text' : 'password'}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            fullWidth
            size="small"
            error={tooShort}
            helperText={tooShort ? t('admin_accounts.password_min_12') : ' '}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPwd((v) => !v)} edge="end">
                    {showPwd ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label={t('admin_accounts.confirm_new_password')}
            type={showConfirm ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setTouched(true) }}
            fullWidth
            size="small"
            error={mismatch}
            helperText={mismatch ? t('admin_accounts.passwords_must_match') : ' '}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowConfirm((v) => !v)} edge="end">
                    {showConfirm ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}>
          {t('common.cancel' as any)}
        </Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={handleSubmit}
          sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 700 }}
        >
          {t('admin_accounts.reset_password_title')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Revoke Sessions Dialog ───────────────────────────────────────────────────
function RevokeSessionsDialog({
  open,
  officerName,
  onClose,
  onConfirm,
  t,
}: {
  open: boolean
  officerName: string
  onClose: () => void
  onConfirm: () => void
  t: (key: any) => string
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <DevicesRoundedIcon color="warning" />
          <span>{t('admin_accounts.revoke_sessions_title')}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t('admin_accounts.revoke_sessions_body').replace('{name}', officerName)}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}>
          {t('common.cancel' as any)}
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => { onConfirm(); onClose() }}
          sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 700 }}
        >
          {t('admin_accounts.revoke_sessions')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Deactivate (soft-delete) Dialog ──────────────────────────────────────────
function DeactivateDialog({
  open,
  officerName,
  busy,
  onClose,
  onConfirm,
  t,
}: {
  open: boolean
  officerName: string
  busy: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  t: (key: any) => string
}) {
  const [reason, setReason] = useState('')

  const handleClose = () => {
    if (busy) return
    setReason('')
    onClose()
  }

  const handleConfirm = () => {
    onConfirm(reason)
    setReason('')
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PersonOffRoundedIcon color="error" />
          <span>{t('admin_accounts.deactivate_title')}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('admin_accounts.deactivate_warning').replace('{name}', officerName)}
        </Typography>
        <TextField
          label={t('admin_accounts.reason_optional')}
          placeholder={t('admin_accounts.reason_placeholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          size="small"
          multiline
          minRows={2}
          disabled={busy}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} disabled={busy} sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}>
          {t('common.cancel' as any)}
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={busy}
          onClick={handleConfirm}
          startIcon={<PersonOffRoundedIcon fontSize="small" />}
          sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 700 }}
        >
          {busy ? t('admin_accounts.deactivating') : t('admin_accounts.confirm_deactivate')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Status Dropdown Button ───────────────────────────────────────────────────
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
  t: (key: any) => string
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const statusConfig = {
    active: {
      icon: <CheckCircleRoundedIcon fontSize="small" />,
      color: theme.palette.success.main,
      bg: alpha(theme.palette.success.main, 0.15),
      label: t('admin_accounts.active'),
    },
    restricted: {
      icon: <WarningRoundedIcon fontSize="small" />,
      color: theme.palette.warning.main,
      bg: alpha(theme.palette.warning.main, 0.15),
      label: t('admin_accounts.restricted'),
    },
    blocked: {
      icon: <CancelRoundedIcon fontSize="small" />,
      color: theme.palette.error.main,
      bg: alpha(theme.palette.error.main, 0.15),
      label: t('admin_accounts.blocked'),
    },
  }

  const current = statusConfig[currentStatus]

  return (
    <>
      <Button
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
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
          '&:hover': { bgcolor: alpha(current.color, 0.22) },
          '&.Mui-disabled': { opacity: 0.5 },
        }}
      >
        {current.label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', mt: 1 } }}
      >
        {(['active', 'restricted', 'blocked'] as const).map((s) => {
          const cfg = statusConfig[s]
          return (
            <MenuItem
              key={s}
              onClick={() => { onStatusChange(s); setAnchorEl(null) }}
              sx={{
                py: 1.5, px: 2,
                ...(currentStatus === s && { bgcolor: alpha(cfg.color, 0.08) }),
                '&:hover': { bgcolor: alpha(cfg.color, 0.1) },
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                <Box sx={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</Box>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{cfg.label}</Typography>
                {currentStatus === s && (
                  <Typography variant="caption" sx={{ color: cfg.color }}>{t('admin_accounts.current')}</Typography>
                )}
              </Stack>
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminAccountsPage() {
  const currentUser = useAppSelector((s) => s.auth.user)
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [centerFilter, setCenterFilter] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [officers, setOfficers] = useState<OfficerRecord[]>([])
  const [roleSaving, setRoleSaving] = useState<Record<string, boolean>>({})
  const [statusSaving, setStatusSaving] = useState<Record<string, boolean>>({})
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; undoFn?: () => void }>({ open: false, message: '' })
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [showPending, setShowPending] = useState(false)
  const [approving, setApproving] = useState<Record<string, boolean>>({})
  const [accPage, setAccPage] = useState(0)
  const [accRowsPerPage, setAccRowsPerPage] = useState(15)
  const [resetPwdTarget, setResetPwdTarget] = useState<OfficerRecord | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<OfficerRecord | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<OfficerRecord | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [restoringIds, setRestoringIds] = useState<Record<string, boolean>>({})

  const fetchOfficers = async () => {
    try {
      setLoading(true)
      setError(null)
      const resp = await apiService.users.list({
        search: query.trim() || undefined,
        role: (roleFilter as 'officer' | 'supervisor' | 'admin') || undefined,
        center: centerFilter.trim() || undefined,
        page: 1,
        limit: 100,
      })
      const raw = resp.data?.data ?? resp.data?.items ?? resp.data?.rows ?? resp.data?.users ?? resp.data
      setOfficers(Array.isArray(raw) ? raw : [])
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

  useEffect(() => { fetchOfficers() }, [])

  const apiId = (o: OfficerRecord) => String(o.id ?? o._id ?? o.officerId ?? '')
  const safeId = (o: OfficerRecord) => String(o.id ?? o._id ?? o.officerId ?? '')

  const displayName = (o: OfficerRecord) =>
    [o.firstName, o.lastName].filter(Boolean).join(' ') || o.displayName || o.name || o.officerId || 'User'

  const showSnackbar = (message: string, undoFn?: () => void) =>
    setSnackbar({ open: true, message, undoFn })

  const approveAccount = async (o: OfficerRecord) => {
    const id = apiId(o)
    setApproving((prev) => ({ ...prev, [id]: true }))
    setError(null)
    try {
      if (o.officerId) {
        try {
          await apiService.admin.validateOfficer(o.officerId, {})
        } catch (validateErr: any) {
          if (validateErr?.response?.status === 404 || validateErr?.response?.status === 405) {
            await apiService.users.updateStatus(id, { isValid: true, isFrozen: false })
          } else {
            throw validateErr
          }
        }
      } else {
        await apiService.users.updateStatus(id, { isValid: true, isFrozen: false })
      }
      showSnackbar(t('admin_accounts.account_approved').replace('{name}', displayName(o)))
      if (showPending) setShowPending(false)
      await fetchOfficers()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setApproving((prev) => ({ ...prev, [id]: false }))
    }
  }

  const rejectAccount = async (o: OfficerRecord) => {
    const id = apiId(o)
    setApproving((prev) => ({ ...prev, [`reject_${id}`]: true }))
    setError(null)
    try {
      await apiService.users.updateStatus(id, { isValid: false, isFrozen: false })
      showSnackbar(t('admin_accounts.registration_rejected').replace('{name}', displayName(o)))
      await fetchOfficers()
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setApproving((prev) => ({ ...prev, [`reject_${id}`]: false }))
    }
  }

  const handleStatusChange = async (o: OfficerRecord, newStatus: 'active' | 'restricted' | 'blocked') => {
    const id = safeId(o)
    const statusData = {
      active: { isValid: true, isFrozen: false },
      restricted: { isValid: true, isFrozen: true },
      blocked: { isValid: false, isFrozen: true },
    }[newStatus]
    setStatusSaving((prev) => ({ ...prev, [id]: true }))
    setError(null)
    try {
      await apiService.users.updateStatus(id, statusData)
      setOfficers((prev) =>
        prev.map((u) => safeId(u) === id
          ? { ...u, isValid: statusData.isValid, isFrozen: statusData.isFrozen }
          : u
        )
      )
      showSnackbar(t('admin_accounts.status_set_to').replace('{status}', newStatus))
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setStatusSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPwdTarget) return
    const id = apiId(resetPwdTarget)
    const name = displayName(resetPwdTarget)
    setResetPwdTarget(null)
    try {
      await apiService.users.updatePassword(id, { newPassword })
      showSnackbar(t('admin_accounts.password_updated_user_should_change_it_on_next_login'))
    } catch (err: any) {
      setError(extractError(err))
    }
  }

  const handleRevokeSessions = async () => {
    if (!revokeTarget) return
    const id = apiId(revokeTarget)
    try {
      await apiService.users.revokeSessions(id)
      showSnackbar(t('admin_accounts.sessions_revoked'))
    } catch (err: any) {
      setError(extractError(err))
    }
  }

  const restoreOfficer = async (o: OfficerRecord, withSnackbar = true) => {
    const id = apiId(o)
    setRestoringIds((prev) => ({ ...prev, [id]: true }))
    setError(null)
    try {
      await apiService.users.restore(id)
      setOfficers((prev) =>
        prev.map((u) => safeId(u) === id
          ? { ...u, deletedAt: null, deletedBy: null, deletedReason: null, restorable: false, restoreExpiresAt: null, isValid: true, isFrozen: false }
          : u
        )
      )
      if (withSnackbar) showSnackbar(t('admin_accounts.user_restored').replace('{name}', displayName(o)))
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setRestoringIds((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleDeactivate = async (reason: string) => {
    if (!deactivateTarget) return
    const o = deactivateTarget
    const id = apiId(o)
    const name = displayName(o)
    const trimmed = reason.trim()
    setDeactivating(true)
    setError(null)
    try {
      await apiService.users.softDelete(id, trimmed ? { reason: trimmed } : undefined)
      // Mark deactivated locally so the row reflects the new state and stays restorable.
      setOfficers((prev) =>
        prev.map((u) => safeId(u) === id
          ? { ...u, deletedAt: new Date().toISOString(), deletedReason: trimmed || null, restorable: true, isValid: false }
          : u
        )
      )
      setDeactivateTarget(null)
      showSnackbar(
        t('admin_accounts.user_deactivated').replace('{name}', name),
        () => { void restoreOfficer(o, false) }
      )
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setDeactivating(false)
    }
  }

  const roleLabel = (role?: string) => {
    if (role === 'admin') return t('admin_accounts.role_admin')
    if (role === 'supervisor') return t('admin_accounts.role_supervisor')
    return t('admin_accounts.role_officer')
  }

  const roleColors: Record<string, { bg: string; color: string }> = {
    admin: { bg: alpha(theme.palette.error.main, 0.1), color: theme.palette.error.main },
    supervisor: { bg: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main },
    officer: { bg: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main },
  }

  const pendingOfficers = useMemo(() => officers.filter(isPending), [officers])

  useEffect(() => {
    dispatch(setPendingAccountsCount(pendingOfficers.length))
    return () => { dispatch(setPendingAccountsCount(0)) }
  }, [pendingOfficers.length, dispatch])

  const filteredOfficers = useMemo(() => {
    const base = showPending ? pendingOfficers : officers
    return base.filter((o) => {
      if (roleFilter && o.role !== roleFilter) return false
      if (statusFilter === 'deactivated') {
        if (!isDeactivated(o)) return false
      } else if (statusFilter) {
        if (isDeactivated(o) || deriveStatus(o) !== statusFilter) return false
      }
      if (centerFilter.trim()) {
        if (!o.center?.toLowerCase().includes(centerFilter.toLowerCase().trim())) return false
      }
      if (query.trim()) {
        const q = query.toLowerCase().trim()
        const hit =
          o.firstName?.toLowerCase().includes(q) ||
          o.lastName?.toLowerCase().includes(q) ||
          o.displayName?.toLowerCase().includes(q) ||
          o.name?.toLowerCase().includes(q) ||
          o.officerId?.toLowerCase().includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [officers, pendingOfficers, showPending, roleFilter, statusFilter, centerFilter, query])

  const anyFilterActive = !!(query || roleFilter || statusFilter || centerFilter)

  // Reset to page 0 whenever filters or view toggle changes
  useEffect(() => { setAccPage(0) }, [query, roleFilter, statusFilter, centerFilter, showPending])

  const paginatedOfficers = filteredOfficers.slice(
    accPage * accRowsPerPage,
    accPage * accRowsPerPage + accRowsPerPage
  )

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>
            {t('admin_accounts.user_accounts')}
          </Typography>
          <Typography color="text.secondary">{t('admin_accounts.validate_manage_secure')}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {pendingOfficers.length > 0 && (
            <Button
              variant={showPending ? 'contained' : 'outlined'}
              color="warning"
              onClick={() => setShowPending((v) => !v)}
              sx={{ borderRadius: '12px', fontWeight: 700, textTransform: 'none' }}
              startIcon={<PendingRoundedIcon />}
              endIcon={
                <Box component="span" sx={{
                  bgcolor: showPending ? 'warning.dark' : 'warning.main',
                  color: '#fff',
                  borderRadius: '10px',
                  px: 0.9, py: 0.1,
                  fontSize: 11, fontWeight: 800,
                }}>
                  {pendingOfficers.length}
                </Box>
              }
            >
              {t('admin_accounts.pending_approval')}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<PersonAddRoundedIcon />}
            onClick={() => navigate('/admin/new-account')}
            sx={{ borderRadius: '12px', fontWeight: 700, textTransform: 'none' }}
          >
            {t('admin_accounts.create_account')}
          </Button>
          <Tooltip title={t('admin_accounts.refresh_records')}>
            <IconButton
              onClick={fetchOfficers}
              disabled={loading}
              sx={{ bgcolor: 'background.paper', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}
            >
              <RefreshRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, alignItems: 'end' }}>
          <TextField
            label={t('admin_accounts.search_users')}
            variant="outlined"
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small">
            <InputLabel>{t('admin_accounts.role')}</InputLabel>
            <Select value={roleFilter} label={t('admin_accounts.role')} onChange={(e) => setRoleFilter(e.target.value)}>
              <MenuItem value="">{t('admin_accounts.all_roles')}</MenuItem>
              <MenuItem value="admin">{t('admin_accounts.role_admin')}</MenuItem>
              <MenuItem value="supervisor">{t('admin_accounts.role_supervisor')}</MenuItem>
              <MenuItem value="officer">{t('admin_accounts.role_officer')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>{t('admin_accounts.status')}</InputLabel>
            <Select value={statusFilter} label={t('admin_accounts.status')} onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">{t('admin_accounts.all_status')}</MenuItem>
              <MenuItem value="active">{t('admin_accounts.active')}</MenuItem>
              <MenuItem value="restricted">{t('admin_accounts.restricted')}</MenuItem>
              <MenuItem value="blocked">{t('admin_accounts.blocked')}</MenuItem>
              <MenuItem value="deactivated">{t('admin_accounts.show_deactivated')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Center"
            variant="outlined"
            size="small"
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
          />
        </Box>
        {anyFilterActive && (
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={() => { setQuery(''); setRoleFilter(''); setStatusFilter(''); setCenterFilter('') }}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12 }}
            >
              Clear filters
            </Button>
          </Box>
        )}
      </Paper>

      {/* ── Alerts ───────────────────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {showPending && pendingOfficers.length > 0 && (
        <Alert
          severity="info"
          icon={<PendingRoundedIcon />}
          action={
            <Button size="small" color="inherit" onClick={() => setShowPending(false)}>
              Show all
            </Button>
          }
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          {t('admin_accounts.showing_pending').replace('{count}', String(pendingOfficers.length))}
        </Alert>
      )}

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* Table header bar */}
        <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {showPending ? t('admin_accounts.pending_approvals_title') : t('admin_accounts.account_registry')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {filteredOfficers.length !== officers.length && (
              <Chip
                label={`${filteredOfficers.length} / ${officers.length}`}
                size="small"
                onDelete={() => { setQuery(''); setRoleFilter(''); setStatusFilter(''); setCenterFilter('') }}
                sx={{ fontWeight: 600, fontSize: 11 }}
              />
            )}
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', px: 2, py: 0.5, bgcolor: alpha(theme.palette.action.active, 0.05), borderRadius: 1 }}>
              {officers.length} {t('admin_accounts.registered_officers')}
            </Typography>
          </Stack>
        </Box>

        {/* Bulk action bar */}
        <Collapse in={selectedIds.size > 0}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.25, mx: 2, mt: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }}>
            <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
              {t('admin_accounts.x_selected').replace('{count}', String(selectedIds.size))}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="success"
              disabled={bulkActionLoading}
              onClick={async () => {
                setBulkActionLoading(true)
                try {
                  await Promise.all(
                    Array.from(selectedIds).map((id) => apiService.users.updateStatus(id, { isValid: true }))
                  )
                  setSelectedIds(new Set())
                  await fetchOfficers()
                } catch (err: any) {
                  setError(extractError(err))
                } finally {
                  setBulkActionLoading(false)
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t('admin_accounts.activate')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={bulkActionLoading}
              onClick={async () => {
                setBulkActionLoading(true)
                try {
                  await Promise.all(
                    Array.from(selectedIds).map((id) => apiService.users.updateStatus(id, { isValid: false }))
                  )
                  setSelectedIds(new Set())
                  await fetchOfficers()
                } catch (err: any) {
                  setError(extractError(err))
                } finally {
                  setBulkActionLoading(false)
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t('admin_accounts.block_selected')}
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedIds(new Set())}
              sx={{ textTransform: 'none' }}
            >
              {t('admin_accounts.deselect_all')}
            </Button>
          </Box>
        </Collapse>

        <Box sx={{ overflowX: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredOfficers.length}
                    checked={filteredOfficers.length > 0 && selectedIds.size === filteredOfficers.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredOfficers.map((o) => String(o._id || o.id || ''))))
                      } else {
                        setSelectedIds(new Set())
                      }
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 700, py: 2, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.officer')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.officer_id')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.role')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.phone')}</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Center</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.status')}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('admin_accounts.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Loading skeleton */}
              {loading && officers.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell padding="checkbox"><Skeleton variant="rectangular" width={18} height={18} sx={{ borderRadius: 1 }} /></TableCell>
                    <TableCell sx={{ py: 2.5 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: '12px', flexShrink: 0 }} />
                        <Stack spacing={0.5}>
                          <Skeleton width={120} height={16} />
                          <Skeleton width={80} height={12} />
                        </Stack>
                      </Stack>
                    </TableCell>
                    {[80, 90, 100, 80, 100, 120].map((w, j) => (
                      <TableCell key={j}><Skeleton width={w} height={16} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredOfficers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                    <Stack spacing={1.5} alignItems="center">
                      <PersonRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', opacity: 0.4 }} />
                      <Typography variant="h6" color="text.secondary">
                        {t('admin_accounts.no_officer_accounts_found')}
                      </Typography>
                      <Typography variant="body2" color="text.disabled">
                        {anyFilterActive ? t('admin_accounts.try_adjusting_search_criteria') : t('admin_accounts.please_wait')}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : paginatedOfficers.map((o) => {
                const status = deriveStatus(o)
                const rowId = safeId(o)
                const roleStyle = roleColors[o.role || 'officer'] || roleColors.officer

                return (
                  <TableRow
                    key={rowId}
                    sx={{
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                      transition: 'background-color 0.15s ease',
                      ...(isPending(o) && {
                        borderLeft: `3px solid ${theme.palette.warning.main}`,
                        bgcolor: alpha(theme.palette.warning.main, 0.03),
                      }),
                      ...(isDeactivated(o) && {
                        opacity: 0.6,
                        '& .MuiTableCell-root:not(:last-child)': { filter: 'grayscale(0.4)' },
                      }),
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.has(String(o._id || o.id || ''))}
                        onChange={(e) => {
                          const id = String(o._id || o.id || '')
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(id)
                            else next.delete(id)
                            return next
                          })
                        }}
                      />
                    </TableCell>

                    {/* Name + avatar */}
                    <TableCell sx={{ py: 2 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{
                          width: 44, height: 44,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
                          fontWeight: 700, fontSize: 16,
                          borderRadius: '12px',
                          border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          flexShrink: 0,
                        }}>
                          {(o.firstName || o.displayName || o.officerId || 'U')[0].toUpperCase()}
                        </Avatar>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                            {o.firstName && o.lastName ? `${o.firstName} ${o.lastName}` : (o.displayName || o.name || t('admin_accounts.unknown_officer'))}
                          </Typography>
                          {isPending(o) && (
                            <Chip
                              icon={<PendingRoundedIcon sx={{ fontSize: 12 }} />}
                              label={t('admin_accounts.awaiting_approval')}
                              size="small"
                              sx={{
                                height: 18, fontSize: 10, fontWeight: 700,
                                bgcolor: alpha(theme.palette.warning.main, 0.15),
                                color: theme.palette.warning.dark,
                                '& .MuiChip-icon': { color: theme.palette.warning.dark },
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          )}
                        </Stack>
                      </Stack>
                    </TableCell>

                    {/* Officer ID */}
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <BadgeRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                          {o.officerId || '—'}
                        </Typography>
                      </Stack>
                    </TableCell>

                    {/* Role (editable) */}
                    <TableCell>
                      {editingRoleId === rowId ? (
                        <Select
                          size="small"
                          autoFocus
                          value={o.role || 'officer'}
                          disabled={roleSaving[rowId]}
                          onBlur={() => setEditingRoleId(null)}
                          onChange={async (e) => {
                            const previousRole = o.role || 'officer'
                            const newRole = e.target.value as string
                            setEditingRoleId(null)
                            setRoleSaving((prev) => ({ ...prev, [rowId]: true }))
                            try {
                              await apiService.users.update(rowId, { role: newRole })
                              setOfficers((prev) =>
                                prev.map((u) => safeId(u) === rowId ? { ...u, role: newRole } : u)
                              )
                              showSnackbar(
                                t('admin_accounts.role_updated').replace('{role}', roleLabel(newRole)),
                                async () => {
                                  try {
                                    await apiService.users.update(rowId, { role: previousRole })
                                    setOfficers((prev) =>
                                      prev.map((u) => safeId(u) === rowId ? { ...u, role: previousRole } : u)
                                    )
                                  } catch { /* silent undo */ }
                                }
                              )
                            } catch {
                              showSnackbar(t('admin_accounts.role_update_failed'))
                            } finally {
                              setRoleSaving((prev) => ({ ...prev, [rowId]: false }))
                            }
                          }}
                          sx={{ fontSize: 12, minWidth: 110, borderRadius: '8px' }}
                        >
                          <MenuItem value="officer">{t('admin_accounts.role_officer')}</MenuItem>
                          <MenuItem value="supervisor">{t('admin_accounts.role_supervisor')}</MenuItem>
                          <MenuItem value="admin">{t('admin_accounts.role_admin')}</MenuItem>
                        </Select>
                      ) : (
                        <Chip
                          icon={<AdminPanelSettingsRoundedIcon sx={{ fontSize: 14 }} />}
                          label={roleLabel(o.role)}
                          size="small"
                          deleteIcon={<EditRoundedIcon sx={{ fontSize: 13 }} />}
                          onDelete={() => setEditingRoleId(rowId)}
                          onClick={() => setEditingRoleId(rowId)}
                          sx={{
                            bgcolor: roleStyle?.bg,
                            color: roleStyle?.color,
                            fontWeight: 700, fontSize: 11,
                            cursor: 'pointer',
                            '& .MuiChip-icon': { color: roleStyle?.color },
                            '& .MuiChip-deleteIcon': { color: alpha(roleStyle?.color ?? '', 0.6), '&:hover': { color: roleStyle?.color } },
                          }}
                        />
                      )}
                    </TableCell>

                    {/* Phone */}
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {o.phoneNumber ? (
                          <>
                            <PhoneRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>{o.phoneNumber}</Typography>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </Stack>
                    </TableCell>

                    {/* Center */}
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {o.center ? (
                          <>
                            <LocationOnRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>{o.center}</Typography>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </Stack>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {isDeactivated(o) ? (
                        <Tooltip title={o.deletedReason || ''} disableHoverListener={!o.deletedReason}>
                          <Chip
                            icon={<PersonOffRoundedIcon sx={{ fontSize: 14 }} />}
                            label={t('admin_accounts.deactivated')}
                            size="small"
                            sx={{
                              bgcolor: alpha(theme.palette.text.disabled, 0.12),
                              color: 'text.secondary',
                              fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                              borderRadius: '8px',
                              '& .MuiChip-icon': { color: theme.palette.text.disabled },
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <StatusDropdownButton
                          currentStatus={status}
                          disabled={!!statusSaving[rowId] || isPending(o)}
                          theme={theme}
                          t={t}
                          onStatusChange={(newStatus) => handleStatusChange(o, newStatus)}
                        />
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        {isPending(o) ? (
                          <>
                            <Tooltip title="Approve — activate this account so the officer can sign in">
                              <span>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => approveAccount(o)}
                                  disabled={!!approving[apiId(o)] || !!approving[`reject_${apiId(o)}`]}
                                  startIcon={<CheckCircleRoundedIcon fontSize="small" />}
                                  sx={{ borderRadius: '8px', fontWeight: 700, textTransform: 'none', fontSize: 12, px: 1.5, minWidth: 90 }}
                                >
                                  {approving[apiId(o)] ? t('admin_accounts.approving') : t('admin_accounts.approve')}
                                </Button>
                              </span>
                            </Tooltip>
                            <Tooltip title="Reject — block this registration request">
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => rejectAccount(o)}
                                  disabled={!!approving[apiId(o)] || !!approving[`reject_${apiId(o)}`]}
                                  startIcon={<CancelRoundedIcon fontSize="small" />}
                                  sx={{ borderRadius: '8px', fontWeight: 700, textTransform: 'none', fontSize: 12, px: 1.5, minWidth: 80 }}
                                >
                                  {approving[`reject_${apiId(o)}`] ? t('admin_accounts.rejecting') : t('admin_accounts.reject')}
                                </Button>
                              </span>
                            </Tooltip>
                          </>
                        ) : isDeactivated(o) ? (
                          <Tooltip title={t('admin_accounts.restore')}>
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                onClick={() => restoreOfficer(o)}
                                disabled={!!restoringIds[apiId(o)]}
                                startIcon={<RestoreRoundedIcon fontSize="small" />}
                                sx={{ borderRadius: '8px', fontWeight: 700, textTransform: 'none', fontSize: 12, px: 1.5 }}
                              >
                                {restoringIds[apiId(o)] ? t('admin_accounts.restoring') : t('admin_accounts.restore')}
                              </Button>
                            </span>
                          </Tooltip>
                        ) : (
                          <>
                            <Tooltip title={t('admin_accounts.reset_password')}>
                              <IconButton
                                size="small"
                                onClick={() => setResetPwdTarget(o)}
                                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                              >
                                <LockResetRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('admin_accounts.revoke_sessions')}>
                              <IconButton
                                size="small"
                                onClick={() => setRevokeTarget(o)}
                                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}
                              >
                                <LogoutRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('admin_accounts.deactivate')}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeactivateTarget(o)}
                                sx={{ border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.4), borderRadius: '8px' }}
                              >
                                <PersonOffRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={filteredOfficers.length}
          page={accPage}
          onPageChange={(_, newPage) => setAccPage(newPage)}
          rowsPerPage={accRowsPerPage}
          onRowsPerPageChange={(e) => { setAccRowsPerPage(parseInt(e.target.value, 10)); setAccPage(0) }}
          rowsPerPageOptions={[10, 15, 25, 50]}
          sx={{ borderTop: `1px solid`, borderColor: 'divider' }}
        />
      </Paper>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <ResetPasswordDialog
        open={Boolean(resetPwdTarget)}
        officerName={resetPwdTarget ? displayName(resetPwdTarget) : ''}
        onClose={() => setResetPwdTarget(null)}
        onConfirm={handleResetPassword}
        t={t}
      />

      <RevokeSessionsDialog
        open={Boolean(revokeTarget)}
        officerName={revokeTarget ? displayName(revokeTarget) : ''}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevokeSessions}
        t={t}
      />

      <DeactivateDialog
        open={Boolean(deactivateTarget)}
        officerName={deactivateTarget ? displayName(deactivateTarget) : ''}
        busy={deactivating}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        t={t}
      />

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        message={snackbar.message}
        action={
          snackbar.undoFn ? (
            <Button
              color="secondary"
              size="small"
              onClick={() => { snackbar.undoFn?.(); setSnackbar((p) => ({ ...p, open: false })) }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Undo
            </Button>
          ) : undefined
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  )
}
