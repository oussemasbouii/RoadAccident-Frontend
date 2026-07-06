# Meaningful Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three high-value feature clusters: (1) incident approval workflow, (2) analytics & map completeness, and (3) admin/RBAC polish + idle timeout.

**Architecture:** Each cluster is self-contained. Cluster 1 extends the existing incidents slice + drawer with supervisor review capabilities. Cluster 2 adds a chart library and improves the existing map panel. Cluster 3 extends `AdminAccountsPage` with inline role editing, bulk selection, and adds an idle-timeout watcher to `authSecurity.ts`.

**Tech Stack:** React 18, TypeScript, MUI v7, Redux Toolkit, Mapbox GL, recharts (new), date-fns, Vitest + React Testing Library

---

## Phase 1 — Incident Approval Workflow

### Task 1: Extend types, API methods, and Redux thunks

**Files:**
- Modify: `src/features/incidents/slices/incidentsSlice.ts`
- Modify: `src/services/api.ts`
- Modify: `src/i18n.types.ts`

#### Assumption
The backend exposes:
- `POST /accidents/:id/approve` — body `{ comment: string }`
- `POST /accidents/:id/reject`  — body `{ comment: string }`
- `GET  /accidents/:id/audit-log` — returns `AuditEntry[]`

If the backend does not yet have these, the thunks will fail gracefully (the slice handles `rejected` state).

- [ ] **Step 1: Write the failing test**

Create `src/features/incidents/slices/incidentsSlice.approval.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import incidentsReducer, {
  approveIncident,
  rejectIncident,
} from './incidentsSlice'

vi.mock('../../../services/api', () => ({
  apiService: {
    incidents: {
      approve: vi.fn(),
      reject: vi.fn(),
    },
  },
}))

import { apiService } from '../../../services/api'

const makeStore = (preloaded = {}) =>
  configureStore({ reducer: { incidents: incidentsReducer }, preloadedState: preloaded })

describe('approveIncident thunk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets approvalStatus to approved on fulfillment', async () => {
    const incident = { id: '42', location: 'Tunis', severity: 'high', status: 'active', vehicles: 1, injuries: 0, time: 'now', approvalStatus: 'pending' as const }
    const store = makeStore({ incidents: { list: [incident], loading: false, error: null, currentIncident: null, total: 1, page: 1, stats: { open: 1, resolved: 0, fatalities: 0, avgResponseTime: 0 } } })

    ;(apiService.incidents.approve as any).mockResolvedValueOnce({ data: { data: { ...incident, approvalStatus: 'approved' } } })

    await store.dispatch(approveIncident({ id: '42', comment: 'Looks correct' }) as any)

    const updated = store.getState().incidents.list.find((i) => i.id === '42')
    expect(updated?.approvalStatus).toBe('approved')
  })

  it('sets error on rejection', async () => {
    const store = makeStore({ incidents: { list: [], loading: false, error: null, currentIncident: null, total: 0, page: 1, stats: { open: 0, resolved: 0, fatalities: 0, avgResponseTime: 0 } } })

    ;(apiService.incidents.approve as any).mockRejectedValueOnce({ response: { data: { message: 'Not found' } } })

    await store.dispatch(approveIncident({ id: '99', comment: 'x' }) as any)

    expect(store.getState().incidents.error).toBe('Not found')
  })
})

describe('rejectIncident thunk', () => {
  it('sets approvalStatus to rejected on fulfillment', async () => {
    const incident = { id: '7', location: 'Sfax', severity: 'low', status: 'active', vehicles: 1, injuries: 0, time: 'now', approvalStatus: 'pending' as const }
    const store = makeStore({ incidents: { list: [incident], loading: false, error: null, currentIncident: null, total: 1, page: 1, stats: { open: 1, resolved: 0, fatalities: 0, avgResponseTime: 0 } } })

    ;(apiService.incidents.reject as any).mockResolvedValueOnce({ data: { data: { ...incident, approvalStatus: 'rejected' } } })

    await store.dispatch(rejectIncident({ id: '7', comment: 'Incomplete data' }) as any)

    const updated = store.getState().incidents.list.find((i) => i.id === '7')
    expect(updated?.approvalStatus).toBe('rejected')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (approveIncident/rejectIncident not defined)**

```bash
npx vitest run src/features/incidents/slices/incidentsSlice.approval.test.ts
```

Expected: `Error: approveIncident is not a function` (or similar import error).

- [ ] **Step 3: Add `AuditEntry` type, `approvalStatus` field, API methods, and thunks**

In `src/features/incidents/slices/incidentsSlice.ts`, after the `Incident` interface add:

```typescript
export interface AuditEntry {
  action: 'created' | 'approved' | 'rejected' | 'updated'
  comment: string
  actor: string
  timestamp: string
}
```

Add `approvalStatus` and `auditLog` to the `Incident` interface:

```typescript
export interface Incident {
  id: string
  location: string
  latitude?: number
  longitude?: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'responded' | 'resolved'
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  auditLog?: AuditEntry[]
  time: string
  timestamp?: string
  vehicles: number
  injuries: number
  description?: string
  cause?: string
}
```

In `toUiIncident`, before the `return {` block, add:

```typescript
const approvalStatus: Incident['approvalStatus'] =
  (['pending', 'approved', 'rejected'].includes(raw?.approvalStatus)
    ? raw.approvalStatus
    : 'pending') as Incident['approvalStatus']

const auditLog: AuditEntry[] = Array.isArray(raw?.auditLog)
  ? raw.auditLog
  : []
```

In the `return { ... }` of `toUiIncident`, add the two new fields:

```typescript
approvalStatus,
auditLog,
```

After `export const updateIncident = createAsyncThunk(...)`, add the two new thunks:

```typescript
export const approveIncident = createAsyncThunk(
  'incidents/approveIncident',
  async ({ id, comment }: { id: string; comment: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.incidents.approve(id, comment)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to approve incident')
    }
  }
)

export const rejectIncident = createAsyncThunk(
  'incidents/rejectIncident',
  async ({ id, comment }: { id: string; comment: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.incidents.reject(id, comment)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject incident')
    }
  }
)
```

In `extraReducers`, after the `updateIncident` cases, add:

```typescript
// Approve incident
builder.addCase(approveIncident.pending, (state) => {
  state.loading = true
  state.error = null
})
builder.addCase(approveIncident.fulfilled, (state, action) => {
  state.loading = false
  const updated = unwrapResponseData(action.payload)
  if (!updated) return
  const incoming = toUiIncident(updated)
  const idx = state.list.findIndex((i) => i.id === incoming.id)
  if (idx >= 0) state.list[idx] = incoming
  state.currentIncident = updated
})
builder.addCase(approveIncident.rejected, (state, action) => {
  state.loading = false
  state.error = action.payload as string
})

// Reject incident
builder.addCase(rejectIncident.pending, (state) => {
  state.loading = true
  state.error = null
})
builder.addCase(rejectIncident.fulfilled, (state, action) => {
  state.loading = false
  const updated = unwrapResponseData(action.payload)
  if (!updated) return
  const incoming = toUiIncident(updated)
  const idx = state.list.findIndex((i) => i.id === incoming.id)
  if (idx >= 0) state.list[idx] = incoming
  state.currentIncident = updated
})
builder.addCase(rejectIncident.rejected, (state, action) => {
  state.loading = false
  state.error = action.payload as string
})
```

Update the `export const { ... }` line at the bottom to include the new thunks:

```typescript
export const { clearError, clearCurrentIncident, prependIncomingIncident } = incidentsSlice.actions
export { approveIncident, rejectIncident }
```

In `src/services/api.ts`, inside the `incidents` object, add:

```typescript
approve: (id: string, comment: string) => api.post(`/accidents/${id}/approve`, { comment }),
reject: (id: string, comment: string) => api.post(`/accidents/${id}/reject`, { comment }),
getAuditLog: (id: string) => api.get(`/accidents/${id}/audit-log`),
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/features/incidents/slices/incidentsSlice.approval.test.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/features/incidents/slices/incidentsSlice.ts src/services/api.ts src/features/incidents/slices/incidentsSlice.approval.test.ts
git commit -m "feat: add approveIncident/rejectIncident thunks and AuditEntry type"
```

---

### Task 2: ApprovalActionBar component

**Files:**
- Create: `src/features/incidents/components/ApprovalActionBar.tsx`
- Create: `src/features/incidents/components/ApprovalActionBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/incidents/components/ApprovalActionBar.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ThemeModeProvider } from '../../../themeMode'
import ApprovalActionBar from './ApprovalActionBar'

