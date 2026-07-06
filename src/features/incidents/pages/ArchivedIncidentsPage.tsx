import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
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
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import NotesRoundedIcon from '@mui/icons-material/NotesRounded'
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import FmdBadRoundedIcon from '@mui/icons-material/FmdBadRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import SickRoundedIcon from '@mui/icons-material/SickRounded'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useAppDispatch, useAppSelector } from '../../../store/store'
import { fetchArchivedIncidents, restoreIncident } from '../slices/incidentsSlice'
import { apiService } from '../../../services/api'
import Card from '../../../components/Common/Card'
import Button from '../../../components/Common/Button'
import { useTranslation } from '../../../themeMode'
import { getMapStyle } from '@/utils/mapStyle'

// ── Helpers ───────────────────────────────────────────────────────────────────

type SortField = 'location' | 'severity' | 'status' | 'archivedAt' | 'vehicles' | 'injuries'
type SortDir = 'asc' | 'desc'

const SEV_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

function sortItems(list: any[], field: SortField, dir: SortDir): any[] {
  return [...list].sort((a, b) => {
    let va: any, vb: any
    if (field === 'severity') { va = SEV_ORDER[a.severity] ?? 0; vb = SEV_ORDER[b.severity] ?? 0 }
    else if (field === 'archivedAt') { va = new Date(a.deletedAt ?? a.archivedAt ?? 0).getTime(); vb = new Date(b.deletedAt ?? b.archivedAt ?? 0).getTime() }
    else if (field === 'vehicles') { va = a.vehicles ?? 0; vb = b.vehicles ?? 0 }
    else if (field === 'injuries') { va = a.injuries ?? 0; vb = b.injuries ?? 0 }
    else { va = (a[field] ?? '').toString().toLowerCase(); vb = (b[field] ?? '').toString().toLowerCase() }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  })
}

function sevColor(sev: string): 'error' | 'warning' | 'info' | 'default' {
  if (sev === 'critical') return 'error'
  if (sev === 'high') return 'warning'
  if (sev === 'medium') return 'info'
  return 'default'
}

function statusColor(s: string): 'error' | 'warning' | 'success' | 'default' {
  if (s === 'active') return 'error'
  if (s === 'responded') return 'warning'
  if (s === 'resolved') return 'success'
  return 'default'
}

function sevAccentColor(sev: string, theme: any): string {
  if (sev === 'critical') return theme.palette.error.main
  if (sev === 'high') return theme.palette.warning.main
  if (sev === 'medium') return theme.palette.info.main
  return theme.palette.divider
}

