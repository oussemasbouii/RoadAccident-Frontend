# UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign three feature areas — approval workflow, reports page, admin accounts — for clear interaction logic and polished MUI v7 UI.

**Architecture:** All changes are within existing files; no new routes or pages. Each task touches isolated files. Tasks 5 + 6 are coupled (IncidentHeatmapPanel prop + ReportsPage consumer) and should be done in order.

**Tech Stack:** React 18, TypeScript, MUI v7 (purple primary), Redux Toolkit, recharts, date-fns, Framer Motion, Vitest + RTL

**Spec:** `docs/superpowers/specs/2026-06-02-ux-redesign-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/features/incidents/components/ApprovalActionBar.tsx` | Replace Dialog with inline Collapse strip; make comment optional |
| `src/features/incidents/components/ApprovalActionBar.test.tsx` | Update tests to match new behavior |
| `src/features/incidents/components/AddIncidentDrawer.tsx` | Review mode: skip step form, show summary cards + sticky approval strip |
| `src/features/incidents/pages/IncidentsPage.tsx` | Amber border on pending rows, Pending chip, styled Review button, pending count badge |
| `src/features/dashboard/pages/DashboardPage.tsx` | Add dismissible pending-incidents alert for admins |
| `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx` | Accept optional `viewMode` + `onViewModeChange` props |
| `src/features/reports/pages/ReportsPage.tsx` | Global filter bar above tabs; unified filteredIncidents; Pins/Heatmap toggle in filter bar |
| `src/features/settings/pages/AdminAccountsPage.tsx` | Role chip → inline Select with toast; Collapse bulk toolbar; table density + alternating rows; fix duplicate filter field |

---

## Task 1: ApprovalActionBar — Inline confirmation strip

**Files:**
- Modify: `src/features/incidents/components/ApprovalActionBar.tsx`
- Modify: `src/features/incidents/components/ApprovalActionBar.test.tsx`

**Context:** The current component uses a MUI `Dialog` for confirmation and requires a mandatory comment. New design: single-click opens an inline `Collapse` strip beneath the buttons; comment is optional. The `onApprove`/`onReject` callbacks now receive an empty string when no comment is typed.

- [ ] **Step 1: Update the tests first**

Replace `src/features/incidents/components/ApprovalActionBar.test.tsx` with:

```tsx
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

  it('shows Approved chip when status is approved', () => {
    wrap(<ApprovalActionBar approvalStatus="approved" onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/approved/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull()
  })

  it('shows Rejected chip when status is rejected', () => {
    wrap(<ApprovalActionBar approvalStatus="rejected" onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/rejected/i)).toBeDefined()
  })

  it('shows confirmation strip when Approve is clicked', () => {
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={vi.fn()} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(screen.getByPlaceholderText(/optional/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDefined()
  })

  it('calls onApprove with empty string when no comment entered', () => {
    const onApprove = vi.fn()
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={onApprove} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onApprove).toHaveBeenCalledWith('')
  })

  it('calls onApprove with typed comment', () => {
    const onApprove = vi.fn()
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={onApprove} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    fireEvent.change(screen.getByPlaceholderText(/optional/i), { target: { value: 'Looks good' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onApprove).toHaveBeenCalledWith('Looks good')
  })

  it('calls onReject with typed comment', () => {
    const onReject = vi.fn()
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={vi.fn()} onReject={onReject} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    fireEvent.change(screen.getByPlaceholderText(/optional/i), { target: { value: 'Bad data' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onReject).toHaveBeenCalledWith('Bad data')
  })

  it('hides confirmation strip on Cancel without calling callbacks', () => {
    const onApprove = vi.fn()
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={onApprove} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/optional/i)).toBeNull()
    expect(onApprove).not.toHaveBeenCalled()
  })

  it('disables Approve and Reject when loading', () => {
    wrap(<ApprovalActionBar approvalStatus="pending" onApprove={vi.fn()} onReject={vi.fn()} loading={true} />)
    expect((screen.getByRole('button', { name: /approve/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /reject/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows Approve and Reject when status is undefined', () => {
    wrap(<ApprovalActionBar approvalStatus={undefined} onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```