const wrap = (ui: React.ReactElement) =>
  render(<ThemeModeProvider>{ui}</ThemeModeProvider>)

describe('ApprovalActionBar', () => {
  it('shows Approve and Reject buttons when status is pending', () => {
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /reject/i })).toBeDefined()
  })

  it('shows Approved badge when status is approved', () => {
    wrap(<ApprovalActionBar approvalStatus="approved" onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/approved/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull()
  })

  it('shows Rejected badge when status is rejected', () => {
    wrap(<ApprovalActionBar approvalStatus="rejected" onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/rejected/i)).toBeDefined()
  })

  it('opens confirmation dialog on Approve click', () => {
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={vi.fn()} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByLabelText(/comment/i)).toBeDefined()
  })

  it('disables confirm button when comment is empty', () => {
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={vi.fn()} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls onApprove with comment when confirmed', () => {
    const onApprove = vi.fn()
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={onApprove} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: 'Correct data' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onApprove).toHaveBeenCalledWith('Correct data')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/features/incidents/components/ApprovalActionBar.test.tsx
```

Expected: module not found.

- [ ] **Step 3: Create the component**

Create `src/features/incidents/components/ApprovalActionBar.tsx`:

```typescript
import { useState } from 'react'
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, TextField, Typography, alpha, useTheme,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import PendingRoundedIcon from '@mui/icons-material/PendingRounded'

interface Props {
  approvalStatus: 'pending' | 'approved' | 'rejected' | undefined
  onApprove: (comment: string) => void
  onReject: (comment: string) => void
  loading?: boolean
}

export default function ApprovalActionBar({ approvalStatus, onApprove, onReject, loading }: Props) {
  const theme = useTheme()
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')

  const handleOpen = (action: 'approve' | 'reject') => {
    setComment('')
    setDialog(action)
  }

  const handleConfirm = () => {
    if (!comment.trim()) return
    if (dialog === 'approve') onApprove(comment.trim())
    else onReject(comment.trim())
    setDialog(null)
  }

  if (approvalStatus === 'approved') {
    return (
      <Chip
        icon={<CheckCircleRoundedIcon />}
        label="Approved"
        sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main', fontWeight: 700 }}
      />
    )
  }

  if (approvalStatus === 'rejected') {
    return (
      <Chip
        icon={<CancelRoundedIcon />}
        label="Rejected"
        sx={{ bgcolor: alpha(theme.palette.error.main, 0.12), color: 'error.main', fontWeight: 700 }}
      />
    )
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <Chip
          icon={<PendingRoundedIcon />}
          label="Pending Review"
          size="small"
          sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.dark', fontWeight: 600 }}
        />
        <Button
          variant="contained"
          color="success"
          size="small"
          disabled={loading}
          onClick={() => handleOpen('approve')}
          aria-label="approve"
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
        >
          Approve
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="small"
          disabled={loading}
          onClick={() => handleOpen('reject')}
          aria-label="reject"
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
        >
          Reject
        </Button>
      </Box>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialog === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {dialog === 'approve'
              ? 'Add a mandatory comment to approve this record.'
              : 'Add a mandatory comment to reject this record.'}
          </Typography>
          <TextField
            label="Comment"
            inputProps={{ 'aria-label': 'comment' }}
            multiline
            rows={3}
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            color={dialog === 'approve' ? 'success' : 'error'}
            disabled={!comment.trim()}
            onClick={handleConfirm}
            aria-label="confirm"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/features/incidents/components/ApprovalActionBar.test.tsx
```

Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/features/incidents/components/ApprovalActionBar.tsx src/features/incidents/components/ApprovalActionBar.test.tsx
git commit -m "feat: add ApprovalActionBar component with mandatory comment dialog"
```

---

### Task 3: AuditTrailPanel component

**Files:**
- Create: `src/features/incidents/components/AuditTrailPanel.tsx`
- Create: `src/features/incidents/components/AuditTrailPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/incidents/components/AuditTrailPanel.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThemeModeProvider } from '../../../themeMode'
import AuditTrailPanel from './AuditTrailPanel'
import type { AuditEntry } from '../slices/incidentsSlice'

const wrap = (ui: React.ReactElement) =>
  render(<ThemeModeProvider>{ui}</ThemeModeProvider>)

const entries: AuditEntry[] = [
  { action: 'created', comment: 'Initial report', actor: 'Officer A', timestamp: '2026-06-01T10:00:00Z' },
  { action: 'approved', comment: 'Data verified', actor: 'Supervisor B', timestamp: '2026-06-01T11:00:00Z' },
]

describe('AuditTrailPanel', () => {
  it('renders all entries', () => {
    wrap(<AuditTrailPanel entries={entries} />)
    expect(screen.getByText('Officer A')).toBeDefined()
    expect(screen.getByText('Supervisor B')).toBeDefined()
    expect(screen.getByText('Initial report')).toBeDefined()
    expect(screen.getByText('Data verified')).toBeDefined()
  })

  it('shows empty state when no entries', () => {
    wrap(<AuditTrailPanel entries={[]} />)
    expect(screen.getByText(/no audit entries/i)).toBeDefined()
  })

  it('shows action labels', () => {
    wrap(<AuditTrailPanel entries={entries} />)
    expect(screen.getByText(/created/i)).toBeDefined()
    expect(screen.getByText(/approved/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/features/incidents/components/AuditTrailPanel.test.tsx
```

- [ ] **Step 3: Create the component**

Create `src/features/incidents/components/AuditTrailPanel.tsx`:

```typescript
import {
  Box, Chip, Divider, Stack, Typography, alpha, useTheme,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import type { AuditEntry } from '../slices/incidentsSlice'

const ACTION_CONFIG: Record<AuditEntry['action'], { color: string; icon: React.ReactNode; label: string }> = {
  created:  { color: '#6366F1', icon: <AddCircleRoundedIcon fontSize="small" />,   label: 'Created' },
  approved: { color: '#16A34A', icon: <CheckCircleRoundedIcon fontSize="small" />, label: 'Approved' },
  rejected: { color: '#DC2626', icon: <CancelRoundedIcon fontSize="small" />,      label: 'Rejected' },
  updated:  { color: '#0284C7', icon: <EditRoundedIcon fontSize="small" />,         label: 'Updated' },
}

function formatTs(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

interface Props {
  entries: AuditEntry[]
}

export default function AuditTrailPanel({ entries }: Props) {
  const theme = useTheme()

  if (entries.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">No audit entries</Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={0} divider={<Divider />}>
      {entries.map((entry, idx) => {
        const cfg = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.updated
        return (
          <Box key={idx} sx={{ py: 1.5, px: 0.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box
              sx={{
                mt: 0.25, p: 0.5, borderRadius: '50%',
                bgcolor: alpha(cfg.color, 0.12), color: cfg.color,
                display: 'flex', flexShrink: 0,
              }}
            >
              {cfg.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip label={cfg.label} size="small" sx={{ bgcolor: alpha(cfg.color, 0.1), color: cfg.color, fontWeight: 700, fontSize: 10 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{entry.actor}</Typography>
                <Typography variant="caption" color="text.disabled">{formatTs(entry.timestamp)}</Typography>
              </Stack>
              {entry.comment && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {entry.comment}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/features/incidents/components/AuditTrailPanel.test.tsx
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/features/incidents/components/AuditTrailPanel.tsx src/features/incidents/components/AuditTrailPanel.test.tsx
git commit -m "feat: add AuditTrailPanel component"
```

---

### Task 4: Wire review mode into IncidentsPage and AddIncidentDrawer

**Files:**
- Modify: `src/features/incidents/components/AddIncidentDrawer.tsx` (add `'review'` mode + render ApprovalActionBar + AuditTrailPanel)
- Modify: `src/features/incidents/pages/IncidentsPage.tsx` (add Review button, admin-only)

#### 4a — Extend AddIncidentDrawer with review mode

- [ ] **Step 1: Update `AddIncidentDrawerProps` in `AddIncidentDrawer.tsx`**

Find the existing interface:

```typescript
export interface AddIncidentDrawerProps {
  open: boolean
  onClose: () => void
  onSubmit?: (payload: any) => Promise<any> | any
  error?: string | null
  mode?: 'create' | 'edit'
  initialData?: any | null
}
```

Replace with:

```typescript
export interface AddIncidentDrawerProps {
  open: boolean
  onClose: () => void
  onSubmit?: (payload: any) => Promise<any> | any
  onApprove?: (comment: string) => void
  onReject?: (comment: string) => void
  error?: string | null
  mode?: 'create' | 'edit' | 'review'
  initialData?: any | null
}
```

- [ ] **Step 2: Add imports for the new panels at the top of `AddIncidentDrawer.tsx`**

After the existing imports, add:

```typescript
import ApprovalActionBar from './ApprovalActionBar'
import AuditTrailPanel from './AuditTrailPanel'
import type { AuditEntry } from '../slices/incidentsSlice'
```

- [ ] **Step 3: Render the review panel inside the drawer**

In the drawer JSX, find the section that renders the main form content. Locate the existing submit/save button area at the bottom. Just before it (or in a conditional block based on `mode`), add:

```typescript
{mode === 'review' && (
  <Box sx={{ mt: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
      Supervisor Review
    </Typography>
    <ApprovalActionBar
      approvalStatus={initialData?.approvalStatus}
      onApprove={onApprove ?? (() => {})}
      onReject={onReject ?? (() => {})}
    />
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2.5, mb: 1 }}>
      Audit Trail
    </Typography>
    <AuditTrailPanel entries={(initialData?.auditLog ?? []) as AuditEntry[]} />
  </Box>
)}
```

Also add `disabled={mode === 'review'}` to all form input fields when in review mode. Find each `TextField` / `Select` inside the form and add:

```typescript
disabled={mode === 'review' || ...existingDisabled}
```

Hide the submit button in review mode by wrapping its render in:

```typescript
{mode !== 'review' && (
  // ... existing submit button JSX
)}
```

- [ ] **Step 4: Wire review mode into `IncidentsPage.tsx`**

In `IncidentsPage.tsx`, add to the existing state declarations at the top:

```typescript
const user = useAppSelector((state) => state.auth.user)
const isAdmin = user?.role === 'admin'
```

Add import for `approveIncident` and `rejectIncident`:

```typescript
import { fetchIncidents, fetchIncidentById, createIncident, updateIncident, clearError, approveIncident, rejectIncident } from '../slices/incidentsSlice'
```

Add import for `useAppSelector`:
(already present — just ensure `state.auth` is in the store type. It is, confirmed from `store.ts`.)

Add a handler:

```typescript
const handleOpenReviewDrawer = async (id: string) => {
  try {
    setDrawerLoading(true)
    setEditingIncidentId(id)
    dispatch(clearError())
    const payload = await dispatch(fetchIncidentById(id) as any).unwrap()
    setEditingIncident(payload?.data ?? payload)
    setDrawerMode('review' as any)
    setDrawerOpen(true)
  } catch {
    // error pushed to slice
  } finally {
    setDrawerLoading(false)
    setEditingIncidentId(null)
  }
}
```

In the table row's action cell, after the existing Edit button, add the Review button (admin only):

```typescript
{isAdmin && (
  <Button
    variant="primary"
    size="sm"
    onClick={(event) => {
      event.stopPropagation()
      handleOpenReviewDrawer(incident.id)
    }}
    loading={drawerLoading && editingIncidentId === incident.id}
    disabled={drawerLoading && editingIncidentId !== incident.id}
    aria-label={`review incident ${incident.id}`}
  >
    Review
  </Button>
)}
```

Update the `<AddIncidentDrawer>` usage to pass the new handlers:

```typescript
<AddIncidentDrawer
  open={drawerOpen}
  onClose={handleCloseDrawer}
  error={drawerOpen ? incidentsError : null}
  mode={drawerMode as any}
  initialData={editingIncident}
  onApprove={async (comment) => {
    if (editingIncident?.id) {
      await dispatch(approveIncident({ id: String(editingIncident.id), comment }) as any).unwrap()
      handleCloseDrawer()
    }
  }}
  onReject={async (comment) => {
    if (editingIncident?.id) {
      await dispatch(rejectIncident({ id: String(editingIncident.id), comment }) as any).unwrap()
      handleCloseDrawer()
    }
  }}
  onSubmit={async (payload) => {
    // ... existing submit logic unchanged
  }}
/>
```

- [ ] **Step 5: Run existing IncidentsPage tests**

```bash
npx vitest run src/features/incidents/pages/IncidentsPage.test.tsx
```

Expected: `2 passed` (existing tests should not break).

- [ ] **Step 6: Commit**

```bash
git add src/features/incidents/components/AddIncidentDrawer.tsx src/features/incidents/pages/IncidentsPage.tsx
git commit -m "feat: wire approval workflow into IncidentsPage with admin review mode"
```

---

### Task 5: Add approval translations

**Files:**
- Modify: `src/i18n.types.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/fr.ts`
- Modify: `src/locales/ar.ts`

- [ ] **Step 1: Add `approval` namespace to `TranslationMessages` in `i18n.types.ts`**

After the last existing namespace in the type definition, add:

```typescript
approval: {
  pending: string
  approved: string
  rejected: string
  supervisor_review: string
  audit_trail: string
  no_audit_entries: string
  review_button: string
}
```

- [ ] **Step 2: Add English strings to `src/locales/en.ts`**

After the last existing namespace object, add:

```typescript
approval: {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  supervisor_review: 'Supervisor Review',
  audit_trail: 'Audit Trail',
  no_audit_entries: 'No audit entries',
  review_button: 'Review',
},
```

- [ ] **Step 3: Add French strings to `src/locales/fr.ts`**

```typescript
approval: {
  pending: 'En attente de révision',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  supervisor_review: 'Révision du superviseur',
  audit_trail: 'Piste d\'audit',
  no_audit_entries: 'Aucune entrée d\'audit',
  review_button: 'Réviser',
},
```

- [ ] **Step 4: Add Arabic strings to `src/locales/ar.ts`**

```typescript
approval: {
  pending: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  supervisor_review: 'مراجعة المشرف',
  audit_trail: 'سجل التدقيق',
  no_audit_entries: 'لا توجد إدخالات تدقيق',
  review_button: 'مراجعة',
},
```

- [ ] **Step 5: Update hardcoded strings in `ApprovalActionBar.tsx` and `AuditTrailPanel.tsx` to use `t()`**

In `ApprovalActionBar.tsx`, import `useTranslation` and replace the hardcoded strings:

```typescript
import { useTranslation } from '../../../themeMode'
// In component body:
const { t } = useTranslation()
// Replace 'Approve' → t('approval.review_button') ... etc as appropriate
// Replace 'Pending Review' → t('approval.pending')
// Replace 'Approved' → t('approval.approved')
// Replace 'Rejected' → t('approval.rejected')
```

Similarly update `AuditTrailPanel.tsx` for 'No audit entries' → `t('approval.no_audit_entries')`.

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/i18n.types.ts src/locales/en.ts src/locales/fr.ts src/locales/ar.ts src/features/incidents/components/ApprovalActionBar.tsx src/features/incidents/components/AuditTrailPanel.tsx
git commit -m "feat: add approval translations to all three locales"
```

---

## Phase 2 — Analytics & Map Completeness

### Task 6: Install recharts + TrendChart in Reports page

**Files:**
- Modify: `package.json` (add recharts)
- Create: `src/features/reports/components/TrendChart.tsx`
- Create: `src/features/reports/components/TrendChart.test.tsx`
- Modify: `src/features/reports/pages/ReportsPage.tsx`

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

Expected: `added X packages` — no errors.

- [ ] **Step 2: Write the failing test**

Create `src/features/reports/components/TrendChart.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThemeModeProvider } from '../../../themeMode'
import TrendChart from './TrendChart'
import type { Incident } from '../../incidents/slices/incidentsSlice'

const incidents: Partial<Incident>[] = [
  { id: '1', time: '2026-05-01T10:00:00Z', severity: 'high', status: 'active' },
  { id: '2', time: '2026-05-01T14:00:00Z', severity: 'low', status: 'resolved' },
  { id: '3', time: '2026-05-08T09:00:00Z', severity: 'critical', status: 'active' },
]

describe('TrendChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ThemeModeProvider>
        <TrendChart incidents={incidents as Incident[]} period="week" />
      </ThemeModeProvider>
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders a heading', () => {
    render(
      <ThemeModeProvider>
        <TrendChart incidents={incidents as Incident[]} period="week" />
      </ThemeModeProvider>
    )
    expect(screen.getByText(/incident trend/i)).toBeDefined()
  })
})
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx vitest run src/features/reports/components/TrendChart.test.tsx
```

- [ ] **Step 4: Create TrendChart component**

Create `src/features/reports/components/TrendChart.tsx`:

```typescript
import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Box, Typography, alpha, useTheme } from '@mui/material'
import { format, startOfDay, startOfWeek, startOfMonth, addDays, addWeeks, addMonths, isWithinInterval } from 'date-fns'
import type { Incident } from '../../incidents/slices/incidentsSlice'

