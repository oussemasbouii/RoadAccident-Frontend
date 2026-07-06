# UX Redesign: Approval Workflow, Reports, Admin Accounts

## Goal

Redesign three feature areas — approval workflow, reports page, and admin accounts — to have clear interaction logic and a polished, user-friendly UI consistent with the rest of the MUI v7 dashboard.

## Scope

This spec covers targeted UX and visual improvements to existing components. No new pages or routes are added. All changes stay within the current file structure.

---

## 1. Approval Workflow

### 1.1 Incidents Table

- Pending rows get an amber left border (`borderLeft: '3px solid amber[600]'`) and a `Pending` `Chip` in the Status column replacing plain text.
- The Incidents tab label shows a count badge when pending items exist: e.g., `Incidents (3)`.
- The "Review" row action button is re-styled with amber color (`warning` palette) and a descriptive label.

### 1.2 Dashboard Alert Card

- A dismissible `Alert` card appears on the main dashboard (visible to admin/supervisor roles only).
- Text: `"N incidents pending your review"`.
- Contains a `Review Now` button that navigates to `/incidents` with `?filter=pending` (or equivalent Redux filter state).
- Dismissed state is stored in component state (not persisted — re-appears on next login).

### 1.3 Review Drawer Layout

The drawer is restructured into three clear zones:

**Top strip (sticky, `position: sticky; top: 0; zIndex: 1`)**
- Shows current approval status chip.
- `Approve` button (green, `success` palette) and `Reject` button (red outlined, `error` palette).
- If already actioned: shows `"Approved by [name] on [date]"` or equivalent — no action buttons.

**Body (scrollable)**
- Read-only summary cards (not disabled form fields):
  - Card 1: Location (wilaya + coordinates)
  - Card 2: Severity chip + Timestamp
  - Card 3: Description text
  - Card 4: Photos (if any)
- Clean `Card` components with `CardContent`, consistent padding.

**Bottom**
- `AuditTrailPanel` (existing component, unchanged).

### 1.4 Approve / Reject Interaction

- Single click on Approve or Reject reveals an inline confirmation strip beneath the action buttons (no full modal dialog).
- Strip contains: confirmation message + optional `TextField` for comment (placeholder: "Add a comment (optional)") + `Confirm` and `Cancel` buttons.
- On `Confirm`: dispatches `approveIncident` or `rejectIncident` thunk, shows success toast, closes confirmation strip, updates status chip.
- On failure: error toast, strip stays open.
- Comment is optional for both Approve and Reject.

---

## 2. Reports Page

### 2.1 Global Filter Bar

A `Paper` card sits above the tab bar containing four controls in a single row (wraps on mobile):

| Control | Component | Default |
|---|---|---|
| Date From | `DatePicker` | 30 days ago |
| Date To | `DatePicker` | today |
| Wilaya | `Select` | "All Wilayas" |
| Period | `ToggleButtonGroup` (Day/Week/Month) | Month |
| Reset | `Button` | — |

A single `filteredIncidents` memo applies all active filters and is passed to all tabs.

### 2.2 Overview Tab

- `TrendChart` receives `filteredIncidents` + the selected `period` from the global filter bar.
- Chart card has a proper title and a subtitle showing the active date range (e.g., `"May 3 – Jun 2, 2026"`).
- KPI summary cards (if present) reflect filtered data.

### 2.3 Maps Tab

- `IncidentHeatmapPanel` receives `filteredIncidents`.
- The duplicate filter UI that was added above the map is **removed entirely** — the global bar replaces it.
- The Pins / Heatmap toggle moves from inside the map component header into the global filter bar. It sits on a second row of the filter bar (below the date/wilaya/period controls), visible only when the Maps tab is active.

### 2.4 Cause Ranking Tab

- Ranking chart receives `filteredIncidents` so it responds to filters consistently with the other tabs.

---

## 3. Admin Accounts Page

### 3.1 Table Visual Improvements

- `size="small"` (dense) on `Table` for tighter row height.
- **User cell**: Avatar (initials circle) + name (bold) + email (secondary text, smaller font) in one cell.
- **Status cell**: colored `Chip` — `success` (Active), `error` (Blocked), `default` (Pending).
- **Role cell**: styled `Chip` — `primary` (Admin), `secondary` (Dispatch), `default` (Officer). Chip is clickable to enter edit mode.
- Alternating row background: `grey.50` on even rows.
- Sticky header (`stickyHeader` prop on `Table`).

### 3.2 Inline Role Editing

- Role cell shows the chip by default. On hover, an edit icon (`EditIcon`, 14px) appears inline.
- Clicking the chip (or icon) replaces it with an inline `Select` dropdown.
- On selection change: immediately calls the API, reverts visually if it fails.
- On success: row flashes a brief highlight animation, toast: `"Role updated to [role]"` with `Undo` action (5-second window). Undo re-calls the API with the previous role.
- `roleSaving` state per row prevents double-submission (existing state, keep it).

### 3.3 Bulk Action Toolbar

- Checkbox column (with select-all + indeterminate state) stays.
- When rows are selected, a toolbar slides in above the table using `Collapse` animation.
- Toolbar background: `alpha(theme.palette.primary.main, 0.08)`.
- Contents: `"{N} selected"` text + `Activate` button + `Block` button + `Deselect all` link.
- Buttons are disabled while `bulkActionLoading` is true.

---

## Architecture Notes

- All changes are within existing files — no new routes, no new pages.
- `ReportsPage.tsx`: filter state lifted to page level, passed down to all tab content.
- `IncidentsPage.tsx`: pending count derived from Redux state, passed to tab label.
- `AddIncidentDrawer.tsx`: review mode restructured (zones, not form fields).
- `AdminAccountsPage.tsx`: visual and interaction improvements in-place.
- `EnhancedKpiDashboard` (or equivalent dashboard entry): alert card added conditionally.

## Out of Scope

- New pages or routes
- Backend API changes
- Mobile / responsive redesign (minor wrapping is acceptable)
- Notification persistence across sessions
