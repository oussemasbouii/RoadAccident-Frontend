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
} from '@mui/material'
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
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>Administration • Officer Accounts</Typography>
        <Typography color="text.secondary">Validate, search, restrict, reset, and manage officer accounts.</Typography>
      </Box>

      <Card>
        <Box sx={{ p: 2.5, display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' } }}>
          <TextField
            label="Search by name or officer ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
          />
          <TextField
            label="Audit reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={fetchOfficers} disabled={loading || !adminApiEnabled}>
            {loading ? 'Loading...' : 'Search'}
          </Button>
        </Box>
      </Card>

      {!adminApiEnabled && (
        <Alert severity="info">
          Backend does not currently expose admin-management routes in your API list. This page is ready, but disabled until those endpoints are added.
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Card>
        <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Officer Accounts</Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Officer</TableCell>
                <TableCell>Officer ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Validated</TableCell>
                <TableCell>Center</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {officers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {loading ? 'Loading officers...' : 'No officer accounts found.'}
                  </TableCell>
                </TableRow>
              ) : officers.map((o) => (
                <TableRow key={safeId(o)}>
                  <TableCell>{o.displayName || o.name || `${o.firstName || ''} ${o.lastName || ''}`.trim() || 'Unknown'}</TableCell>
                  <TableCell>{o.officerId || safeId(o)}</TableCell>
                  <TableCell>
                    <Badge label={(o.status || 'active').toUpperCase()} variant={badgeVariant(o.status) as any} size="sm" />
                  </TableCell>
                  <TableCell>
                    <Badge label={o.validated ? 'YES' : 'NO'} variant={o.validated ? 'success' : 'warning'} size="sm" />
                  </TableCell>
                  <TableCell>{o.center || '—'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="outlined" onClick={() => doAction(() => apiService.admin.validateOfficer(safeId(o), { reason, actorId }), 'Officer account validated.')} disabled={loading || !adminApiEnabled}>
                        Validate
                      </Button>

                      <TextField
                        select
                        size="small"
                        defaultValue="active"
                        sx={{ minWidth: 120 }}
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

                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          doAction(
                            () => apiService.admin.triggerOfficerPasswordReset(safeId(o), { reason, actorId }),
                            'Password reset initiated for officer.'
                          )
                        }
                        disabled={loading || !adminApiEnabled}
                      >
                        Reset Password
                      </Button>

                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() =>
                          doAction(
                            () => apiService.admin.deleteOfficer(safeId(o), { reason, actorId }),
                            'Officer account deleted.'
                          )
                        }
                        disabled={loading || !adminApiEnabled}
                      >
                        Delete
                      </Button>
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