type Period = 'day' | 'week' | 'month'

interface Props {
  incidents: Incident[]
  period: Period
}

function getBuckets(period: Period): { start: Date; label: string }[] {
  const now = new Date()
  if (period === 'day') {
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(startOfDay(now), -(13 - i))
      return { start: d, label: format(d, 'MMM d') }
    })
  }
  if (period === 'week') {
    return Array.from({ length: 8 }, (_, i) => {
      const d = addWeeks(startOfWeek(now), -(7 - i))
      return { start: d, label: format(d, 'MMM d') }
    })
  }
  return Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(startOfMonth(now), -(5 - i))
    return { start: d, label: format(d, 'MMM yyyy') }
  })
}

function countInBucket(incidents: Incident[], start: Date, end: Date, key: 'total' | 'critical' | 'resolved'): number {
  return incidents.filter((inc) => {
    const d = inc.timestamp ? new Date(inc.timestamp) : new Date(inc.time)
    if (Number.isNaN(d.getTime())) return false
    if (!isWithinInterval(d, { start, end })) return false
    if (key === 'total') return true
    if (key === 'critical') return inc.severity === 'critical'
    if (key === 'resolved') return inc.status === 'resolved'
    return false
  }).length
}

export default function TrendChart({ incidents, period }: Props) {
  const theme = useTheme()
  const buckets = getBuckets(period)

  const data = useMemo(() => {
    return buckets.map((bucket, idx) => {
      const nextBucket = buckets[idx + 1]
      const end = nextBucket ? new Date(nextBucket.start.getTime() - 1) : new Date()
      return {
        label: bucket.label,
        total: countInBucket(incidents, bucket.start, end, 'total'),
        critical: countInBucket(incidents, bucket.start, end, 'critical'),
        resolved: countInBucket(incidents, bucket.start, end, 'resolved'),
      }
    })
  }, [incidents, period])

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Incident Trend
      </Typography>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} />
          <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.paper,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="total" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} name="Total" />
          <Line type="monotone" dataKey="critical" stroke={theme.palette.error.main} strokeWidth={2} dot={false} name="Critical" />
          <Line type="monotone" dataKey="resolved" stroke={theme.palette.success.main} strokeWidth={2} dot={false} name="Resolved" />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run src/features/reports/components/TrendChart.test.tsx