function formatRelative(iso?: string): string {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d ago`
    return `${Math.floor(d / 30)}mo ago`
  } catch { return '—' }
}

function formatFull(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', year: 'numeric', month: 'short',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso ?? '—' }
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch { return iso ?? '—' }
}

function initials(name?: string): string {
  if (!name) return '?'
  return name.split(/[\s._-]+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function resolveUserName(raw: any, map: Map<string, string>): string {
  if (!raw) return '—'
  // API may return an embedded user object directly
  if (typeof raw === 'object') {
    const name = raw.displayName
      ?? (raw.firstName && raw.lastName ? `${raw.firstName} ${raw.lastName}` : null)
      ?? raw.name
      ?? raw.officerId
    return name ?? '—'
  }
  // raw is a string — try looking it up, fall back to the raw value
  return map.get(String(raw)) ?? String(raw)
}

// ── Canonical accident id ─────────────────────────────────────────────────────
// The archived API exposes several id-ish fields (and sometimes bare numeric DB
// ids). Restore/delete routes require the accident UUID, so prefer a uuid-shaped
// value across all candidates; fall back to the first present value otherwise.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function resolveAccidentId(inc: any): string {
  const candidates = [inc?.id, inc?._id, inc?.accidentId, inc?.accident_id, inc?.incidentId, inc?.uuid]
  const uuid = candidates.find((c) => c != null && UUID_RE.test(String(c).trim()))
  if (uuid != null) return String(uuid).trim()
  const firstPresent = candidates.find((c) => c != null && String(c).trim() !== '')
  return firstPresent != null ? String(firstPresent).trim() : ''
}

// ── Extract raw API fields (archived list is NOT toUiIncident-mapped) ─────────

function extractFromRaw(inc: any) {
  // Returns true when a value is a bare integer — indicates a raw DB ID, not a label
  const isRawId = (v: any) => v != null && /^\d+$/.test(String(v).trim())

  // ── ID ───────────────────────────────────────────────────────────────────
  const id = resolveAccidentId(inc)

  // ── GPS ──────────────────────────────────────────────────────────────────
  const rawLat = inc?.latitude ?? inc?.lat ?? inc?.location?.latitude
  const rawLng = inc?.longitude ?? inc?.lng ?? inc?.location?.longitude
  const latitude = Number.isFinite(Number(rawLat)) ? Number(rawLat) : undefined
  const longitude = Number.isFinite(Number(rawLng)) ? Number(rawLng) : undefined

  // ── Location string ───────────────────────────────────────────────────────
  const locationStr = typeof inc?.location === 'string' ? inc.location.trim() : ''
  const locationObj = typeof inc?.location === 'object' && inc?.location !== null ? inc.location : null
  const locationDesc = locationObj ? String(locationObj.description ?? '').trim() : ''
  const roadNameRaw = String(inc?.roadConditions?.roadName ?? '').trim()
  const govParts = [
    String(inc?.infoDetails?.sector ?? '').trim(),
    String(inc?.infoDetails?.municipality ?? '').trim(),
    String(inc?.infoDetails?.delegation ?? '').trim(),
    String(inc?.infoDetails?.governorate ?? '').trim(),
  ].filter(Boolean)
  const roadNameForLocation = (!isRawId(roadNameRaw) && roadNameRaw) ? roadNameRaw : ''
  const location = locationStr || locationDesc || roadNameForLocation || govParts.join(', ') || String(inc?.address ?? '').trim() || '—'

  // ── Sub-location breakdown ────────────────────────────────────────────────
  const governorate = String(inc?.governorate ?? inc?.infoDetails?.governorate ?? '').trim() || undefined
  const delegation  = String(inc?.infoDetails?.delegation  ?? '').trim() || undefined
  const municipality = String(inc?.infoDetails?.municipality ?? '').trim() || undefined
  const sector      = String(inc?.infoDetails?.sector      ?? '').trim() || undefined
  const roadName    = (roadNameRaw && !isRawId(roadNameRaw)) ? roadNameRaw : undefined

  // ── Accident date — prefer specific accident fields over generic timestamps ─
  let accidentDate: string | undefined
  let dateLabel = 'Date & Time'
  if (inc?.accidentDate) {
    const t = inc?.infoDetails?.accidentTime
    // accidentDate may already be a full ISO string like "2026-05-20T00:00:00.000Z"
    // — extract just the date part (before 'T') so we can safely append the actual time
    const rawDate = String(inc.accidentDate)
    const datePart = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate
    accidentDate = t ? `${datePart}T${t}` : rawDate
    dateLabel = 'Accident Date'
  } else if (inc?.timestamp) {
    accidentDate = String(inc.timestamp)
  } else if (inc?.time) {
    accidentDate = String(inc.time)
  } else if (inc?.createdAt) {
    accidentDate = String(inc.createdAt)
    dateLabel = 'Reported On'
  }

  // ── Narrative fields ──────────────────────────────────────────────────────
  const description = inc?.description || inc?.comment || inc?.infoDetails?.summary || inc?.damagesReport?.damageDescription || undefined
  // causeRaw and accidentTypeId are often integer IDs — only show if they look like human-readable text
  const causeRaw = inc?.cause ?? inc?.damagesReport?.accidentCauseId
  const cause = !isRawId(causeRaw) && causeRaw != null ? String(causeRaw) : undefined
  const accidentTypeRaw = inc?.damagesReport?.accidentTypeId
  const accidentType = !isRawId(accidentTypeRaw) && accidentTypeRaw != null ? String(accidentTypeRaw) : undefined

  // ── Counts ────────────────────────────────────────────────────────────────
  const dead        = Number(inc?.damagesReport?.deadCount ?? 0)
  const hospitalized = Number(inc?.damagesReport?.hospitalizedInjuredCount ?? 0)
  const lightly     = Number(inc?.damagesReport?.lightlyInjuredCount ?? 0)
  const vehicles    = Number(inc?.vehicles ?? inc?.vehicleCount ?? (Array.isArray(inc?.participants) ? inc.participants.length : 0))
  const injuries    = Number(inc?.injuries ?? inc?.injuryCount ?? (dead + hospitalized + lightly))

  // ── Archive metadata ──────────────────────────────────────────────────────
  const archivedAt = inc?.deletedAt ?? inc?.archivedAt
  const archivedBy = inc?.deletedBy ?? inc?.archivedBy
  const reason     = inc?.deletedReason ?? inc?.reason

  return {
    id, latitude, longitude, location,
    governorate, delegation, municipality, sector, roadName,
    accidentDate, dateLabel,
    description, cause, accidentType,
    dead, hospitalized, lightly, vehicles, injuries,
    archivedAt, archivedBy, reason,
  }
}

// ── Detail field row (icon + label + value) ────────────────────────────────────

function DetailField({ icon, iconBg, iconColor, label, value, mono = false }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; mono?: boolean
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{
        width: 36, height: 36, borderRadius: 2, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: iconBg, color: iconColor,
      }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
        <Typography variant="caption" fontWeight={700} sx={{ color: 'text.disabled', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, display: 'block', mb: 0.4 }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  )
}

// ── Read-only map with a single pin ──────────────────────────────────────────

function ReadOnlyPinMap({ latitude, longitude, severity }: { latitude: number; longitude: number; severity: string }) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!containerRef.current || mapRef.current) return
      let m: maplibregl.Map
      try {
        m = new maplibregl.Map({
          container: containerRef.current,
          style: getMapStyle(),
          center: [longitude, latitude],
          zoom: 14,
          attributionControl: false,
          pitchWithRotate: false,
        })
      } catch { return }

      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

      const pinColors: Record<string, string> = {
        critical: '#f44336',
        high: '#ff9800',
        medium: '#2196f3',
        low: '#4caf50',
      }
      const pinColor = pinColors[severity] ?? '#f44336'

      m.on('load', () => {
        const el = document.createElement('div')
        el.style.cssText = 'width:40px;height:52px;cursor:pointer;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.35));'
        el.innerHTML = `<svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 0C8.954 0 0 8.954 0 20C0 34.667 20 52 20 52C20 52 40 34.667 40 20C40 8.954 31.046 0 20 0Z" fill="${pinColor}"/>
          <circle cx="20" cy="20" r="12" fill="rgba(255,255,255,0.95)"/>
          <circle cx="20" cy="20" r="6" fill="${pinColor}"/>
          <circle cx="20" cy="20" r="2.5" fill="white"/>
        </svg>`
        new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([longitude, latitude])
          .addTo(m)
      })

      m.on('error', () => {})
      mapRef.current = m
    }, 350)

    return () => {
      clearTimeout(timer)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [latitude, longitude, severity])

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%', height: 230, flexShrink: 0,
        bgcolor: alpha(theme.palette.text.primary, 0.04),
        '& .maplibregl-ctrl-top-right': { top: 8, right: 8 },
        '& .maplibregl-ctrl-group': { boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: 1.5 },
        '& .maplibregl-ctrl-group button': { width: 30, height: 30 },
      }}
    />
  )
}

// ── Stat mini-card ────────────────────────────────────────────────────────────

function StatMini({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const theme = useTheme()
  return (
    <Box sx={{
      flex: '1 1 110px', px: 2, py: 1.5, borderRadius: 2.5,
      border: `1px solid ${alpha(color, 0.2)}`,
      bgcolor: alpha(color, 0.06),
      display: 'flex', alignItems: 'center', gap: 1.25,
    }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: alpha(color, 0.15), color,
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" fontWeight={800} lineHeight={1} sx={{ color }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton width="70%" height={16} sx={{ mb: 0.5 }} />
            <Skeleton width="40%" height={12} />
          </TableCell>
          <TableCell><Skeleton variant="rounded" width={64} height={22} sx={{ borderRadius: 99 }} /></TableCell>
          <TableCell><Skeleton variant="rounded" width={72} height={22} sx={{ borderRadius: 99 }} /></TableCell>
          <TableCell><Skeleton width={40} /></TableCell>
          <TableCell><Skeleton width={40} /></TableCell>
          <TableCell><Skeleton width={70} /></TableCell>
          <TableCell>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton width={50} />
            </Stack>
          </TableCell>
          <TableCell align="right"><Skeleton variant="rounded" width={80} height={30} sx={{ borderRadius: 2 }} /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ── Incident detail panel (proper component, not an IIFE) ────────────────────

interface IncidentDetailPanelProps {
  incident: any
  usersMap: Map<string, string>
  restoringId: string | null
  onClose: () => void
  onRestore: (id: string) => void
  tRestore: string
  tRestoring: string
}

function IncidentDetailPanel({ incident, usersMap, restoringId, onClose, onRestore, tRestore, tRestoring }: IncidentDetailPanelProps) {
  const theme = useTheme()
  const sev = incident.severity ?? ''
  const accent = sevAccentColor(sev, theme)
  const f = extractFromRaw(incident)
  const archivedByName = resolveUserName(f.archivedBy, usersMap)
  const hasGps = f.latitude !== undefined && f.longitude !== undefined
  const isRestoring = restoringId === f.id

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{
        flexShrink: 0,
        position: 'relative',
        pl: 2.5, pr: 2, pt: 2, pb: 2,
        background: `linear-gradient(135deg, ${alpha(accent, 0.12)} 0%, ${alpha(accent, 0.03)} 100%)`,
        borderBottom: `1px solid ${alpha(accent, 0.25)}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 4,
          bgcolor: accent,
          borderRadius: '0 2px 2px 0',
        },
      }}>
        {/* Close */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.25 }}>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Chips */}
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mb: 1.25 }}>
          <Chip size="small" label={sev || '—'} color={sevColor(sev)}
            sx={{ fontWeight: 700, fontSize: 11, height: 22, textTransform: 'capitalize', borderRadius: 1.5 }} />
          <Chip size="small" label={incident.status ?? '—'} color={statusColor(incident.status ?? '')}
            variant="outlined" sx={{ fontWeight: 600, fontSize: 11, height: 22, textTransform: 'capitalize', borderRadius: 1.5 }} />
        </Stack>

        {/* Location */}
        <Typography variant="h6" fontWeight={800} lineHeight={1.3} sx={{ mb: 0.5, wordBreak: 'break-word' }}>
          {f.location}
        </Typography>

        {/* ID */}
        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: 10, display: 'block', mb: 2 }}>
          {f.id || '—'}
        </Typography>

        {/* Stat pills */}
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {[
            { icon: <DirectionsCarRoundedIcon sx={{ fontSize: 13 }} />, val: f.vehicles, label: 'Vehicles', color: theme.palette.primary.main, show: true },
            { icon: <LocalHospitalRoundedIcon sx={{ fontSize: 13 }} />, val: f.injuries, label: 'Injuries', color: f.injuries > 0 ? theme.palette.error.main : theme.palette.text.disabled, show: true },
            { icon: <SickRoundedIcon sx={{ fontSize: 13 }} />, val: f.dead, label: 'Fatal', color: theme.palette.error.dark, show: f.dead > 0 },
          ].filter(p => p.show).map(({ icon, val, label, color }) => (
            <Box key={label} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75,
              px: 1.25, py: 0.75, borderRadius: 2,
              bgcolor: alpha(color, 0.1),
              border: `1px solid ${alpha(color, 0.2)}`,
            }}>
              <Box sx={{ color, display: 'flex' }}>{icon}</Box>
              <Typography variant="caption" fontWeight={800} sx={{ color, lineHeight: 1 }}>{val}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1 }}>{label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* ── Map ──────────────────────────────────────────────────── */}
      {hasGps && (
        <Box sx={{ flexShrink: 0, position: 'relative' }}>
          <ReadOnlyPinMap
            key={`map-${f.id}`}
            latitude={f.latitude!}
            longitude={f.longitude!}
            severity={sev}
          />
          {/* GPS badge overlay */}
          <Box sx={{
            position: 'absolute', bottom: 8, left: 8,
            px: 1, py: 0.4, borderRadius: 1.5,
            bgcolor: alpha(theme.palette.background.paper, 0.88),
            backdropFilter: 'blur(4px)',
            border: `1px solid ${theme.palette.divider}`,
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
            <FmdBadRoundedIcon sx={{ fontSize: 11, color: accent }} />
            <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace', color: 'text.secondary' }}>
              {f.latitude!.toFixed(5)}, {f.longitude!.toFixed(5)}
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Scrollable body ──────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2.5 }}>

        {/* ACCIDENT DETAILS */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, mb: 2,
          '&::after': { content: '""', flex: 1, height: '1px', bgcolor: theme.palette.divider },
        }}>
          <Typography variant="caption" fontWeight={800} color="text.disabled"
            sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 1, whiteSpace: 'nowrap' }}>
            Accident Details
          </Typography>
        </Box>

        <Stack spacing={2} sx={{ mb: 3.5 }}>
          {f.accidentDate && (
            <DetailField
              icon={<CalendarMonthRoundedIcon sx={{ fontSize: 16 }} />}
              iconBg={alpha(theme.palette.info.main, 0.12)}
              iconColor={theme.palette.info.main}
              label={f.dateLabel}
              value={formatDate(f.accidentDate)}
            />
          )}

          {f.governorate && (
            <DetailField
              icon={<PublicRoundedIcon sx={{ fontSize: 16 }} />}
              iconBg={alpha(theme.palette.success.main, 0.12)}
              iconColor={theme.palette.success.main}
              label="Location"
              value={[f.municipality, f.delegation, f.governorate].filter(Boolean).join(' › ')}
            />
          )}

          {f.roadName && (
            <DetailField
              icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
              iconBg={alpha(theme.palette.warning.main, 0.12)}
              iconColor={theme.palette.warning.main}
              label="Road / Address"
              value={f.roadName}
            />
          )}

          {f.cause && (
            <DetailField
              icon={<ReportProblemRoundedIcon sx={{ fontSize: 16 }} />}
              iconBg={alpha(theme.palette.error.main, 0.1)}
              iconColor={theme.palette.error.main}
              label="Cause"
              value={String(f.cause)}
            />
          )}

          {f.description && (
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{
                width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: alpha(theme.palette.text.primary, 0.06),
              }}>
                <NotesRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                <Typography variant="caption" fontWeight={700} color="text.disabled"
                  sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                  Description
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {f.description}
                </Typography>
              </Box>
            </Stack>
          )}

          {!f.accidentDate && !f.governorate && !f.cause && !f.description && !f.roadName && (
            <Box sx={{
              py: 2, px: 1.5, borderRadius: 2.5, textAlign: 'center',
              bgcolor: alpha(theme.palette.text.primary, 0.03),
              border: `1px dashed ${alpha(theme.palette.text.primary, 0.12)}`,
            }}>
              <Typography variant="caption" color="text.disabled" fontStyle="italic" sx={{ display: 'block', mb: 0.5 }}>
                Full accident details are not available for this archived record.
              </Typography>
              {hasGps && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                  GPS coordinates are shown on the map above.
                </Typography>
              )}
            </Box>
          )}
        </Stack>

        {/* ARCHIVE DETAILS */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, mb: 2,
          '&::after': { content: '""', flex: 1, height: '1px', bgcolor: theme.palette.divider },
        }}>
          <Typography variant="caption" fontWeight={800} color="text.disabled"
            sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 1, whiteSpace: 'nowrap' }}>
            Archive Details
          </Typography>
        </Box>

        <Stack spacing={2}>
          {/* Archived on */}
          <DetailField
            icon={<InventoryRoundedIcon sx={{ fontSize: 16 }} />}
            iconBg={alpha(theme.palette.warning.main, 0.12)}
            iconColor={theme.palette.warning.main}
            label="Archived On"
            value={`${formatFull(f.archivedAt)} · ${formatRelative(f.archivedAt)}`}
          />

          {/* Archived by */}
          {archivedByName && archivedByName !== '—' && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{
                width: 36, height: 36, fontSize: 13, fontWeight: 800, flexShrink: 0,
                bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main',
              }}>
                {initials(archivedByName)}
              </Avatar>
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.disabled"
                  sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                  Archived By
                </Typography>
                <Typography variant="body2" fontWeight={700}>{archivedByName}</Typography>
              </Box>
            </Stack>
          )}

          {/* Reason */}
          {f.reason && (
            <Box sx={{
              p: 1.75, borderRadius: 2.5,
              bgcolor: alpha(theme.palette.warning.main, 0.06),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
              borderLeft: `3px solid ${theme.palette.warning.main}`,
            }}>
              <Typography variant="caption" fontWeight={700} color="text.disabled"
                sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                Archive Reason
              </Typography>
              <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ lineHeight: 1.65 }}>
                "{f.reason}"
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <Box sx={{
        flexShrink: 0,
        px: 2.5, py: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        display: 'flex', gap: 1.5,
      }}>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Box sx={{ flex: 1 }}>
          <Button
            variant="primary"
            size="sm"
            icon={<RestoreRoundedIcon sx={{ fontSize: 15 }} />}
            onClick={() => onRestore(f.id)}
            loading={isRestoring}
            disabled={restoringId !== null}
          >
            {isRestoring ? tRestoring : tRestore}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArchivedIncidentsPage() {
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const { t } = useTranslation()

  const { archivedList, archivedTotal, archivedLoading, archivedError, restoringId } =
    useAppSelector((state) => state.incidents)

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('archivedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map())

  const load = () => dispatch(fetchArchivedIncidents({ page: 1, limit: 100 }))

  useEffect(() => { load() }, [dispatch])

  // Fetch users once to resolve deletedBy IDs → display names
  useEffect(() => {
    apiService.users.list({ limit: 100 }).then((resp) => {
      const raw = resp.data?.data ?? resp.data?.items ?? resp.data?.rows ?? resp.data?.users ?? resp.data
      if (!Array.isArray(raw)) return
      const map = new Map<string, string>()
      raw.forEach((u: any) => {
        const id = u.id ?? u._id
        const name = u.displayName
          ?? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : null)
          ?? u.name
          ?? u.officerId
          ?? id
        if (id) map.set(String(id), name)
        if (u.officerId && String(u.officerId) !== String(id)) map.set(String(u.officerId), name)
      })
      setUsersMap(map)
    }).catch(() => {})
  }, [])

  useEffect(() => { setPage(0) }, [search, severityFilter, statusFilter, sortField, sortDir])

  // ── Derived stats ────────────────────────────────────────────────────────
  const criticalCount = useMemo(() => archivedList.filter((a: any) => a.severity === 'critical').length, [archivedList])
  const highCount = useMemo(() => archivedList.filter((a: any) => a.severity === 'high').length, [archivedList])
  const dupCount = useMemo(() => archivedList.filter((a: any) =>
    (a.deletedReason ?? a.reason ?? '').toLowerCase().includes('duplicate')).length, [archivedList])
  // Raw API data has nested fields — extract properly
  const totalVehicles = useMemo(() =>
    archivedList.reduce((s: number, a: any) =>
      s + Number(a.vehicles ?? a.vehicleCount ?? a.participants?.length ?? 0), 0),
  [archivedList])

  const totalInjuries = useMemo(() =>
    archivedList.reduce((s: number, a: any) => {
      const direct = Number(a.injuries ?? a.injuryCount ?? 0)
      if (direct > 0) return s + direct
      const h = Number(a.damagesReport?.hospitalizedInjuredCount ?? 0)
      const l = Number(a.damagesReport?.lightlyInjuredCount ?? 0)
      const d = Number(a.damagesReport?.deadCount ?? 0)
      return s + h + l + d
    }, 0),
  [archivedList])

  const totalFatalities = useMemo(() =>
    archivedList.reduce((s: number, a: any) => s + Number(a.damagesReport?.deadCount ?? 0), 0),
  [archivedList])

  const thisMonthCount = useMemo(() => {
    const now = new Date()
    return archivedList.filter((a: any) => {
      const d = new Date(a.deletedAt ?? a.archivedAt ?? 0)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
  }, [archivedList])

  // ── Filter + sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = archivedList.filter((a: any) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (q) {
        const loc = (a.location || a.address || '').toLowerCase()
        const reason = (a.deletedReason || a.reason || '').toLowerCase()
        const desc = (a.description || '').toLowerCase()
        if (!loc.includes(q) && !reason.includes(q) && !desc.includes(q) && !String(a.id).toLowerCase().includes(q)) return false
      }
      return true
    })
    return sortItems(list, sortField, sortDir)
  }, [archivedList, search, severityFilter, statusFilter, sortField, sortDir])

  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sortProps = (field: SortField) => ({
    active: sortField === field,
    direction: sortField === field ? sortDir : 'asc' as const,
    onClick: () => handleSort(field),
  })

  const handleRestore = async () => {
    if (!confirmId) return
    const id = confirmId
    setConfirmId(null)
    const result = await dispatch(restoreIncident({ id }))
    if (restoreIncident.fulfilled.match(result)) {
      setSnackbar({ open: true, message: t('archived_incidents.restore_success'), severity: 'success' })
      load()
    } else {
      setSnackbar({ open: true, message: t('archived_incidents.restore_error'), severity: 'error' })
    }
  }

  const confirmingIncident = archivedList.find((a: any) => resolveAccidentId(a) === confirmId)

  const headCell = (label: string, field?: SortField, align?: 'right') => (
    <TableCell align={align} sx={{ fontWeight: 700, fontSize: 11, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', py: 1.25 }}>
      {field ? <TableSortLabel {...sortProps(field)}>{label}</TableSortLabel> : label}
    </TableCell>
  )

  return (
    <Stack spacing={3} sx={{ p: 3 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 3, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.main',
          }}>
            <InventoryRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>
                {t('archived_incidents.title')}
              </Typography>
              {archivedTotal > 0 && (
                <Chip label={archivedTotal} size="small" sx={{ fontWeight: 800, height: 22, fontSize: 12, bgcolor: alpha(theme.palette.warning.main, 0.15), color: 'warning.dark' }} />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t('archived_incidents.subtitle')}
            </Typography>
          </Box>
        </Stack>
        <Button variant="secondary" size="sm" icon={<RefreshRoundedIcon sx={{ fontSize: 15 }} />} onClick={load} loading={archivedLoading}>
          Refresh
        </Button>
      </Stack>

      {/* ── Stat mini-cards ─────────────────────────────────────────────────── */}
      {archivedList.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <StatMini label="Total archived" value={archivedTotal || archivedList.length} icon={<InventoryRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.text.secondary} />
          <StatMini label="Critical" value={criticalCount} icon={<FmdBadRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.error.main} />
          <StatMini label="High severity" value={highCount} icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.warning.main} />
          <StatMini label="Duplicates" value={dupCount} icon={<NotesRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.info.main} />
          <StatMini label="Vehicles" value={totalVehicles} icon={<DirectionsCarRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.success.main} />
          <StatMini label="Injuries" value={totalInjuries} icon={<LocalHospitalRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.secondary.main} />
          {totalFatalities > 0 && (
            <StatMini label="Fatalities" value={totalFatalities} icon={<SickRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.error.dark} />
          )}
          <StatMini label="This month" value={thisMonthCount} icon={<CalendarMonthRoundedIcon sx={{ fontSize: 16 }} />} color={theme.palette.primary.main} />
        </Stack>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {archivedError && <Alert severity="error" sx={{ borderRadius: 2 }}>{archivedError}</Alert>}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search location, reason, description, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 260px', minWidth: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 145 }}>
          <InputLabel>Severity</InputLabel>
          <Select value={severityFilter} label="Severity" onChange={(e) => setSeverityFilter(e.target.value)}>
            <MenuItem value="all">All severities</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="responded">Responded</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* ── Table card ──────────────────────────────────────────────────────── */}
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 900 }}>

            {/* Sticky head */}
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
                {headCell('Accident / Location', 'location')}
                {headCell('Severity', 'severity')}
                {headCell('Status', 'status')}
                {headCell('Vehicles', 'vehicles', 'right')}
                {headCell('Injuries', 'injuries', 'right')}
                {headCell('Archived', 'archivedAt')}
                {headCell('Archived by')}
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.25 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {archivedLoading && archivedList.length === 0 ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Stack alignItems="center" justifyContent="center" py={7} spacing={1.5}>
                      <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: alpha(theme.palette.text.disabled, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <InventoryRoundedIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                      </Box>
                      <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                        {search || severityFilter !== 'all' || statusFilter !== 'all'
                          ? 'No results match your filters'
                          : t('archived_incidents.empty')}
                      </Typography>
                      {(search || severityFilter !== 'all' || statusFilter !== 'all') && (
                        <Typography variant="caption" color="text.disabled">
                          Clear the search or filters to see all records
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((incident: any) => {
                  const sev = incident.severity ?? ''
                  const loc = incident.location || incident.address || '—'
                  const archivedAt = incident.deletedAt ?? incident.archivedAt
                  const archivedBy = resolveUserName(incident.deletedBy ?? incident.archivedBy, usersMap)
                  const reason = incident.deletedReason ?? incident.reason
                  const accent = sevAccentColor(sev, theme)
                  const incidentId = resolveAccidentId(incident)
                  const isSelected = !!incidentId && resolveAccidentId(selectedIncident) === incidentId

                  return (
                    <TableRow
                      key={incidentId}
                      hover
                      selected={isSelected}
                      sx={{
                        cursor: 'pointer',
                        borderLeft: `3px solid ${accent}`,
                        '&.Mui-selected': { bgcolor: alpha(accent, 0.04) },
                        '&.Mui-selected:hover': { bgcolor: alpha(accent, 0.07) },
                      }}
                      onClick={() => setSelectedIncident(incident)}
                    >
                      {/* Location + ID + reason snippet */}
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Tooltip title={loc} placement="top-start" arrow>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {loc}
                          </Typography>
                        </Tooltip>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                            #{String(incidentId).slice(0, 8)}…
                          </Typography>
                          {reason && (
                            <Tooltip title={reason} arrow>
                              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ cursor: 'default', color: 'text.disabled' }}>
                                <NotesRoundedIcon sx={{ fontSize: 11 }} />
                                <Typography variant="caption" noWrap sx={{ maxWidth: 120, fontSize: 10 }}>
                                  {reason}
                                </Typography>
                              </Stack>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>

                      {/* Severity */}
                      <TableCell>
                        <Chip size="small" label={sev || '—'} color={sevColor(sev)}
                          sx={{ fontWeight: 700, fontSize: 11, height: 22, textTransform: 'capitalize' }} />
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Chip size="small" label={incident.status ?? '—'} color={statusColor(incident.status ?? '')}
                          variant="outlined" sx={{ fontWeight: 600, fontSize: 11, height: 22, textTransform: 'capitalize' }} />
                      </TableCell>

                      {/* Vehicles */}
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                          <DirectionsCarRoundedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                          <Typography variant="body2" fontWeight={600} color={incident.vehicles > 0 ? 'text.primary' : 'text.disabled'}>
                            {incident.vehicles ?? 0}
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Injuries */}
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                          <LocalHospitalRoundedIcon sx={{ fontSize: 13, color: incident.injuries > 0 ? 'error.main' : 'text.disabled' }} />
                          <Typography variant="body2" fontWeight={600} color={incident.injuries > 0 ? 'error.main' : 'text.disabled'}>
                            {incident.injuries ?? 0}
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Archived at */}
                      <TableCell>
                        <Tooltip title={formatFull(archivedAt)} arrow>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ cursor: 'default' }}>
                            <AccessTimeRoundedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                              {formatRelative(archivedAt)}
                            </Typography>
                          </Stack>
                        </Tooltip>
                      </TableCell>

                      {/* Archived by */}
                      <TableCell>
                        {archivedBy ? (
                          <Tooltip title={archivedBy} arrow>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ cursor: 'default' }}>
                              <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main' }}>
                                {initials(archivedBy)}
                              </Avatar>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 80 }}>
                                {archivedBy}
                              </Typography>
                            </Stack>
                          </Tooltip>
                        ) : (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <PersonRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          </Stack>
                        )}
                      </TableCell>

                      {/* Restore */}
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RestoreRoundedIcon sx={{ fontSize: 14 }} />}
                          onClick={() => setConfirmId(incidentId)}
                          loading={restoringId === incidentId}
                          disabled={restoringId !== null && restoringId !== incidentId}
                        >
                          {restoringId === incidentId ? t('archived_incidents.restoring') : t('archived_incidents.restore')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Pagination */}
        {filtered.length > 0 && (
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
            rowsPerPageOptions={[10, 20, 50]}
            sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
          />
        )}
      </Card>

      {/* ── Accident detail drawer ──────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 500 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            mt: { xs: '56px', sm: '64px', md: '72px' },
            height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)', md: 'calc(100% - 72px)' },
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          },
        }}
        ModalProps={{ keepMounted: false }}
      >
        {selectedIncident && (
          <IncidentDetailPanel
            key={selectedIncident.id ?? selectedIncident._id}
            incident={selectedIncident}
            usersMap={usersMap}
            restoringId={restoringId}
            onClose={() => setSelectedIncident(null)}
            onRestore={(id) => { setConfirmId(id); setSelectedIncident(null) }}
            tRestore={t('archived_incidents.restore')}
            tRestoring={t('archived_incidents.restoring')}
          />
        )}
      </Drawer>

      {/* ── Restore confirmation dialog ──────────────────────────────────────── */}
      <Dialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {t('archived_incidents.confirm_restore_title')}
        </DialogTitle>
        <DialogContent>
          {confirmingIncident && (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {t('archived_incidents.confirm_restore_body')}
              </Typography>
              <Box sx={{
                p: 2, borderRadius: 2.5,
                border: `1.5px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                bgcolor: alpha(theme.palette.warning.main, 0.05),
              }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={confirmingIncident.severity ?? '—'} color={sevColor(confirmingIncident.severity ?? '')} sx={{ fontWeight: 700, fontSize: 11, height: 20 }} />
                    <Chip size="small" label={confirmingIncident.status ?? '—'} color={statusColor(confirmingIncident.status ?? '')} variant="outlined" sx={{ fontWeight: 600, fontSize: 11, height: 20 }} />
                  </Stack>
                  <Typography variant="body2" fontWeight={700}>
                    {confirmingIncident.location || confirmingIncident.address || '—'}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1.5}>
                    {(confirmingIncident.vehicles ?? 0) > 0 && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <DirectionsCarRoundedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">{confirmingIncident.vehicles} vehicles</Typography>
                      </Stack>
                    )}
                    {(confirmingIncident.injuries ?? 0) > 0 && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <LocalHospitalRoundedIcon sx={{ fontSize: 12, color: 'error.main' }} />
                        <Typography variant="caption" color="error.main" fontWeight={600}>{confirmingIncident.injuries} injuries</Typography>
                      </Stack>
                    )}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <AccessTimeRoundedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        Archived {formatRelative(confirmingIncident.deletedAt ?? confirmingIncident.archivedAt)}
                      </Typography>
                    </Stack>
                  </Stack>
                  {(confirmingIncident.deletedReason || confirmingIncident.reason) && (
                    <Stack direction="row" spacing={0.5} alignItems="flex-start">
                      <NotesRoundedIcon sx={{ fontSize: 12, color: 'text.disabled', mt: 0.2 }} />
                      <Typography variant="caption" color="text.secondary" fontStyle="italic">
                        "{confirmingIncident.deletedReason ?? confirmingIncident.reason}"
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" icon={<RestoreRoundedIcon sx={{ fontSize: 15 }} />} onClick={handleRestore}>
            {t('archived_incidents.restore')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Feedback snackbar ────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ borderRadius: 3 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  )
}
