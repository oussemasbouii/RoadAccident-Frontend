import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  MenuItem,
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
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'

import Card from '../../../components/Common/Card'
import Badge from '../../../components/Common/Badge'
import { apiService } from '../../../services/api'
import { useAppSelector } from '../../../store/store'

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
}

export default function AdminAccountsPage() {
  const adminApiEnabled = import.meta.env.VITE_ENABLE_ADMIN_API === 'true'
  const currentUser = useAppSelector((s) => s.auth.user)
  const theme = useTheme()
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('Routine administration update')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [officers, setOfficers] = useState<OfficerRecord[]>([])

  const actorId = useMemo(() => currentUser?.id || currentUser?.officerId || 'admin-ui', [currentUser])

  const fetchOfficers = async () => {
    if (!adminApiEnabled) {
      setOfficers([])
      return
    }
    try {
      setLoading(true)
      setError(null)
      const resp = await apiService.admin.listOfficers({ query: query.trim() || undefined, page: 1, limit: 50 })
      const payload = resp.data?.data || resp.data || []
      const rows = Array.isArray(payload) ? payload : payload.items || payload.rows || []
      setOfficers(rows)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404) {
        setError('Admin account-management API is not available on this backend yet. Set VITE_ENABLE_ADMIN_API=true only when admin endpoints are implemented.')
      } else {
        setError(err?.response?.data?.message || err?.message || 'Failed to load officer accounts.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminApiEnabled) fetchOfficers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApiEnabled])

  const safeId = (o: OfficerRecord) => String(o.id || o._id || o.officerId || '')

  const doAction = async (action: () => Promise<any>, successMessage: string) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      await action()
      setSuccess(successMessage)
      await fetchOfficers()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Action failed.')
    } finally {
      setLoading(false)
    }
  }

  const badgeVariant = (status?: string) => {
    if (status === 'blocked') return 'danger'
    if (status === 'restricted') return 'warning'
    return 'success'
  }

  return (
    <Stack spacing={4} sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>Officer Accounts</Typography>
          <Typography color="text.secondary">Validate, manage status, and secure administrative accounts.</Typography>
        </Box>
        <Tooltip title="Refresh Records">
           <IconButton onClick={fetchOfficers} sx={{ bgcolor: 'background.paper', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
             <RefreshRoundedIcon />
           </IconButton>
        </Tooltip>
      </Box>

      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' } }}>
          <TextField
            label="Search Identification"
            placeholder="Name or Officer ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              sx: { borderRadius: 'var(--radius-m3-md, 12px)' }
            }}
          />
          <TextField
            label="Audit Documentation"
            placeholder="Reason for change"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <FilterListRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              sx: { borderRadius: 'var(--radius-m3-md, 12px)' }
            }}
          />
          <Button 
            variant="contained" 
            onClick={fetchOfficers} 
            disabled={loading || !adminApiEnabled}
            sx={{ px: 4, borderRadius: 'var(--radius-m3-full, 100px)', fontWeight: 700 }}
          >
            {loading ? 'Processing...' : 'Search'}
          </Button>
        </Box>
      </Card>

      {!adminApiEnabled && (
        <Alert severity="info" sx={{ borderRadius: 'var(--radius-m3-md, 12px)' }}>
          The administration API is currently disabled (VITE_ENABLE_ADMIN_API=false). Account management actions are in read-only mode.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ borderRadius: 'var(--radius-m3-md, 12px)' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ borderRadius: 'var(--radius-m3-md, 12px)' }}>{success}</Alert>}

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Account Registry</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', px: 2, py: 0.5, bgcolor: alpha(theme.palette.action.active, 0.05), borderRadius: 1 }}>
            {officers.length} Registered Officers
          </Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.action.active, 0.02) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 2, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Officer Entity</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>ID Status</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Validation</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assignment</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Account Control</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {officers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    {loading ? 'Loading account database...' : 'No officer accounts match your current search.'}
                  </TableCell>
                </TableRow>
              ) : officers.map((o) => (
                <TableRow 
                  key={safeId(o)}
                  sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.01) } }}
                >
                  <TableCell sx={{ py: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                       <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontWeight: 800, fontSize: 13, borderRadius: '10px' }}>
                         {(o.displayName || o.officerId || 'U')[0].toUpperCase()}
                       </Avatar>
                       <Box>
                         <Typography variant="body2" sx={{ fontWeight: 700 }}>{o.displayName || o.name || 'Unknown Officer'}</Typography>
                         <Typography variant="caption" color="text.secondary">ID: {o.officerId || safeId(o)}</Typography>
                       </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Badge label={(o.status || 'active').toUpperCase()} variant={badgeVariant(o.status) as any} size="sm" />
                  </TableCell>
                  <TableCell>
                    <Badge label={o.validated ? 'VALIDATED' : 'PENDING'} variant={o.validated ? 'success' : 'warning'} size="sm" />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>{o.center || 'Unassigned'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="nowrap">
                      <Tooltip title="Validate Account">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => doAction(() => apiService.admin.validateOfficer(safeId(o), { reason, actorId }), 'Officer account validated.')} 
                          disabled={loading || !adminApiEnabled || o.validated}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
                        >
                          <VerifiedUserRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <TextField
                        select
                        size="small"
                        defaultValue={o.status || 'active'}
                        sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                        onChange={(e) => {
                          if (!adminApiEnabled) return
                          const status = e.target.value as 'active' | 'blocked' | 'restricted'
                          doAction(
                            () => apiService.admin.updateOfficerStatus(safeId(o), { status, reason, actorId }),
                            `Officer status changed to ${status}.`
                          )
                        }}
                        disabled={!adminApiEnabled}
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="restricted">Restricted</MenuItem>
                        <MenuItem value="blocked">Blocked</MenuItem>
                      </TextField>

                      <Tooltip title="Reset Password">
                        <IconButton
                          size="small"
                          onClick={() =>
                            doAction(
                              () => apiService.admin.triggerOfficerPasswordReset(safeId(o), { reason, actorId }),
                              'Password reset initiated for officer.'
                            )
                          }
                          disabled={loading || !adminApiEnabled}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
                        >
                          <LockResetRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Delete Account">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            doAction(
                              () => apiService.admin.deleteOfficer(safeId(o), { reason, actorId }),
                              'Officer account deleted.'
                            )
                          }
                          disabled={loading || !adminApiEnabled}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Stack>
  )
}