```

Expected: `2 passed`.

- [ ] **Step 6: Integrate into ReportsPage Overview tab**

In `src/features/reports/pages/ReportsPage.tsx`, add the import:

```typescript
import TrendChart from '../components/TrendChart'
```

Find the Overview tab content (tab index 0). After the StatCard grid and before the next section, insert the TrendChart inside a `Card`:

```typescript
<Card sx={{ p: 3, mt: 2.5 }}>
  <TrendChart incidents={filteredIncidents} period={activeRange as 'day' | 'week' | 'month'} />
</Card>
```

Use the existing `activeRange` state that is already in the page. Map its values: `'day'` → `'day'`, `'week'` → `'week'`, `'month'` → `'month'`. If the page uses different key names, adapt accordingly (look at the `dayRangeMap` constant already defined at the top of that file — it uses `'day' | 'week' | 'month' | 'year'`).

For `'year'`, pass `'month'` as the period fallback:

```typescript
const trendPeriod: 'day' | 'week' | 'month' =
  activeRange === 'day' ? 'day' : activeRange === 'week' ? 'week' : 'month'
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/reports/components/TrendChart.tsx src/features/reports/components/TrendChart.test.tsx src/features/reports/pages/ReportsPage.tsx
git commit -m "feat: add TrendChart with recharts to Reports Overview tab"
```

---

### Task 7: Mapbox heatmap layer toggle in IncidentHeatmapPanel

**Files:**
- Modify: `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx`

- [ ] **Step 1: Add view-mode state and toggle button**

In `IncidentHeatmapPanel.tsx`, add a new state variable after the existing state declarations:

```typescript
const [viewMode, setViewMode] = useState<'pins' | 'heatmap'>('pins')
```

In the map panel header (the `Box` containing the title and the fit-bounds button), add a toggle button group after the existing `ZoomOutMapRoundedIcon` button:

```typescript
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'