npx vitest run src/features/incidents/components/ApprovalActionBar.test.tsx
```

Expected: several FAIL (dialog-based tests gone, new strip tests not passing yet).

- [ ] **Step 3: Rewrite ApprovalActionBar.tsx**

Replace the entire file content:

```tsx
import { useState } from 'react'
import {
  Box, Button, Chip, Collapse, Stack, TextField, Typography, alpha, useTheme,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import PendingRoundedIcon from '@mui/icons-material/PendingRounded'
import { useTranslation } from '../../../themeMode'

interface Props {
  approvalStatus: 'pending' | 'approved' | 'rejected' | undefined
  onApprove: (comment: string) => void
  onReject: (comment: string) => void
  loading?: boolean
}

export default function ApprovalActionBar({ approvalStatus, onApprove, onReject, loading }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')

  const handleAction = (action: 'approve' | 'reject') => {
    setComment('')
    setConfirming(action)
  }

  const handleConfirm = () => {
    if (confirming === 'approve') onApprove(comment.trim())
    else if (confirming === 'reject') onReject(comment.trim())
    setConfirming(null)
  }

  const handleCancel = () => {
    setConfirming(null)
    setComment('')
  }

  if (approvalStatus === 'approved') {
    return (
      <Chip
        icon={<CheckCircleRoundedIcon />}
        label={t('approval.approved')}
        sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main', fontWeight: 700 }}
      />
    )
  }

  if (approvalStatus === 'rejected') {
    return (
      <Chip
        icon={<CancelRoundedIcon />}
        label={t('approval.rejected')}
        sx={{ bgcolor: alpha(theme.palette.error.main, 0.12), color: 'error.main', fontWeight: 700 }}
      />
    )
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Chip
          icon={<PendingRoundedIcon />}
          label={t('approval.pending')}
          size="small"
          sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.dark', fontWeight: 600 }}
        />
        <Button
          variant="contained"
          color="success"
          size="small"
          disabled={loading || confirming !== null}
          onClick={() => handleAction('approve')}
          aria-label="approve"
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
        >
          Approve
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="small"
          disabled={loading || confirming !== null}
          onClick={() => handleAction('reject')}
          aria-label="reject"
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
        >
          Reject
        </Button>
      </Stack>

      <Collapse in={confirming !== null} unmountOnExit>
        <Box
          sx={{
            mt: 1.5,
            p: 2,
            borderRadius: 2,
            bgcolor: confirming === 'approve'
              ? alpha(theme.palette.success.main, 0.06)
              : alpha(theme.palette.error.main, 0.06),
            border: `1px solid ${confirming === 'approve'
              ? alpha(theme.palette.success.main, 0.2)
              : alpha(theme.palette.error.main, 0.2)}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
            {confirming === 'approve' ? 'Confirm approval?' : 'Confirm rejection?'}
          </Typography>
          <TextField
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Add a comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              size="small"
              onClick={handleCancel}
              aria-label="cancel"
              sx={{ textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              color={confirming === 'approve' ? 'success' : 'error'}
              onClick={handleConfirm}
              disabled={loading}
              aria-label="confirm"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Confirm
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}
```

- [ ] **Step 4: Run tests — expect all pass**

```
npx vitest run src/features/incidents/components/ApprovalActionBar.test.tsx
```

Expected: all 9 PASS.

---

## Task 2: AddIncidentDrawer — Review mode layout

**Files:**
- Modify: `src/features/incidents/components/AddIncidentDrawer.tsx`

**Context:** Currently review mode renders the full 3-step form (disabled) with `ApprovalActionBar` at the bottom. Replace with: simplified sticky header (no step tabs/progress), then inside the scrollable content — sticky `ApprovalActionBar` strip at top, four read-only summary cards, then `AuditTrailPanel`. Footer shows only Close.

The file is large (~1200 lines). Key change points:
1. `DialogTitle` block (lines ~484–637): when `isReviewMode`, skip step tabs + progress bar
2. `DialogContent` block (lines ~640–1034): when `isReviewMode`, skip AnimatePresence steps + render summary
3. Footer (lines ~1037–1161): when `isReviewMode`, hide Back/Continue/Submit, show only Close

- [ ] **Step 1: Add `ReviewLayout` helper just before the `export default` line**

Open `src/features/incidents/components/AddIncidentDrawer.tsx`. Find the line:
```
export default function AddIncidentDrawer({
```

Insert this helper component immediately before it (after the last const/import at file top level):

```tsx
function ReviewInfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="overline"
        sx={{ fontWeight: 800, fontSize: '0.65rem', letterSpacing: 1.2, color: 'text.secondary', display: 'block', mb: 1 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}
```

- [ ] **Step 2: Replace the DialogTitle content for review mode**

Find this block in `DialogTitle` (it starts with `{/* Step indicator pills`):

```tsx
        {/* Step indicator pills — clickable for completed steps */}
        <Stack direction="row" spacing={0} alignItems="center" sx={{ mb: 2 }}>
```

Wrap the entire pills + connector + LinearProgress section with a conditional:

```tsx
        {!isReviewMode && (
          <>
            {/* Step indicator pills — clickable for completed steps */}
            <Stack direction="row" spacing={0} alignItems="center" sx={{ mb: 2 }}>
              {/* ... keep all existing pill JSX unchanged ... */}
            </Stack>

            {/* Thin progress bar */}
            <LinearProgress
              {/* ... keep existing LinearProgress unchanged ... */}
            />
          </>
        )}
```

Specifically, wrap from the `{/* Step indicator pills */}` comment down through the closing `/>` of `<LinearProgress`, adding `{!isReviewMode && (<>` before and `</>)}` after.

- [ ] **Step 3: Replace DialogContent for review mode**

In `DialogContent`, the block starts with:
```tsx
      <DialogContent sx={{ pt: 2.5, px: { xs: 2, md: 3 }, pb: 2, overflowX: 'hidden' }}>
        {externalError && (
```

After the `{externalError && ...}` Alert, replace everything from `<AnimatePresence` down to (and including) the existing `{isReviewMode && (...)}` block with:

```tsx
        {isReviewMode ? (
          <Stack spacing={2}>
            {/* Sticky approval strip */}
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                bgcolor: 'background.paper',
                pt: 0.5,
                pb: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                mb: 1,
              }}
            >
              <ApprovalActionBar
                approvalStatus={initialData?.approvalStatus}
                onApprove={onApprove ?? (() => {})}
                onReject={onReject ?? (() => {})}
              />
            </Box>

            {/* Summary cards */}
            <ReviewInfoCard label="Location">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {[
                  initialData?.infoDetails?.governorate,
                  initialData?.infoDetails?.delegation,
                  initialData?.infoDetails?.municipality,
                ].filter(Boolean).join(', ') || initialData?.location || '—'}
              </Typography>
              {(initialData?.latitude && initialData?.longitude) && (
                <Typography variant="caption" color="text.secondary">
                  {Number(initialData.latitude).toFixed(4)}, {Number(initialData.longitude).toFixed(4)}
                </Typography>
              )}
            </ReviewInfoCard>

            <ReviewInfoCard label="Incident Details">
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  size="small"
                  label={(initialData?.severity || 'unknown').toUpperCase()}
                  sx={{
                    fontWeight: 700, fontSize: 10,
                    bgcolor: {
                      critical: 'rgba(211,47,47,0.12)',
                      high: 'rgba(245,124,0,0.12)',
                      medium: 'rgba(2,136,209,0.12)',
                      low: 'rgba(46,125,50,0.12)',
                    }[initialData?.severity as string] ?? 'action.selected',
                    color: {
                      critical: 'error.main',
                      high: 'warning.main',
                      medium: 'info.main',
                      low: 'success.main',
                    }[initialData?.severity as string] ?? 'text.secondary',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {initialData?.accidentDate || initialData?.time || ''}
                  {initialData?.infoDetails?.accidentTime ? ` · ${initialData.infoDetails.accidentTime}` : ''}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {initialData?.infoDetails?.dayTypeId && `Day type: ${initialData.infoDetails.dayTypeId.replace(/_/g, ' ').toLowerCase()}`}
              </Typography>
            </ReviewInfoCard>

            <ReviewInfoCard label="Summary">
              <Typography variant="body2">
                {initialData?.infoDetails?.summary || initialData?.description || '—'}
              </Typography>
            </ReviewInfoCard>

            <ReviewInfoCard label="Outcome">
              <Stack direction="row" spacing={3}>
                {[
                  { label: 'Fatal', value: initialData?.damagesReport?.deadCount ?? initialData?.fatalities ?? 0 },
                  { label: 'Hospitalized', value: initialData?.damagesReport?.hospitalizedInjuredCount ?? 0 },
                  { label: 'Light injuries', value: initialData?.damagesReport?.lightlyInjuredCount ?? 0 },
                ].map((item) => (
                  <Box key={item.label} sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>{item.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  </Box>
                ))}
              </Stack>
            </ReviewInfoCard>

            {/* Audit trail */}
            <Box>
              <Typography variant="overline" sx={{ fontWeight: 800, fontSize: '0.65rem', letterSpacing: 1.2, color: 'text.secondary' }}>
                Audit Trail
              </Typography>
              <AuditTrailPanel entries={(initialData?.auditLog ?? []) as AuditEntry[]} />
            </Box>
          </Stack>
        ) : (
          <AnimatePresence custom={stepDirection} mode="wait">
            {/* ... keep entire existing AnimatePresence + step forms + documents panel unchanged ... */}
          </AnimatePresence>
        )}
```

**Important:** The `AnimatePresence` block and everything inside it (steps 0, 1, 2 + documents panel) is NOT shown here — keep it exactly as-is, just nested inside the `else` branch of the ternary above.

Also remove the now-redundant `{isReviewMode && (...)}` block that was appended after the AnimatePresence (since it's now part of the ternary above).

- [ ] **Step 4: Hide Back/Continue/Submit footer in review mode**

In the sticky footer `Box`, find the outer `<Stack direction="row" justifyContent="space-between"...>`. Wrap its entire contents:

```tsx
        {!isReviewMode ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            {/* ... keep all existing Back + Cancel + Continue/Submit buttons unchanged ... */}
          </Stack>
        ) : (
          <Stack direction="row" justifyContent="flex-end">
            <Button
              onClick={handleClose}
              sx={{ borderRadius: 100, fontWeight: 600, textTransform: 'none', color: 'text.secondary' }}
            >
              Close
            </Button>
          </Stack>
        )}
```

- [ ] **Step 5: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors. Fix any type errors before continuing.

---

## Task 3: IncidentsPage — Pending row styling + count badge

**Files:**
- Modify: `src/features/incidents/pages/IncidentsPage.tsx`

**Context:** Need to: (a) derive pending count, (b) show it near the table header, (c) add amber left border to pending rows, (d) add a "Pending" chip in the status cell, (e) style the Review button with warning color.

- [ ] **Step 1: Add `pendingCount` derived value**

After the `displayedIncidents` memo (line ~116), add:

```tsx
const pendingCount = (incidents || []).filter((i: Incident) => i.approvalStatus === 'pending').length
```

- [ ] **Step 2: Add `RateReviewRoundedIcon` import**

Add to the icon imports block:

```tsx
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
```

Also add `Chip` and `Collapse` to the MUI imports if not already present.

- [ ] **Step 3: Add pending count badge to table card header**

Find the table card header block (around line 270):
```tsx
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('incidents.title')}</Typography>
```

After the `<Typography>` for the title, add:
```tsx
              {isAdmin && pendingCount > 0 && (
                <Chip
                  size="small"
                  label={`${pendingCount} pending review`}
                  color="warning"
                  sx={{ ml: 1.5, height: 20, fontSize: 10, fontWeight: 700 }}
                />
              )}
```

- [ ] **Step 4: Add amber left border to pending rows**

Find the `MotionTableRow` `sx` prop (around line 334):

```tsx
                    <MotionTableRow
                      key={incident.id}
                      variants={tableRow}
                      sx={{
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        transition: 'background-color 0.15s ease',
                      }}
```

Replace `sx` with:

```tsx
                      sx={{
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        transition: 'background-color 0.15s ease',
                        ...(incident.approvalStatus === 'pending' && {
                          borderLeft: `3px solid ${theme.palette.warning.main}`,
                          bgcolor: alpha(theme.palette.warning.main, 0.02),
                        }),
                      }}
```

- [ ] **Step 5: Add Pending chip in the status cell**

Find the status `<TableCell>` (around line 358):
```tsx
                      <TableCell>
                        <Badge
                          label={statusLabel[incident.status] ...}
```

Replace with:
```tsx
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          {incident.approvalStatus === 'pending' && (
                            <Chip
                              size="small"
                              label="Pending Review"
                              color="warning"
                              variant="outlined"
                              sx={{ height: 18, fontSize: 9, fontWeight: 700 }}
                            />
                          )}
                          <Badge
                            label={statusLabel[incident.status] ?? (incident.status.charAt(0).toUpperCase() + incident.status.slice(1))}
                            variant={statusColor[incident.status as 'active' | 'responded' | 'resolved']}
                            size="sm"
                          />
                        </Stack>
                      </TableCell>
```

- [ ] **Step 6: Style the Review button**

Find the Review Button (around line 384):
```tsx
                          {isAdmin && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={...}
```

Replace its `variant` and add `sx`:
```tsx
                          {isAdmin && incident.approvalStatus === 'pending' && (
                            <Button
                              variant="outlined"
                              size="sm"
                              icon={<RateReviewRoundedIcon sx={{ fontSize: 16 }} />}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleOpenReviewDrawer(incident.id)
                              }}
                              loading={drawerLoading && editingIncidentId === incident.id}
                              disabled={drawerLoading && editingIncidentId !== incident.id}
                              aria-label={`review incident ${incident.id}`}
                              sx={{ color: 'warning.main', borderColor: 'warning.main', '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.08) } }}
                            >
                              Review
                            </Button>
                          )}
```

Note: Review button is now only shown for `pending` incidents.

- [ ] **Step 7: TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 4: DashboardPage — Pending incidents alert

**Files:**
- Modify: `src/features/dashboard/pages/DashboardPage.tsx`

**Context:** Show a dismissible `Alert` at the top of the dashboard when the logged-in user is admin/supervisor and there are pending incidents. Only visible until dismissed (state reset on each login).

- [ ] **Step 1: Add required imports**

Add to existing MUI imports:
```tsx
Alert,
Collapse,
```

Add to icon imports:
```tsx
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
```

- [ ] **Step 2: Add state and derived values**

After the existing state declarations (around line 51), add:

```tsx
  const user = useAppSelector((state) => state.auth.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor'
  const [pendingAlertDismissed, setPendingAlertDismissed] = useState(false)
  const pendingCount = (incidents || []).filter((i: Incident) => (i as any).approvalStatus === 'pending').length
```

- [ ] **Step 3: Add the alert card in JSX**

Find the first `<Box` after the page's opening `<Stack` in the return (the header row with title + refresh button). After the header `Box`, insert:

```tsx
      <Collapse in={isAdmin && !pendingAlertDismissed && pendingCount > 0}>
        <Alert
          severity="warning"
          icon={<RateReviewRoundedIcon fontSize="inherit" />}
          action={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <MuiButton
                component={RouterLink}
                to="/incidents"
                color="warning"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Review Now
              </MuiButton>
              <IconButton
                color="inherit"
                size="small"
                onClick={() => setPendingAlertDismissed(true)}
                aria-label="dismiss"
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          }
          sx={{ borderRadius: 2, mb: 0 }}
        >
          <strong>{pendingCount}</strong> incident{pendingCount !== 1 ? 's' : ''} pending your review
        </Alert>
      </Collapse>
```

- [ ] **Step 4: TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 5: IncidentHeatmapPanel — Accept viewMode prop

**Files:**
- Modify: `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx`

**Context:** The component currently manages `viewMode` state internally with a ToggleButtonGroup in the map header. The ReportsPage (Task 6) needs to control this from outside via a prop. Make `viewMode` and `onViewModeChange` optional props; when provided, use them; when absent, fall back to internal state. Hide the internal toggle when controlled externally.

- [ ] **Step 1: Read the current file**

Open and read `src/features/dashboard/components/EnhancedKpiDashboard/IncidentHeatmapPanel.tsx` to locate:
- The `viewMode` state declaration
- The `ToggleButtonGroup` JSX in the map header
- The `useEffect` that toggles map layer visibility based on `viewMode`

- [ ] **Step 2: Update Props interface**

Find the Props interface (or add one if absent). The component currently has:
```tsx
interface Props { incidents: Incident[] }
// or similar
```

Update to:
```tsx
interface Props {
  incidents: Incident[]
  viewMode?: 'pins' | 'heatmap'
  onViewModeChange?: (mode: 'pins' | 'heatmap') => void
}
```

- [ ] **Step 3: Use prop when provided, internal state as fallback**

Find the internal `viewMode` state:
```tsx
const [viewMode, setViewMode] = useState<'pins' | 'heatmap'>('pins')
```

Replace with:
```tsx
const [internalViewMode, setInternalViewMode] = useState<'pins' | 'heatmap'>('pins')
const viewMode = props.viewMode ?? internalViewMode
const setViewMode = (mode: 'pins' | 'heatmap') => {
  setInternalViewMode(mode)
  props.onViewModeChange?.(mode)
}
```

Where `props` is the destructured prop (update the function signature to accept `viewMode` and `onViewModeChange`).

- [ ] **Step 4: Hide internal toggle when controlled externally**

Find the `ToggleButtonGroup` that renders the Pins/Heatmap toggle. Wrap it:

```tsx
{!props.viewMode && (
  <ToggleButtonGroup ...>
    {/* existing toggle */}
  </ToggleButtonGroup>
)}
```

This hides it when the parent is controlling `viewMode`.

- [ ] **Step 5: TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 6: ReportsPage — Global filter bar

**Files:**
- Modify: `src/features/reports/pages/ReportsPage.tsx`

**Context:** Replace separate `timeRange` + `mapFilters` states with a single `filters` state. Add a global filter bar above the tab bar. Pass unified `filteredIncidents` to all three tabs. Move Pins/Heatmap toggle into the filter bar (visible only on Geographic tab). Remove the per-tab filter card from the Geographic tab.

- [ ] **Step 1: Add date-fns imports**

At the top of the file, add:
```tsx
import { format, subDays } from 'date-fns'
```

- [ ] **Step 2: Replace state declarations**

Remove:
```tsx
const [timeRange, setTimeRange] = useState('month')
const [mapFilters, setMapFilters] = useState({
  dateFrom: '',
  dateTo: '',
  wilaya: 'all',
})
```

Add:
```tsx
const [filters, setFilters] = useState({
  dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  dateTo: format(new Date(), 'yyyy-MM-dd'),
  wilaya: 'all' as string,
  period: 'month' as 'day' | 'week' | 'month',
  viewMode: 'pins' as 'pins' | 'heatmap',
})
```

- [ ] **Step 3: Rewrite `filteredIncidents` memo**

Remove the old `cutoffDate` memo and the old `filteredIncidents` memo. Replace both with:

```tsx
const filteredIncidents = useMemo(() => {
  return incidents.filter((inc: any) => {
    const d = parseDate(inc.timestamp || inc.time)
    if (d) {
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom)
        if (d < from) return false
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo)
        to.setHours(23, 59, 59, 999)
        if (d > to) return false
      }
    }
    if (filters.wilaya !== 'all') {
      const gov = (inc as any).governorate || ''
      if (gov !== filters.wilaya) return false
    }
    return true
  })
}, [incidents, filters])
```

Also update `filteredAlerts` to use the same date range:
```tsx
const filteredAlerts = useMemo(() => {
  return alerts.filter((a: any) => {
    const d = parseDate((a as any).timestamp || a.time)
    if (d) {
      if (filters.dateFrom && d < new Date(filters.dateFrom)) return false
      if (filters.dateTo) {
        const to = new Date(filters.dateTo); to.setHours(23, 59, 59, 999)
        if (d > to) return false
      }
    }
    return true
  })
}, [alerts, filters])
```

- [ ] **Step 4: Update derived variables**

Replace:
```tsx
const trendPeriod: 'day' | 'week' | 'month' =
  timeRange === 'day' ? 'day' : timeRange === 'week' ? 'week' : 'month'
```

With:
```tsx
const trendPeriod = filters.period
```

Remove `availableWilayas` (derive inline in filter bar) and `mapFilteredIncidents` (now merged into `filteredIncidents`).

Add `availableWilayas` near the top of derived values:
```tsx
const availableWilayas = useMemo(() => {
  const s = new Set<string>()
  for (const inc of incidents) {
    const g = (inc as any).governorate || ''
    if (g) s.add(g)
  }
  return Array.from(s).sort()
}, [incidents])
```

Update `dailyTimeline` — it references `timeRange`; change it to use the period or remove it from the export. Simplest fix: replace `timeRange === 'day' ? 1 : 7` with `filters.period === 'day' ? 1 : 7`.

- [ ] **Step 5: Add global filter bar above the tab bar**

Find the tab bar `<Paper variant="outlined" sx={{ mb: 2.5 ...`:

Add these MUI imports if missing: `ToggleButton`, `ToggleButtonGroup`.

Insert the filter bar immediately before the tab bar `<Paper>`:

```tsx
      {/* ── Global filter bar ─────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 3,
          borderColor: alpha(theme.palette.divider, 0.6),
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 1.5,
            alignItems: 'end',
          }}
        >
          <TextField
            label="From"
            type="date"
            size="small"
            value={filters.dateFrom}
            onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={filters.dateTo}
            onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl size="small">
            <InputLabel>Wilaya</InputLabel>
            <Select
              value={filters.wilaya}
              label="Wilaya"
              onChange={(e) => setFilters((p) => ({ ...p, wilaya: e.target.value }))}
            >
              <MenuItem value="all">All Wilayas</MenuItem>
              {availableWilayas.map((w) => (
                <MenuItem key={w} value={w}>{w}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
              Period
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filters.period}
              onChange={(_, v) => v && setFilters((p) => ({ ...p, period: v }))}
            >
              <ToggleButton value="day" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Day</ToggleButton>
              <ToggleButton value="week" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Week</ToggleButton>
              <ToggleButton value="month" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Month</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Stack direction="row" spacing={1} alignItems="flex-end">
            {activeTab === 2 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                  View
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={filters.viewMode}
                  onChange={(_, v) => v && setFilters((p) => ({ ...p, viewMode: v }))}
                >
                  <ToggleButton value="pins" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Pins</ToggleButton>
                  <ToggleButton value="heatmap" sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}>Heatmap</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
            <Button
              size="small"
              variant="outlined"
              onClick={() => setFilters({
                dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                dateTo: format(new Date(), 'yyyy-MM-dd'),
                wilaya: 'all',
                period: 'month',
                viewMode: 'pins',
              })}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Reset
            </Button>
          </Stack>
        </Box>
      </Paper>
```

Also import `ToggleButton`, `ToggleButtonGroup` from MUI if not already imported.

- [ ] **Step 6: Remove the old TIME_PRESETS chips from header + per-tab filter card**

In the header `<Stack direction={rowDir}...>`, remove the `<Stack direction="row" spacing={0.5}>` that renders the TIME_PRESETS chips (the day/week/month/year filter chips).

In the Geographic tab (activeTab === 2), remove the entire:
```tsx
<Card sx={{ p: 2, mb: 2 }}>
  <Box sx={{ display: 'grid', ...}}>
    <TextField label="From Date" .../>
    <TextField label="To Date" .../>
    <FormControl ...>Wilaya</FormControl>
    <MuiButton>Clear Filters</MuiButton>
  </Box>
</Card>
```

- [ ] **Step 7: Pass `filteredIncidents` to CauseRanking + pass viewMode to heatmap**

In the Geographic tab, update:
```tsx
<IncidentHeatmapPanel
  incidents={filteredIncidents as Incident[]}
  viewMode={filters.viewMode}
  onViewModeChange={(v) => setFilters((p) => ({ ...p, viewMode: v }))}
/>
<CauseRanking incidents={filteredIncidents as Incident[]} />
```

- [ ] **Step 8: Update TrendChart subtitle**

In Overview tab, update the TrendChart card:
```tsx
<Card sx={{ p: 3, mt: 2.5 }}>
  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Incident Trend</Typography>
      <Typography variant="caption" color="text.secondary">
        {filters.dateFrom} – {filters.dateTo}
      </Typography>
    </Box>
  </Stack>
  <TrendChart incidents={filteredIncidents} period={trendPeriod} />
</Card>
```

- [ ] **Step 9: TypeScript check**

```
npx tsc --noEmit
```

Expected: 0 errors. Fix any remaining references to `timeRange`, `mapFilters`, `mapFilteredIncidents`, `cutoffDate`.

---

## Task 7: AdminAccountsPage — Table visual redesign

**Files:**
- Modify: `src/features/settings/pages/AdminAccountsPage.tsx`

**Context:** Current issues: (1) Role column shows a plain `<Select>` instead of a chip that transforms on click; (2) Bulk toolbar is conditionally rendered without animation; (3) A TextField labeled "Officer ID" incorrectly controls `roleFilter` (duplicate of the proper role Select); (4) No toast on role change; (5) No alternating row background. Fix all of these.

- [ ] **Step 1: Add Snackbar + Collapse + EditRounded imports**

Add to existing MUI imports:
```tsx
Collapse,
Snackbar,
```

Add to icon imports:
```tsx
import EditRoundedIcon from '@mui/icons-material/EditRounded'
```

- [ ] **Step 2: Add snackbar + role-editing state**

After the `roleSaving` state declaration, add:

```tsx
const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; undoFn?: () => void }>({ open: false, message: '' })
const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
```

- [ ] **Step 3: Fix the Officer ID / roleFilter bug in the filter bar**

In the filters card, find the second TextField (the one labeled `t('admin_accounts.officer_id')` that incorrectly binds to `roleFilter`):

```tsx
          <TextField
            label={t('admin_accounts.officer_id')}
            variant="outlined"
            size="small"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
```

Remove this TextField entirely (it's a duplicate of the Select below it and uses the wrong state).

- [ ] **Step 4: Wrap bulk toolbar in Collapse**

Find the bulk toolbar block:
```tsx
          {selectedIds.size > 0 && (
            <Box
              sx={{
                display: 'flex', ...
              }}
            >
```

Replace `{selectedIds.size > 0 && (` with:
```tsx
          <Collapse in={selectedIds.size > 0}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2, py: 1.25,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                mx: 2,
                mt: 1,
              }}
            >
```

And change the closing `)}` to `</Box></Collapse>`.

- [ ] **Step 5: Add `stickyHeader` and `size="small"` to Table**

Find:
```tsx
          <Table>
```

Replace with:
```tsx
          <Table stickyHeader size="small">
```

- [ ] **Step 6: Replace the Role column cell with chip → inline select**

Find the entire `<TableCell>` that renders the `<Select>` for role (around lines 666-692):

```tsx
                  <TableCell>
                    <Select
                      size="small"
                      value={o.role || 'officer'}
                      disabled={roleSaving[String(o._id || o.id || '')]}
                      onChange={async (e) => {
                        ...
                      }}
                      sx={{ fontSize: 12, minWidth: 110, borderRadius: '8px' }}
                    >
                      <MenuItem value="officer">Officer</MenuItem>
                      <MenuItem value="dispatch">Dispatch</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </TableCell>
```

Replace with:

```tsx
                  <TableCell>
                    {editingRoleId === safeId(o) ? (
                      <Select
                        size="small"
                        autoFocus
                        value={o.role || 'officer'}
                        disabled={roleSaving[safeId(o)]}
                        onBlur={() => setEditingRoleId(null)}
                        onChange={async (e) => {
                          const id = safeId(o)
                          const previousRole = o.role || 'officer'
                          const newRole = e.target.value as string
                          setEditingRoleId(null)
                          setRoleSaving((prev) => ({ ...prev, [id]: true }))
                          try {
                            await apiService.users.update(id, { role: newRole })
                            setOfficers((prev) =>
                              prev.map((u) => safeId(u) === id ? { ...u, role: newRole } : u)
                            )
                            setSnackbar({
                              open: true,
                              message: `Role updated to ${newRole}`,
                              undoFn: async () => {
                                try {
                                  await apiService.users.update(id, { role: previousRole })
                                  setOfficers((prev) =>
                                    prev.map((u) => safeId(u) === id ? { ...u, role: previousRole } : u)
                                  )
                                } catch { /* silent */ }
                              },
                            })
                          } catch {
                            setSnackbar({ open: true, message: 'Failed to update role' })
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
                    ) : (
                      <Chip
                        icon={<AdminPanelSettingsRoundedIcon sx={{ fontSize: 14 }} />}
                        label={o.role === 'admin' ? t('admin_accounts.role_admin') : o.role === 'dispatch' ? t('admin_accounts.role_dispatch') : t('admin_accounts.role_officer')}
                        size="small"
                        deleteIcon={<EditRoundedIcon sx={{ fontSize: 13 }} />}
                        onDelete={() => setEditingRoleId(safeId(o))}
                        onClick={() => setEditingRoleId(safeId(o))}
                        sx={{
                          bgcolor: roleStyle.bg,
                          color: roleStyle.color,
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                          '& .MuiChip-icon': { color: roleStyle.color },
                          '& .MuiChip-deleteIcon': { color: alpha(roleStyle.color, 0.6), '&:hover': { color: roleStyle.color } },
                        }}
                      />
                    )}
                  </TableCell>
```

- [ ] **Step 7: Add alternating row background**

In the `TableRow` for each officer, update the `sx`:

```tsx
                <TableRow
                  key={safeId(o)}
                  sx={{
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                    transition: 'background-color 0.15s ease',
                    '&:nth-of-type(even)': { bgcolor: alpha(theme.palette.action.hover, 0.02) },
                  }}
```

- [ ] **Step 8: Add Snackbar at end of JSX**

Before the closing `</Stack>` of the page return, add:

```tsx
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
              onClick={() => {
                snackbar.undoFn?.()
                setSnackbar((p) => ({ ...p, open: false }))
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Undo
            </Button>
          ) : undefined
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
```

- [ ] **Step 9: TypeScript check + run tests**

```
npx tsc --noEmit
```

Then run the full test suite:

```
npx vitest run
```

Expected: TypeScript 0 errors. Previously-passing tests still pass. Fix any regressions.

---

## Self-Review Checklist

- [x] **Spec coverage:** All 3 spec sections fully covered (approval workflow, reports, admin)
- [x] **No placeholders:** All steps show actual code
- [x] **Type consistency:** `viewMode: 'pins' | 'heatmap'` used consistently in Tasks 5+6; `filters.period` used consistently in Tasks 5+6
- [x] **Dependent ordering:** Task 5 (IncidentHeatmapPanel prop) must complete before Task 6 (ReportsPage consumer)