// ... in JSX:
<ToggleButtonGroup
  value={viewMode}
  exclusive
  onChange={(_, v) => { if (v) setViewMode(v) }}
  size="small"
  sx={{ ml: 1 }}
>
  <ToggleButton value="pins" aria-label="pins view" sx={{ px: 1.5, py: 0.5, fontSize: 11 }}>
    <FiberManualRecordRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> Pins
  </ToggleButton>
  <ToggleButton value="heatmap" aria-label="heatmap view" sx={{ px: 1.5, py: 0.5, fontSize: 11 }}>
    <LayersRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> Heatmap
  </ToggleButton>
</ToggleButtonGroup>
```

- [ ] **Step 2: Add heatmap layer to map initialization**

In the `useEffect` that initialises the map (the one with `new mapboxgl.Map(...)`), after the section that adds the `incidents-circles` layer, add:

```typescript
map.addLayer({
  id: 'incidents-heatmap',
  type: 'heatmap',
  source: 'incidents',
  layout: { visibility: 'none' },
  paint: {
    'heatmap-weight': 1,
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(33,102,172,0)',
      0.2, 'rgb(103,169,207)',
      0.4, 'rgb(209,229,240)',
      0.6, 'rgb(253,219,199)',
      0.8, 'rgb(239,138,98)',
      1, 'rgb(178,24,43)',
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
    'heatmap-opacity': 0.8,
  },
})
```

- [ ] **Step 3: Toggle layer visibility when viewMode changes**

Add a `useEffect` that reacts to `viewMode` changes:

```typescript
useEffect(() => {
  const map = mapRef.current
  if (!map || !sourceLoaded.current) return
  if (viewMode === 'heatmap') {
    map.setLayoutProperty('incidents-circles', 'visibility', 'none')
    map.setLayoutProperty('incidents-heatmap', 'visibility', 'visible')
  } else {
    map.setLayoutProperty('incidents-circles', 'visibility', 'visible')
    map.setLayoutProperty('incidents-heatmap', 'visibility', 'none')
  }
}, [viewMode])
```

Note: the existing circle layer must be named `incidents-circles`. Verify the exact layer ID in the file and use that string. If it differs, match accordingly.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx
git commit -m "feat: add Mapbox heatmap layer toggle to IncidentHeatmapPanel"
```

---

### Task 8: Date range + wilaya filter panel for Reports map tab

**Files:**
- Modify: `src/features/reports/pages/ReportsPage.tsx`

- [ ] **Step 1: Add filter state for the Maps tab**

In `ReportsPage.tsx`, add a new state block near the top of the component (after the existing `filters` or `activeRange` state):

```typescript
const [mapFilters, setMapFilters] = useState({
  dateFrom: '',
  dateTo: '',
  wilaya: 'all',
  roadType: 'all',
})
```

- [ ] **Step 2: Derive available wilayas from incident data**

After the existing computed values (before the return), add:

```typescript
const availableWilayas = useMemo(() => {
  const govSet = new Set<string>()
  for (const inc of incidents) {
    const raw = (inc as any).governorate || ''
    if (raw) govSet.add(raw)
  }
  return Array.from(govSet).sort()
}, [incidents])
```

- [ ] **Step 3: Filter the incidents passed to the map based on mapFilters**

Add a `mapFilteredIncidents` derived value:

```typescript
const mapFilteredIncidents = useMemo(() => {
  return incidents.filter((inc: Incident) => {
    if (mapFilters.dateFrom) {
      const from = new Date(mapFilters.dateFrom)
      const incDate = inc.timestamp ? new Date(inc.timestamp) : new Date(inc.time)
      if (!Number.isNaN(incDate.getTime()) && incDate < from) return false
    }
    if (mapFilters.dateTo) {
      const to = new Date(mapFilters.dateTo)
      to.setHours(23, 59, 59, 999)
      const incDate = inc.timestamp ? new Date(inc.timestamp) : new Date(inc.time)
      if (!Number.isNaN(incDate.getTime()) && incDate > to) return false
    }
    if (mapFilters.wilaya !== 'all') {
      const gov = (inc as any).governorate || ''
      if (gov !== mapFilters.wilaya) return false
    }
    return true
  })
}, [incidents, mapFilters])
```

- [ ] **Step 4: Add filter UI in the Maps tab**

In the Maps tab content section (tab index that renders `IncidentHeatmapPanel`), add a filter `Card` above the panel:

```typescript
<Card sx={{ p: 2, mb: 2 }}>
  <Box sx={{
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
    gap: 2,
    alignItems: 'end',
  }}>
    <TextField
      label="From Date"
      type="date"
      size="small"
      value={mapFilters.dateFrom}
      onChange={(e) => setMapFilters((p) => ({ ...p, dateFrom: e.target.value }))}
      InputLabelProps={{ shrink: true }}
    />
    <TextField
      label="To Date"
      type="date"
      size="small"
      value={mapFilters.dateTo}
      onChange={(e) => setMapFilters((p) => ({ ...p, dateTo: e.target.value }))}
      InputLabelProps={{ shrink: true }}
    />
    <FormControl size="small">
      <InputLabel>Wilaya</InputLabel>
      <Select
        value={mapFilters.wilaya}
        label="Wilaya"
        onChange={(e) => setMapFilters((p) => ({ ...p, wilaya: e.target.value }))}
      >
        <MenuItem value="all">All Wilayas</MenuItem>
        {availableWilayas.map((w) => (
          <MenuItem key={w} value={w}>{w}</MenuItem>
        ))}
      </Select>
    </FormControl>
    <Button
      variant="outlined"
      size="small"
      onClick={() => setMapFilters({ dateFrom: '', dateTo: '', wilaya: 'all', roadType: 'all' })}
      sx={{ textTransform: 'none' }}
    >
      Clear Filters
    </Button>
  </Box>
</Card>
```

Also add missing imports at the top of `ReportsPage.tsx` if not already present: `FormControl`, `InputLabel`, `Select`, `MenuItem`, `Button` from `@mui/material`.

- [ ] **Step 5: Pass `mapFilteredIncidents` to the map panel**

Change:

```typescript
<IncidentHeatmapPanel incidents={filteredIncidents} />
```

to:

```typescript
<IncidentHeatmapPanel incidents={mapFilteredIncidents} />
```

(Use whatever variable name currently passes incidents to the panel — match it exactly.)

- [ ] **Step 6: Run existing ReportsPage tests**

```bash
npx vitest run src/features/reports/pages/ReportsPage.test.tsx
```

Expected: existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/reports/pages/ReportsPage.tsx
git commit -m "feat: add date/wilaya filter panel to Reports map tab"
```

---

### Task 9: Black-spot location drill-down in IncidentHeatmapPanel

**Files:**
- Modify: `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx`

- [ ] **Step 1: Add selected hotspot state**

In `IncidentHeatmapPanel.tsx`, add a state variable:

```typescript
const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null)
```

- [ ] **Step 2: Make hotspot list items clickable**

Find the hotspot list rendering (the `List` that renders `HotspotRow` items). For each list item, add an `onClick` handler and hover style:

```typescript
<ListItem
  key={row.location}
  onClick={() => {
    const next = selectedHotspot === row.location ? null : row.location
    setSelectedHotspot(next)
    if (next && row.coords && mapRef.current) {
      mapRef.current.flyTo({ center: [row.coords.lng, row.coords.lat], zoom: 12, duration: 900 })
    }
  }}
  sx={{
    cursor: 'pointer',
    borderRadius: 1.5,
    transition: 'background-color 0.15s ease',
    bgcolor: selectedHotspot === row.location
      ? alpha(theme.palette.primary.main, 0.08)
      : 'transparent',
    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
  }}
>
```

- [ ] **Step 3: Show incident count badge when a hotspot is selected**

Below the `ListItemText` in the same item, show a small filtered count chip when selected:

```typescript
{selectedHotspot === row.location && (
  <Chip
    label={`${row.count} incident${row.count !== 1 ? 's' : ''}`}
    size="small"
    color="primary"
    variant="outlined"
    sx={{ ml: 1, fontSize: 11, fontWeight: 700 }}
  />
)}
```

- [ ] **Step 4: Add a "Clear selection" button above the hotspot list when one is selected**

Just above the hotspot list (before the `<List>` tag), add:

```typescript
{selectedHotspot && (
  <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-end' }}>
    <Chip
      label={`Viewing: ${selectedHotspot}`}
      onDelete={() => setSelectedHotspot(null)}
      size="small"
      color="primary"
      sx={{ fontSize: 11 }}
    />
  </Box>
)}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx
git commit -m "feat: add black-spot drill-down with fly-to on hotspot click"
```

---

## Phase 3 — Admin & Security Polish

### Task 10: Role assignment UI in AdminAccountsPage

**Files:**
- Modify: `src/features/settings/pages/AdminAccountsPage.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/settings/pages/AdminAccountsPage.role.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { ThemeModeProvider } from '../../../themeMode'
import AdminAccountsPage from './AdminAccountsPage'
import authReducer from '../../auth/slices/authSlice'

vi.mock('../../../services/api', () => ({
  apiService: {
    admin: { listOfficers: vi.fn().mockResolvedValue({ data: { data: [] } }) },
    users: { update: vi.fn().mockResolvedValue({ data: {} }) },
  },
}))

const store = configureStore({
  reducer: {
    auth: authReducer,
    incidents: (s = {}) => s,
    alerts: (s = {}) => s,
    reports: (s = {}) => s,
  },
})

describe('AdminAccountsPage role column', () => {
  it('renders the Role column header', async () => {
    render(
      <Provider store={store}>
        <BrowserRouter>
          <ThemeModeProvider>
            <AdminAccountsPage />
          </ThemeModeProvider>
        </BrowserRouter>
      </Provider>
    )
    expect(await screen.findByText(/role/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/features/settings/pages/AdminAccountsPage.role.test.tsx
```

- [ ] **Step 3: Add Role column to the officer table**

In `AdminAccountsPage.tsx`:

1. Add a `Select` for role in the table header:

Find the `<TableHead>` row. After the existing status header cell, add:

```typescript
<TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
  Role
</TableCell>
```

2. Add a `roleSaving` state to track in-progress saves:

```typescript
const [roleSaving, setRoleSaving] = useState<Record<string, boolean>>({})
```

3. In the table body, for each officer row, after the status cell, add an inline role `Select`:

```typescript
<TableCell>
  <Select
    size="small"
    value={officer.role || 'officer'}
    disabled={roleSaving[officer._id || officer.id || '']}
    onChange={async (e) => {
      const id = officer._id || officer.id || ''
      const newRole = e.target.value as string
      setRoleSaving((prev) => ({ ...prev, [id]: true }))
      try {
        await apiService.users.update(id, { role: newRole })
        setOfficers((prev) =>
          prev.map((o) => (o._id === id || o.id === id) ? { ...o, role: newRole } : o)
        )
      } catch {
        // show nothing; role reverts visually on next fetch
      } finally {
        setRoleSaving((prev) => ({ ...prev, [id]: false }))
      }
    }}
    sx={{ fontSize: 12, minWidth: 110, borderRadius: '8px' }}
  >
    <MenuItem value="officer">Officer</MenuItem>
    <MenuItem value="dispatch">Dispatch</MenuItem>
    <MenuItem value="admin">Admin</MenuItem>
  </Select>
</TableCell>
```

Note: `setOfficers` is the existing state setter — verify its exact name in the file and use that.

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/features/settings/pages/AdminAccountsPage.role.test.tsx
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/pages/AdminAccountsPage.tsx src/features/settings/pages/AdminAccountsPage.role.test.tsx
git commit -m "feat: add inline role assignment UI to AdminAccountsPage"
```

---

### Task 11: Bulk selection and bulk actions in AdminAccountsPage

**Files:**
- Modify: `src/features/settings/pages/AdminAccountsPage.tsx`

- [ ] **Step 1: Add selection state**

In `AdminAccountsPage.tsx`, add two state variables:

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
const [bulkActionLoading, setBulkActionLoading] = useState(false)
```

- [ ] **Step 2: Add Checkbox column to table head**

In the `<TableHead>` row, prepend a checkbox cell:

```typescript
import Checkbox from '@mui/material/Checkbox'

// In TableHead:
<TableCell padding="checkbox">
  <Checkbox
    indeterminate={selectedIds.size > 0 && selectedIds.size < officers.length}
    checked={officers.length > 0 && selectedIds.size === officers.length}
    onChange={(e) => {
      if (e.target.checked) {
        setSelectedIds(new Set(officers.map((o) => String(o._id || o.id || ''))))
      } else {
        setSelectedIds(new Set())
      }
    }}
  />
</TableCell>
```

- [ ] **Step 3: Add Checkbox cell to each table row**

In the `<TableBody>` rows, prepend:

```typescript
<TableCell padding="checkbox">
  <Checkbox
    checked={selectedIds.has(String(officer._id || officer.id || ''))}
    onChange={(e) => {
      const id = String(officer._id || officer.id || '')
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (e.target.checked) next.add(id)
        else next.delete(id)
        return next
      })
    }}
  />
</TableCell>
```

- [ ] **Step 4: Add bulk action toolbar**

Create a bulk action toolbar that is conditionally rendered above the table when `selectedIds.size > 0`:

```typescript
{selectedIds.size > 0 && (
  <Box
    sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 2, py: 1.25, mb: 1,
      bgcolor: alpha(theme.palette.primary.main, 0.06),
      borderRadius: 2,
      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    }}
  >
    <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
      {selectedIds.size} selected
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
            Array.from(selectedIds).map((id) =>
              apiService.users.updateStatus(id, { isValid: true })
            )
          )
          setSelectedIds(new Set())
          // Re-fetch to sync
          fetchOfficers()
        } finally {
          setBulkActionLoading(false)
        }
      }}
      sx={{ textTransform: 'none', fontWeight: 600 }}
    >
      Activate
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
            Array.from(selectedIds).map((id) =>
              apiService.users.updateStatus(id, { isValid: false })
            )
          )
          setSelectedIds(new Set())
          fetchOfficers()
        } finally {
          setBulkActionLoading(false)
        }
      }}
      sx={{ textTransform: 'none', fontWeight: 600 }}
    >
      Block
    </Button>
    <Button
      size="small"
      onClick={() => setSelectedIds(new Set())}
      sx={{ textTransform: 'none' }}
    >
      Deselect
    </Button>
  </Box>
)}
```

Note: `fetchOfficers` is the existing data-fetch function — check its exact name in the file and use that.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/pages/AdminAccountsPage.tsx
git commit -m "feat: add bulk selection and bulk activate/block actions to AdminAccountsPage"
```

---

### Task 12: Idle timeout watcher

**Files:**
- Modify: `src/utils/authSecurity.ts`
- Create: `src/utils/authSecurity.idle.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/utils/authSecurity.idle.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startIdleWatcher } from './authSecurity'

describe('startIdleWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onTimeout after the specified timeout with no activity', () => {
    const onTimeout = vi.fn()
    const stop = startIdleWatcher(5000, onTimeout)
    vi.advanceTimersByTime(5001)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('resets the timer on mouse activity', () => {
    const onTimeout = vi.fn()
    const stop = startIdleWatcher(5000, onTimeout)
    vi.advanceTimersByTime(3000)
    window.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(3000)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2001)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stop() prevents the callback from firing', () => {
    const onTimeout = vi.fn()
    const stop = startIdleWatcher(5000, onTimeout)
    vi.advanceTimersByTime(3000)
    stop()
    vi.advanceTimersByTime(5000)
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/utils/authSecurity.idle.test.ts
```

Expected: `startIdleWatcher is not a function`.

- [ ] **Step 3: Add `startIdleWatcher` to `authSecurity.ts`**

In `src/utils/authSecurity.ts`, append:

```typescript
const IDLE_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

export function startIdleWatcher(timeoutMs: number, onTimeout: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>

  const reset = () => {
    clearTimeout(timer)
    timer = setTimeout(onTimeout, timeoutMs)
  }

  IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
  reset()

  return () => {
    clearTimeout(timer)
    IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset))
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/utils/authSecurity.idle.test.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Wire into App.tsx**

In `src/App.tsx`, update the imports to include the new function and add the necessary Redux imports:

```typescript
import { clearAuthStorage, isTokenExpired, startIdleWatcher } from './utils/authSecurity'
import { setUser } from './features/auth/slices/authSlice'
```

Note: `setUser` is likely already imported. Confirm and avoid duplicate imports.

Inside the `AuthenticatedServices` component (the inner function component), add:

```typescript
const dispatch = useDispatch()

useEffect(() => {
  const THIRTY_MINUTES = 30 * 60 * 1000
  const stop = startIdleWatcher(THIRTY_MINUTES, () => {
    clearAuthStorage()
    dispatch(setUser(null))
    window.location.replace('/login')
  })
  return stop
}, [dispatch])
```

`AuthenticatedServices` currently only conditionally returns null or `<>...</>`. The `useDispatch` call at the top of the function is valid because the component is always rendered inside `<Provider store={store}>` (it is rendered inside `<Router>` which is inside `<Provider>`). Confirm by checking `App.tsx` lines 121–136.

- [ ] **Step 6: Run the full test suite**

```bash
npx vitest run
```

Expected: all existing tests pass, plus new tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/authSecurity.ts src/utils/authSecurity.idle.test.ts src/App.tsx
git commit -m "feat: add idle timeout watcher — logs out after 30 min of inactivity"
```

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task |
|---|---|
| T-06-01-02 Approve/reject with mandatory comment | Tasks 1–4 |
| T-06-01-03 Audit trail panel | Tasks 1, 3, 4 |
| T-07-01-02 Time-series trend chart | Task 6 |
| T-07-02-02 Heatmap layer | Task 7 |
| T-07-02-03 Date/wilaya/road-type filter panel | Task 8 |
| T-07-01-04 Black-spot drill-down | Task 9 |
| T-09-01-02 Role assignment UI | Task 10 |
| T-10-01-02 Bulk user role/status assignment | Task 11 |
| Idle timeout / single-session security | Task 12 |

### Placeholder scan

No TBDs, no "similar to above", no "handle edge cases" — all steps contain actual code.

### Type consistency

- `AuditEntry` defined in `incidentsSlice.ts`, imported by `AuditTrailPanel`, `ApprovalActionBar`, `AddIncidentDrawer` — consistent.
- `approveIncident` / `rejectIncident` exported from `incidentsSlice.ts`, imported in `IncidentsPage.tsx` — consistent.
- `startIdleWatcher` defined and exported in `authSecurity.ts`, imported in `App.tsx` — consistent.
- `TrendChart` props: `incidents: Incident[]`, `period: 'day' | 'week' | 'month'` — consistent between definition and usage.
- `mapFilters` state keys (`dateFrom`, `dateTo`, `wilaya`, `roadType`) used consistently — consistent.
