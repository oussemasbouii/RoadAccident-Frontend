import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType } from 'docx'
import JSZip from 'jszip'

type RowData = Record<string, any>

type ReportBriefing = {
  generatedAt?: string
  timeRange?: string
  summary?: {
    totalIncidents?: number
    resolutionRate?: number
    openIncidents?: number
    criticalOpen?: number
    unreadAlerts?: number
    alertPressure?: number
  }
  incidentsBySeverity?: Record<string, number>
  alertsBySeverity?: Record<string, number>
  incidentsByStatus?: Record<string, number>
  alertsByType?: Record<string, number>
  sevenDayActivity?: { day: string; incidents: number; alerts: number }[]
  hotspots?: { location: string; count: number; relatedAlerts?: number; share?: number }[]
  priorityIncidents?: { id?: string; location?: string; severity?: string; injuries?: number; status?: string; time?: string }[]
}

type AlertBriefing = {
  generatedAt: string
  total: number
  received: number
  sent: number
  unread: number
  acknowledgedRate: number
  bySeverity: Record<string, number>
  byType: Record<string, number>
  byDirection: Record<string, number>
  alerts: Array<Record<string, any>>
}

type IncidentBriefing = {
  generatedAt: string
  total: number
  active: number
  responded: number
  resolved: number
  totalVehicles: number
  totalInjuries: number
  bySeverity: Record<string, number>
  byStatus: Record<string, number>
  hotspots: Array<{ location: string; count: number }>
  incidents: Array<Record<string, any>>
}

function formatHeader(header: string): string {
  return String(header)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatCellValue(value: any): string | number {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function prepareRows(rows: RowData[]) {
  const headers = Array.from(
    rows.reduce((set: Set<string>, row: RowData) => {
      Object.keys(row || {}).forEach((k) => set.add(k))
      return set
    }, new Set<string>())
  )

  const headerLabels = headers.map(formatHeader)
  const values = rows.map((row) => headers.map((key) => formatCellValue(row?.[key])))
  return { headers, headerLabels, values }
}

function getReportBriefing(data: any[]): ReportBriefing | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const candidate = data[0]
  if (!candidate || typeof candidate !== 'object') return null
  if (!candidate.summary && !candidate.incidentsBySeverity && !candidate.alertsBySeverity) return null
  return candidate as ReportBriefing
}

function safeNumber(value: any): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function titleize(value: string): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDateTime(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function pct(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function setWorksheetColumnWidths(ws: XLSX.WorkSheet) {
  if (!ws['!ref']) return
  const range = XLSX.utils.decode_range(ws['!ref'])
  const widths: number[] = []
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    let max = 10
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && cell.v !== undefined && cell.v !== null) {
        max = Math.max(max, String(cell.v).length)
      }
    }
    widths.push(Math.min(Math.max(max + 2, 12), 44))
  }
  ws['!cols'] = widths.map((wch) => ({ wch }))
}

function buildAlertBriefing(data: any[]): AlertBriefing {
  const alerts = Array.isArray(data) ? data : []
  const received = alerts.filter((a: any) => a.direction !== 'sent')
  const sent = alerts.filter((a: any) => a.direction === 'sent')
  const unread = received.filter((a: any) => !a.read).length

  const bySeverity = alerts.reduce((acc: Record<string, number>, alert: any) => {
    const key = String(alert.severity || 'medium').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byType = alerts.reduce((acc: Record<string, number>, alert: any) => {
    const key = String(alert.type || 'system').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byDirection = alerts.reduce((acc: Record<string, number>, alert: any) => {
    const key = String(alert.direction || 'received').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const acknowledgedRate = sent.length === 0
    ? 0
    : Math.round(
      sent.reduce((sum: number, alert: any) => {
        const total = Number(alert.recipientCount || 0)
        const ack = Number(alert.acknowledgedCount || 0)
        return sum + (total > 0 ? ack / total : 0)
      }, 0) / sent.length * 100
    )

  return {
    generatedAt: new Date().toISOString(),
    total: alerts.length,
    received: received.length,
    sent: sent.length,
    unread,
    acknowledgedRate,
    bySeverity,
    byType,
    byDirection,
    alerts,
  }
}

function buildIncidentBriefing(data: any[]): IncidentBriefing {
  const incidents = Array.isArray(data) ? data : []
  const bySeverity = incidents.reduce((acc: Record<string, number>, incident: any) => {
    const key = String(incident.severity || 'medium').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const byStatus = incidents.reduce((acc: Record<string, number>, incident: any) => {
    const key = String(incident.status || 'active').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const hotspotMap = incidents.reduce((acc: Record<string, number>, incident: any) => {
    const location = String(incident.location || 'Unknown location').trim() || 'Unknown location'
    const key = location.toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const hotspots = Object.entries(hotspotMap)
    .map(([key, count]) => ({
      location: key.replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const totalVehicles = incidents.reduce((sum: number, i: any) => sum + safeNumber(i.vehicles), 0)
  const totalInjuries = incidents.reduce((sum: number, i: any) => sum + safeNumber(i.injuries), 0)

  return {
    generatedAt: new Date().toISOString(),
    total: incidents.length,
    active: byStatus.active || 0,
    responded: byStatus.responded || 0,
    resolved: byStatus.resolved || 0,
    totalVehicles,
    totalInjuries,
    bySeverity,
    byStatus,
    hotspots,
    incidents,
  }
}

function createReportTable(title: string, columns: string[], rows: (string | number)[][]) {
  return [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 26 })], spacing: { before: 200, after: 120 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: columns.map((col) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: col, bold: true })] })],
            })
          ),
        }),
        ...rows.map(
          (row) =>
            new TableRow({
              children: row.map((cell) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun(String(cell ?? '-'))] })],
                })
              ),
            })
        ),
      ],
    }),
  ]
}

function buildReportBriefingElement(report: ReportBriefing, title = 'Officer Briefing') {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.background = '#f8fafc'
  container.style.padding = '32px'
  container.style.width = '1200px'
  container.style.fontFamily = 'Arial, sans-serif'
  container.style.color = '#0f172a'

  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.justifyContent = 'space-between'
  header.style.alignItems = 'flex-start'
  header.style.marginBottom = '24px'

  const headerLeft = document.createElement('div')
  const titleEl = document.createElement('h2')
  titleEl.textContent = title
  titleEl.style.margin = '0 0 6px 0'
  titleEl.style.fontSize = '26px'
  headerLeft.appendChild(titleEl)

  const subtitle = document.createElement('div')
  subtitle.textContent = 'Operational report summary'
  subtitle.style.color = '#64748b'
  subtitle.style.fontSize = '13px'
  headerLeft.appendChild(subtitle)

  const meta = document.createElement('div')
  meta.style.textAlign = 'right'
  meta.style.fontSize = '12px'
  meta.style.color = '#64748b'
  meta.innerHTML = `<div>Generated: ${formatDateTime(report.generatedAt)}</div><div>Range: ${titleize(report.timeRange || 'month')}</div>`

  header.appendChild(headerLeft)
  header.appendChild(meta)
  container.appendChild(header)

  const summaryWrap = document.createElement('div')
  summaryWrap.style.display = 'grid'
  summaryWrap.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'
  summaryWrap.style.gap = '12px'
  summaryWrap.style.marginBottom = '24px'

  const summaryItems = [
    { label: 'Total incidents', value: safeNumber(report.summary?.totalIncidents) },
    { label: 'Open incidents', value: safeNumber(report.summary?.openIncidents) },
    { label: 'Resolution rate', value: `${safeNumber(report.summary?.resolutionRate)}%` },
    { label: 'Critical open', value: safeNumber(report.summary?.criticalOpen) },
    { label: 'Unread alerts', value: safeNumber(report.summary?.unreadAlerts) },
    { label: 'Alert pressure', value: `${safeNumber(report.summary?.alertPressure)}%` },
  ]

  summaryItems.forEach((item) => {
    const card = document.createElement('div')
    card.style.background = '#ffffff'
    card.style.border = '1px solid #e2e8f0'
    card.style.borderRadius = '14px'
    card.style.padding = '14px 16px'
    card.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.06)'

    const label = document.createElement('div')
    label.textContent = item.label
    label.style.fontSize = '12px'
    label.style.color = '#64748b'
    label.style.marginBottom = '6px'

    const value = document.createElement('div')
    value.textContent = String(item.value)
    value.style.fontSize = '20px'
    value.style.fontWeight = '700'
    value.style.color = '#0f172a'

    card.appendChild(label)
    card.appendChild(value)
    summaryWrap.appendChild(card)
  })

  container.appendChild(summaryWrap)

  const sectionsWrap = document.createElement('div')
  sectionsWrap.style.display = 'grid'
  sectionsWrap.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
  sectionsWrap.style.gap = '16px'

  const buildTableCard = (titleText: string, columns: string[], rows: (string | number)[][]) => {
    const card = document.createElement('div')
    card.style.background = '#ffffff'
    card.style.border = '1px solid #e2e8f0'
    card.style.borderRadius = '16px'
    card.style.padding = '14px 16px'
    card.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.06)'

    const heading = document.createElement('div')
    heading.textContent = titleText
    heading.style.fontSize = '14px'
    heading.style.fontWeight = '700'
    heading.style.marginBottom = '10px'
    card.appendChild(heading)

    if (rows.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = 'No data available.'
      empty.style.fontSize = '12px'
      empty.style.color = '#64748b'
      card.appendChild(empty)
      return card
    }

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontSize = '12px'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    columns.forEach((col) => {
      const th = document.createElement('th')
      th.textContent = col
      th.style.textAlign = 'left'
      th.style.padding = '6px 4px'
      th.style.color = '#475569'
      th.style.borderBottom = '1px solid #e2e8f0'
      headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr')
      tr.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      row.forEach((cell) => {
        const td = document.createElement('td')
        td.textContent = String(cell ?? '-')
        td.style.padding = '6px 4px'
        td.style.color = '#0f172a'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    card.appendChild(table)
    return card
  }

  const incidentsTotal = Object.values(report.incidentsBySeverity || {}).reduce((sum, val) => sum + safeNumber(val), 0)
  const alertsTotal = Object.values(report.alertsBySeverity || {}).reduce((sum, val) => sum + safeNumber(val), 0)

  sectionsWrap.appendChild(buildTableCard(
    'Incident severity mix',
    ['Severity', 'Count', 'Share'],
    Object.entries(report.incidentsBySeverity || {}).map(([key, value]) => ([
      titleize(key),
      safeNumber(value),
      `${pct(safeNumber(value), incidentsTotal)}%`,
    ]))
  ))

  sectionsWrap.appendChild(buildTableCard(
    'Alert severity mix',
    ['Severity', 'Count', 'Share'],
    Object.entries(report.alertsBySeverity || {}).map(([key, value]) => ([
      titleize(key),
      safeNumber(value),
      `${pct(safeNumber(value), alertsTotal)}%`,
    ]))
  ))

  sectionsWrap.appendChild(buildTableCard(
    'Incident status flow',
    ['Status', 'Count'],
    Object.entries(report.incidentsByStatus || {}).map(([key, value]) => ([titleize(key), safeNumber(value)]))
  ))

  sectionsWrap.appendChild(buildTableCard(
    'Alert type mix',
    ['Type', 'Count'],
    Object.entries(report.alertsByType || {}).map(([key, value]) => ([titleize(key), safeNumber(value)]))
  ))

  container.appendChild(sectionsWrap)

  const fullWidth = document.createElement('div')
  fullWidth.style.marginTop = '18px'
  fullWidth.style.display = 'grid'
  fullWidth.style.gridTemplateColumns = '1fr'
  fullWidth.style.gap = '14px'

  fullWidth.appendChild(buildTableCard(
    '7-day incident vs alert activity',
    ['Day', 'Incidents', 'Alerts'],
    (report.sevenDayActivity || []).map((row) => ([row.day, safeNumber(row.incidents), safeNumber(row.alerts)]))
  ))

  fullWidth.appendChild(buildTableCard(
    'Hotspots',
    ['Location', 'Incidents', 'Related alerts', 'Share'],
    (report.hotspots || []).map((row) => ([
      row.location || '-',
      safeNumber(row.count),
      safeNumber(row.relatedAlerts),
      `${safeNumber(row.share)}%`,
    ]))
  ))

  fullWidth.appendChild(buildTableCard(
    'Priority incidents',
    ['Location', 'Severity', 'Injuries', 'Status', 'Time'],
    (report.priorityIncidents || []).map((row) => ([
      row.location || '-',
      titleize(row.severity || 'unknown'),
      safeNumber(row.injuries),
      titleize(row.status || 'unknown'),
      row.time || '-',
    ]))
  ))

  container.appendChild(fullWidth)
  return container
}

function buildAlertsBriefingElement(briefing: AlertBriefing, title = 'Alert Operations') {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.background = '#f8fafc'
  container.style.padding = '32px'
  container.style.width = '1200px'
  container.style.fontFamily = 'Arial, sans-serif'
  container.style.color = '#0f172a'

  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.justifyContent = 'space-between'
  header.style.alignItems = 'flex-start'
  header.style.marginBottom = '24px'

  const headerLeft = document.createElement('div')
  const titleEl = document.createElement('h2')
  titleEl.textContent = title
  titleEl.style.margin = '0 0 6px 0'
  titleEl.style.fontSize = '26px'
  headerLeft.appendChild(titleEl)

  const subtitle = document.createElement('div')
  subtitle.textContent = 'Alert delivery, acknowledgement, and severity overview'
  subtitle.style.color = '#64748b'
  subtitle.style.fontSize = '13px'
  headerLeft.appendChild(subtitle)

  const meta = document.createElement('div')
  meta.style.textAlign = 'right'
  meta.style.fontSize = '12px'
  meta.style.color = '#64748b'
  meta.innerHTML = `<div>Generated: ${formatDateTime(briefing.generatedAt)}</div>`

  header.appendChild(headerLeft)
  header.appendChild(meta)
  container.appendChild(header)

  const summaryWrap = document.createElement('div')
  summaryWrap.style.display = 'grid'
  summaryWrap.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'
  summaryWrap.style.gap = '12px'
  summaryWrap.style.marginBottom = '24px'

  const summaryItems = [
    { label: 'Total alerts', value: briefing.total },
    { label: 'Received', value: briefing.received },
    { label: 'Sent', value: briefing.sent },
    { label: 'Unread received', value: briefing.unread },
    { label: 'Acknowledged rate', value: `${briefing.acknowledgedRate}%` },
    { label: 'Severity classes', value: Object.keys(briefing.bySeverity).length },
  ]

  summaryItems.forEach((item) => {
    const card = document.createElement('div')
    card.style.background = '#ffffff'
    card.style.border = '1px solid #e2e8f0'
    card.style.borderRadius = '14px'
    card.style.padding = '14px 16px'
    card.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.06)'

    const label = document.createElement('div')
    label.textContent = item.label
    label.style.fontSize = '12px'
    label.style.color = '#64748b'
    label.style.marginBottom = '6px'

    const value = document.createElement('div')
    value.textContent = String(item.value)
    value.style.fontSize = '20px'
    value.style.fontWeight = '700'
    value.style.color = '#0f172a'

    card.appendChild(label)
    card.appendChild(value)
    summaryWrap.appendChild(card)
  })

  container.appendChild(summaryWrap)

  const sectionsWrap = document.createElement('div')
  sectionsWrap.style.display = 'grid'
  sectionsWrap.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
  sectionsWrap.style.gap = '16px'

  const buildTableCard = (titleText: string, columns: string[], rows: (string | number)[][]) => {
    const card = document.createElement('div')
    card.style.background = '#ffffff'
    card.style.border = '1px solid #e2e8f0'
    card.style.borderRadius = '16px'
    card.style.padding = '14px 16px'
    card.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.06)'

    const heading = document.createElement('div')
    heading.textContent = titleText
    heading.style.fontSize = '14px'
    heading.style.fontWeight = '700'
    heading.style.marginBottom = '10px'
    card.appendChild(heading)

    if (rows.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = 'No data available.'
      empty.style.fontSize = '12px'
      empty.style.color = '#64748b'
      card.appendChild(empty)
      return card
    }

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontSize = '12px'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    columns.forEach((col) => {
      const th = document.createElement('th')
      th.textContent = col
      th.style.textAlign = 'left'
      th.style.padding = '6px 4px'
      th.style.color = '#475569'
      th.style.borderBottom = '1px solid #e2e8f0'
      headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr')
      tr.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      row.forEach((cell) => {
        const td = document.createElement('td')
        td.textContent = String(cell ?? '-')
        td.style.padding = '6px 4px'
        td.style.color = '#0f172a'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    card.appendChild(table)
    return card
  }

  sectionsWrap.appendChild(buildTableCard(
    'Severity mix',
    ['Severity', 'Count'],
    Object.entries(briefing.bySeverity).map(([k, v]) => ([titleize(k), safeNumber(v)]))
  ))

  sectionsWrap.appendChild(buildTableCard(
    'Alert types',
    ['Type', 'Count'],
    Object.entries(briefing.byType).map(([k, v]) => ([titleize(k), safeNumber(v)]))
  ))

  sectionsWrap.appendChild(buildTableCard(
    'Direction',
    ['Direction', 'Count'],
    Object.entries(briefing.byDirection).map(([k, v]) => ([titleize(k), safeNumber(v)]))
  ))

  const recentAlerts = briefing.alerts.slice(0, 10).map((alert: any) => ([
    alert.time || '-',
    titleize(alert.direction || 'received'),
    titleize(alert.severity || 'medium'),
    (alert.comment || alert.description || '').slice(0, 80),
  ]))
  sectionsWrap.appendChild(buildTableCard(
    'Recent alerts',
    ['Time', 'Direction', 'Severity', 'Comment'],
    recentAlerts
  ))

  container.appendChild(sectionsWrap)
  return container
}

function buildIncidentsBriefingElement(briefing: IncidentBriefing, title = 'Incident Operations') {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.background = '#f8fafc'
  container.style.padding = '32px'
  container.style.width = '1200px'
  container.style.fontFamily = 'Arial, sans-serif'
  container.style.color = '#0f172a'

  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.justifyContent = 'space-between'
  header.style.alignItems = 'flex-start'
  header.style.marginBottom = '24px'

  const headerLeft = document.createElement('div')
  const titleEl = document.createElement('h2')
  titleEl.textContent = title
  titleEl.style.margin = '0 0 6px 0'
  titleEl.style.fontSize = '26px'
  headerLeft.appendChild(titleEl)

  const subtitle = document.createElement('div')
  subtitle.textContent = 'Incident volume, severity, and operational status'
  subtitle.style.color = '#64748b'
  subtitle.style.fontSize = '13px'
  headerLeft.appendChild(subtitle)

  const meta = document.createElement('div')
  meta.style.textAlign = 'right'
  meta.style.fontSize = '12px'
  meta.style.color = '#64748b'
  meta.innerHTML = `<div>Generated: ${formatDateTime(briefing.generatedAt)}</div>`

  header.appendChild(headerLeft)
  header.appendChild(meta)
  container.appendChild(header)

  const summaryWrap = document.createElement('div')
  summaryWrap.style.display = 'grid'
  summaryWrap.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'
  summaryWrap.style.gap = '12px'
  summaryWrap.style.marginBottom = '24px'

  const summaryItems = [
    { label: 'Total incidents', value: briefing.total },
    { label: 'Active', value: briefing.active },
    { label: 'Responded', value: briefing.responded },
    { label: 'Resolved', value: briefing.resolved },
    { label: 'Total vehicles', value: briefing.totalVehicles },
    { label: 'Total injuries', value: briefing.totalInjuries },
  ]

  summaryItems.forEach((item) => {
    const card = document.createElement('div')
    card.style.background = '#ffffff'
    card.style.border = '1px solid #e2e8f0'
    card.style.borderRadius = '14px'
    card.style.padding = '14px 16px'
    card.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.06)'

    const label = document.createElement('div')
    label.textContent = item.label
    label.style.fontSize = '12px'
    label.style.color = '#64748b'
    label.style.marginBottom = '6px'

    const value = document.createElement('div')
    value.textContent = String(item.value)
    value.style.fontSize = '20px'
    value.style.fontWeight = '700'
    value.style.color = '#0f172a'

    card.appendChild(label)
    card.appendChild(value)
    summaryWrap.appendChild(card)
  })

  container.appendChild(summaryWrap)

  const sectionsWrap = document.createElement('div')
  sectionsWrap.style.display = 'grid'
  sectionsWrap.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
  sectionsWrap.style.gap = '16px'

  const buildTableCard = (titleText: string, columns: string[], rows: (string | number)[][]) => {
    const card = document.createElement('div')
    card.style.background = '#ffffff'
    card.style.border = '1px solid #e2e8f0'
    card.style.borderRadius = '16px'
    card.style.padding = '14px 16px'
    card.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.06)'

    const heading = document.createElement('div')
    heading.textContent = titleText
    heading.style.fontSize = '14px'
    heading.style.fontWeight = '700'
    heading.style.marginBottom = '10px'
    card.appendChild(heading)

    if (rows.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = 'No data available.'
      empty.style.fontSize = '12px'
      empty.style.color = '#64748b'
      card.appendChild(empty)
      return card
    }

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontSize = '12px'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    columns.forEach((col) => {
      const th = document.createElement('th')
      th.textContent = col
      th.style.textAlign = 'left'
      th.style.padding = '6px 4px'
      th.style.color = '#475569'
      th.style.borderBottom = '1px solid #e2e8f0'
      headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr')
      tr.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      row.forEach((cell) => {
        const td = document.createElement('td')
        td.textContent = String(cell ?? '-')
        td.style.padding = '6px 4px'
        td.style.color = '#0f172a'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    card.appendChild(table)
    return card
  }

  sectionsWrap.appendChild(buildTableCard(
    'Severity mix',
    ['Severity', 'Count'],
    Object.entries(briefing.bySeverity).map(([k, v]) => ([titleize(k), safeNumber(v)]))
  ))

  sectionsWrap.appendChild(buildTableCard(
    'Status',
    ['Status', 'Count'],
    Object.entries(briefing.byStatus).map(([k, v]) => ([titleize(k), safeNumber(v)]))
  ))

  sectionsWrap.appendChild(buildTableCard(
    'Hotspots',
    ['Location', 'Count'],
    briefing.hotspots.slice(0, 8).map((row) => ([row.location, row.count]))
  ))

  const recentIncidents = briefing.incidents.slice(0, 10).map((incident: any) => ([
    incident.time || '-',
    incident.location || '-',
    titleize(incident.severity || 'medium'),
    titleize(incident.status || 'active'),
  ]))
  sectionsWrap.appendChild(buildTableCard(
    'Recent incidents',
    ['Time', 'Location', 'Severity', 'Status'],
    recentIncidents
  ))

  container.appendChild(sectionsWrap)
  return container
}

// Helper: convert array of objects to CSV string
export function toCSV(rows: any[], delimiter = ','): string {
  if (!rows || rows.length === 0) return ''
  const { headers, headerLabels } = prepareRows(rows)
  const escape = (val: any) => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes('"') || str.includes('\n') || str.includes(delimiter)) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }
  const headerLine = headerLabels.map(escape).join(delimiter)
  const lines = rows.map((row) => headers.map((h) => escape(formatCellValue(row[h]))).join(delimiter))
  return [headerLine, ...lines].join('\n')
}

// Download helper
function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// CSV export
export function exportCSV(rows: any[], filename = 'export.csv') {
  const csv = toCSV(rows)
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;')
}

export function exportReportCSV(data: any[], filename = 'report.csv') {
  const report = getReportBriefing(data)
  if (!report) {
    exportCSV(data, filename)
    return
  }

  const lines: Array<[string, string, string | number]> = []
  lines.push(['Meta', 'Generated', formatDateTime(report.generatedAt)])
  lines.push(['Meta', 'Range', titleize(report.timeRange || 'month')])

  lines.push(['Summary', 'Total incidents', safeNumber(report.summary?.totalIncidents)])
  lines.push(['Summary', 'Open incidents', safeNumber(report.summary?.openIncidents)])
  lines.push(['Summary', 'Resolution rate', `${safeNumber(report.summary?.resolutionRate)}%`])
  lines.push(['Summary', 'Critical open', safeNumber(report.summary?.criticalOpen)])
  lines.push(['Summary', 'Unread alerts', safeNumber(report.summary?.unreadAlerts)])
  lines.push(['Summary', 'Alert pressure', `${safeNumber(report.summary?.alertPressure)}%`])

  Object.entries(report.incidentsBySeverity || {}).forEach(([key, value]) => {
    lines.push(['Incidents by severity', titleize(key), safeNumber(value)])
  })
  Object.entries(report.alertsBySeverity || {}).forEach(([key, value]) => {
    lines.push(['Alerts by severity', titleize(key), safeNumber(value)])
  })
  Object.entries(report.incidentsByStatus || {}).forEach(([key, value]) => {
    lines.push(['Incidents by status', titleize(key), safeNumber(value)])
  })
  Object.entries(report.alertsByType || {}).forEach(([key, value]) => {
    lines.push(['Alerts by type', titleize(key), safeNumber(value)])
  })

  ;(report.sevenDayActivity || []).forEach((row) => {
    lines.push(['7-day activity', row.day, `Incidents: ${safeNumber(row.incidents)} | Alerts: ${safeNumber(row.alerts)}`])
  })
  ;(report.hotspots || []).forEach((row) => {
    lines.push(['Hotspots', row.location || '-', `Incidents: ${safeNumber(row.count)} | Alerts: ${safeNumber(row.relatedAlerts)} | Share: ${safeNumber(row.share)}%`])
  })
  ;(report.priorityIncidents || []).forEach((row) => {
    lines.push(['Priority incidents', row.location || '-', `Severity: ${titleize(row.severity || 'unknown')} | Injuries: ${safeNumber(row.injuries)} | Status: ${titleize(row.status || 'unknown')}`])
  })

  const csvRows = lines.map(([section, metric, value]) => ({ section, metric, value }))
  exportCSV(csvRows, filename)
}

export function exportAlertsCSV(data: any[], filename = 'alerts.csv') {
  const briefing = buildAlertBriefing(data)
  const rows: any[] = []

  rows.push({ section: 'Summary', metric: 'Generated', value: formatDateTime(briefing.generatedAt) })
  rows.push({ section: 'Summary', metric: 'Total alerts', value: briefing.total })
  rows.push({ section: 'Summary', metric: 'Received', value: briefing.received })
  rows.push({ section: 'Summary', metric: 'Sent', value: briefing.sent })
  rows.push({ section: 'Summary', metric: 'Unread received', value: briefing.unread })
  rows.push({ section: 'Summary', metric: 'Acknowledged rate', value: `${briefing.acknowledgedRate}%` })

  Object.entries(briefing.bySeverity).forEach(([key, value]) => {
    rows.push({ section: 'Severity', metric: titleize(key), value })
  })
  Object.entries(briefing.byType).forEach(([key, value]) => {
    rows.push({ section: 'Type', metric: titleize(key), value })
  })
  Object.entries(briefing.byDirection).forEach(([key, value]) => {
    rows.push({ section: 'Direction', metric: titleize(key), value })
  })

  briefing.alerts.forEach((alert) => {
    rows.push({
      section: 'Alert',
      id: alert.id,
      direction: alert.direction,
      severity: alert.severity,
      type: alert.type,
      time: alert.time,
      senderId: alert.senderId || '',
      comment: alert.comment || alert.description || '',
      latitude: Number.isFinite(alert.latitude) ? alert.latitude : '',
      longitude: Number.isFinite(alert.longitude) ? alert.longitude : '',
      read: Boolean(alert.read),
      acknowledgedCount: alert.acknowledgedCount ?? '',
      recipientCount: alert.recipientCount ?? '',
    })
  })

  exportCSV(rows, filename)
}

export function exportIncidentsCSV(data: any[], filename = 'incidents.csv') {
  const briefing = buildIncidentBriefing(data)
  const rows: any[] = []

  rows.push({ section: 'Summary', metric: 'Generated', value: formatDateTime(briefing.generatedAt) })
  rows.push({ section: 'Summary', metric: 'Total incidents', value: briefing.total })
  rows.push({ section: 'Summary', metric: 'Active', value: briefing.active })
  rows.push({ section: 'Summary', metric: 'Responded', value: briefing.responded })
  rows.push({ section: 'Summary', metric: 'Resolved', value: briefing.resolved })
  rows.push({ section: 'Summary', metric: 'Total vehicles', value: briefing.totalVehicles })
  rows.push({ section: 'Summary', metric: 'Total injuries', value: briefing.totalInjuries })

  Object.entries(briefing.bySeverity).forEach(([key, value]) => {
    rows.push({ section: 'Severity', metric: titleize(key), value })
  })
  Object.entries(briefing.byStatus).forEach(([key, value]) => {
    rows.push({ section: 'Status', metric: titleize(key), value })
  })

  briefing.hotspots.forEach((row) => {
    rows.push({ section: 'Hotspot', metric: row.location, value: row.count })
  })

  briefing.incidents.forEach((incident) => {
    rows.push({
      section: 'Incident',
      id: incident.id,
      location: incident.location,
      severity: incident.severity,
      status: incident.status,
      time: incident.time,
      vehicles: incident.vehicles,
      injuries: incident.injuries,
      latitude: Number.isFinite(incident.latitude) ? incident.latitude : '',
      longitude: Number.isFinite(incident.longitude) ? incident.longitude : '',
      description: incident.description || '',
    })
  })

  exportCSV(rows, filename)
}

// XLSX export
export function exportXLSX(rows: any[], filename = 'export.xlsx', sheetName = 'Sheet1') {
  const { headerLabels, values } = prepareRows(rows)
  const wb = XLSX.utils.book_new()
  if (headerLabels.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Export Report'], [`Generated: ${new Date().toLocaleString()}`], [], ['No data available']])
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    return
  }

  const sheetData = [
    ['Export Report'],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    headerLabels,
    ...values,
  ]

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  const totalColumns = headerLabels.length
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalColumns - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalColumns - 1 } },
  ]
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3, c: totalColumns - 1 } }),
  }
  ws['!cols'] = headerLabels.map((label, idx) => {
    const maxCell = Math.max(
      label.length,
      ...values.map((row) => String(row[idx] ?? '').length)
    )
    return { wch: Math.min(Math.max(maxCell + 2, 12), 40) }
  })

  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

export function exportReportXLSX(data: any[], filename = 'report.xlsx') {
  const report = getReportBriefing(data)
  if (!report) {
    exportXLSX(data, filename, 'Sheet1')
    return
  }

  const wb = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Officer Briefing'],
    [`Generated: ${formatDateTime(report.generatedAt)}`],
    [`Range: ${titleize(report.timeRange || 'month')}`],
    [],
    ['Summary KPI', 'Value'],
    ['Total incidents', safeNumber(report.summary?.totalIncidents)],
    ['Open incidents', safeNumber(report.summary?.openIncidents)],
    ['Resolution rate', `${safeNumber(report.summary?.resolutionRate)}%`],
    ['Critical open', safeNumber(report.summary?.criticalOpen)],
    ['Unread alerts', safeNumber(report.summary?.unreadAlerts)],
    ['Alert pressure', `${safeNumber(report.summary?.alertPressure)}%`],
  ])
  summarySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
  ]
  setWorksheetColumnWidths(summarySheet)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  const getSeverityKeys = () =>
    Array.from(
      new Set([
        ...Object.keys(report.incidentsBySeverity || {}),
        ...Object.keys(report.alertsBySeverity || {}),
      ])
    )

  const severityRows = getSeverityKeys().map((key) => {
    const incidents = safeNumber(report.incidentsBySeverity?.[key])
    const alerts = safeNumber(report.alertsBySeverity?.[key])
    return [titleize(key), incidents, alerts, incidents + alerts]
  })
  const severitySheet = XLSX.utils.aoa_to_sheet([
    ['Severity', 'Incidents', 'Alerts', 'Total'],
    ...severityRows,
  ])
  setWorksheetColumnWidths(severitySheet)
  XLSX.utils.book_append_sheet(wb, severitySheet, 'Severity')

  const statusRows = Object.entries(report.incidentsByStatus || {}).map(([key, value]) => ([titleize(key), safeNumber(value)]))
  const statusSheet = XLSX.utils.aoa_to_sheet([
    ['Incident status', 'Count'],
    ...statusRows,
  ])
  setWorksheetColumnWidths(statusSheet)
  XLSX.utils.book_append_sheet(wb, statusSheet, 'Status')

  const alertTypeRows = Object.entries(report.alertsByType || {}).map(([key, value]) => ([titleize(key), safeNumber(value)]))
  const alertTypeSheet = XLSX.utils.aoa_to_sheet([
    ['Alert type', 'Count'],
    ...alertTypeRows,
  ])
  setWorksheetColumnWidths(alertTypeSheet)
  XLSX.utils.book_append_sheet(wb, alertTypeSheet, 'AlertTypes')

  const timelineSheet = XLSX.utils.aoa_to_sheet([
    ['Day', 'Incidents', 'Alerts', 'Total'],
    ...(report.sevenDayActivity || []).map((row) => ([
      row.day,
      safeNumber(row.incidents),
      safeNumber(row.alerts),
      safeNumber(row.incidents) + safeNumber(row.alerts),
    ])),
  ])
  setWorksheetColumnWidths(timelineSheet)
  XLSX.utils.book_append_sheet(wb, timelineSheet, 'Timeline')

  const hotspotSheet = XLSX.utils.aoa_to_sheet([
    ['Location', 'Incidents', 'Related alerts', 'Share'],
    ...(report.hotspots || []).map((row) => ([
      row.location || '-',
      safeNumber(row.count),
      safeNumber(row.relatedAlerts),
      `${safeNumber(row.share)}%`,
    ])),
  ])
  setWorksheetColumnWidths(hotspotSheet)
  XLSX.utils.book_append_sheet(wb, hotspotSheet, 'Hotspots')

  const prioritySheet = XLSX.utils.aoa_to_sheet([
    ['Location', 'Severity', 'Injuries', 'Status', 'Time'],
    ...(report.priorityIncidents || []).map((row) => ([
      row.location || '-',
      titleize(row.severity || 'unknown'),
      safeNumber(row.injuries),
      titleize(row.status || 'unknown'),
      row.time || '-',
    ])),
  ])
  setWorksheetColumnWidths(prioritySheet)
  XLSX.utils.book_append_sheet(wb, prioritySheet, 'Priority')

  XLSX.writeFile(wb, filename)
}

export function exportAlertsXLSX(data: any[], filename = 'alerts.xlsx') {
  const briefing = buildAlertBriefing(data)
  const wb = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Alert Operations'],
    [`Generated: ${formatDateTime(briefing.generatedAt)}`],
    [],
    ['Metric', 'Value'],
    ['Total alerts', briefing.total],
    ['Received', briefing.received],
    ['Sent', briefing.sent],
    ['Unread received', briefing.unread],
    ['Acknowledged rate', `${briefing.acknowledgedRate}%`],
  ])
  summarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
  setWorksheetColumnWidths(summarySheet)
  wb.SheetNames.push('Summary')
  wb.Sheets['Summary'] = summarySheet

  const severitySheet = XLSX.utils.aoa_to_sheet([
    ['Severity', 'Count'],
    ...Object.entries(briefing.bySeverity).map(([key, value]) => ([titleize(key), safeNumber(value)])),
  ])
  setWorksheetColumnWidths(severitySheet)
  wb.SheetNames.push('Severity')
  wb.Sheets['Severity'] = severitySheet

  const typeSheet = XLSX.utils.aoa_to_sheet([
    ['Type', 'Count'],
    ...Object.entries(briefing.byType).map(([key, value]) => ([titleize(key), safeNumber(value)])),
  ])
  setWorksheetColumnWidths(typeSheet)
  wb.SheetNames.push('Types')
  wb.Sheets['Types'] = typeSheet

  const directionSheet = XLSX.utils.aoa_to_sheet([
    ['Direction', 'Count'],
    ...Object.entries(briefing.byDirection).map(([key, value]) => ([titleize(key), safeNumber(value)])),
  ])
  setWorksheetColumnWidths(directionSheet)
  wb.SheetNames.push('Direction')
  wb.Sheets['Direction'] = directionSheet

  const alertsSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Direction', 'Severity', 'Type', 'Time', 'Sender', 'Comment', 'Latitude', 'Longitude', 'Read', 'Acknowledged', 'Recipients'],
    ...briefing.alerts.map((alert: any) => ([
      alert.id,
      titleize(alert.direction || 'received'),
      titleize(alert.severity || 'medium'),
      titleize(alert.type || 'system'),
      alert.time || '',
      alert.senderId || '',
      alert.comment || alert.description || '',
      Number.isFinite(alert.latitude) ? alert.latitude : '',
      Number.isFinite(alert.longitude) ? alert.longitude : '',
      alert.read ? 'Yes' : 'No',
      safeNumber(alert.acknowledgedCount),
      safeNumber(alert.recipientCount),
    ])),
  ])
  setWorksheetColumnWidths(alertsSheet)
  wb.SheetNames.push('Alerts')
  wb.Sheets['Alerts'] = alertsSheet

  XLSX.writeFile(wb, filename)
}

export function exportIncidentsXLSX(data: any[], filename = 'incidents.xlsx') {
  const briefing = buildIncidentBriefing(data)
  const wb = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Incident Operations'],
    [`Generated: ${formatDateTime(briefing.generatedAt)}`],
    [],
    ['Metric', 'Value'],
    ['Total incidents', briefing.total],
    ['Active', briefing.active],
    ['Responded', briefing.responded],
    ['Resolved', briefing.resolved],
    ['Total vehicles', briefing.totalVehicles],
    ['Total injuries', briefing.totalInjuries],
  ])
  summarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
  setWorksheetColumnWidths(summarySheet)
  wb.SheetNames.push('Summary')
  wb.Sheets['Summary'] = summarySheet

  const severitySheet = XLSX.utils.aoa_to_sheet([
    ['Severity', 'Count'],
    ...Object.entries(briefing.bySeverity).map(([key, value]) => ([titleize(key), safeNumber(value)])),
  ])
  setWorksheetColumnWidths(severitySheet)
  wb.SheetNames.push('Severity')
  wb.Sheets['Severity'] = severitySheet

  const statusSheet = XLSX.utils.aoa_to_sheet([
    ['Status', 'Count'],
    ...Object.entries(briefing.byStatus).map(([key, value]) => ([titleize(key), safeNumber(value)])),
  ])
  setWorksheetColumnWidths(statusSheet)
  wb.SheetNames.push('Status')
  wb.Sheets['Status'] = statusSheet

  const hotspotSheet = XLSX.utils.aoa_to_sheet([
    ['Location', 'Count'],
    ...briefing.hotspots.map((row) => ([row.location, row.count])),
  ])
  setWorksheetColumnWidths(hotspotSheet)
  wb.SheetNames.push('Hotspots')
  wb.Sheets['Hotspots'] = hotspotSheet

  const incidentsSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Location', 'Severity', 'Status', 'Time', 'Vehicles', 'Injuries', 'Latitude', 'Longitude', 'Description'],
    ...briefing.incidents.map((incident: any) => ([
      incident.id,
      incident.location,
      titleize(incident.severity || 'medium'),
      titleize(incident.status || 'active'),
      incident.time || '',
      safeNumber(incident.vehicles),
      safeNumber(incident.injuries),
      Number.isFinite(incident.latitude) ? incident.latitude : '',
      Number.isFinite(incident.longitude) ? incident.longitude : '',
      incident.description || '',
    ])),
  ])
  setWorksheetColumnWidths(incidentsSheet)
  wb.SheetNames.push('Incidents')
  wb.Sheets['Incidents'] = incidentsSheet

  XLSX.writeFile(wb, filename)
}

// PDF export from HTML element (screenshot) or from text content
export async function exportPDFFromElement(
  element: HTMLElement,
  filename = 'export.pdf',
  options?: { orientation?: 'p' | 'l'; scale?: number }
) {
  const canvas = await html2canvas(element, { scale: options?.scale ?? 1 })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: options?.orientation || 'p', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  let pos = 0
  if (imgHeight < pageHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  } else {
    // paginate if needed
    let heightLeft = imgHeight
    while (heightLeft > 0) {
      pdf.addImage(imgData, 'PNG', 0, pos, imgWidth, imgHeight)
      heightLeft -= pageHeight
      if (heightLeft > 0) {
        pdf.addPage()
        pos = - (imgHeight - heightLeft)
      }
    }
  }
  pdf.save(filename)
}

export async function exportReportPDF(data: any[], filename = 'report.pdf', title = 'Officer Briefing') {
  const report = getReportBriefing(data)
  if (!report) {
    exportPDFFromRows(data, filename, title)
    return
  }

  const container = buildReportBriefingElement(report, title)
  document.body.appendChild(container)
  try {
    await exportPDFFromElement(container, filename, { orientation: 'p', scale: 2 })
  } finally {
    container.remove()
  }
}

export async function exportAlertsPDF(data: any[], filename = 'alerts.pdf', title = 'Alert Operations') {
  const briefing = buildAlertBriefing(data)
  const container = buildAlertsBriefingElement(briefing, title)
  document.body.appendChild(container)
  try {
    await exportPDFFromElement(container, filename, { orientation: 'p', scale: 2 })
  } finally {
    container.remove()
  }
}

export async function exportIncidentsPDF(data: any[], filename = 'incidents.pdf', title = 'Incident Operations') {
  const briefing = buildIncidentBriefing(data)
  const container = buildIncidentsBriefingElement(briefing, title)
  document.body.appendChild(container)
  try {
    await exportPDFFromElement(container, filename, { orientation: 'p', scale: 2 })
  } finally {
    container.remove()
  }
}

export function exportPDFFromText(text: string, filename = 'export.pdf') {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2
  const lines = pdf.splitTextToSize(text, maxWidth)
  pdf.text(lines, margin, margin)
  pdf.save(filename)
}

export function exportPDFFromRows(rows: any[], filename = 'export.pdf', title = 'Export Report') {
  const { headerLabels, values } = prepareRows(rows)
  const orientation = headerLabels.length > 6 ? 'l' : 'p'
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 36
  const tableWidth = pageWidth - margin * 2

  let y = margin
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text(title, margin, y)

  y += 20
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(90)
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
  pdf.setTextColor(0)
  y += 20

  if (headerLabels.length === 0) {
    pdf.setFontSize(12)
    pdf.text('No data available for export.', margin, y)
    pdf.save(filename)
    return
  }

  const colWidth = tableWidth / headerLabels.length

  const drawHeader = () => {
    pdf.setFillColor(79, 70, 229)
    pdf.setTextColor(255)
    pdf.setFont('helvetica', 'bold')
    pdf.rect(margin, y, tableWidth, 24, 'F')

    headerLabels.forEach((header, i) => {
      const x = margin + i * colWidth
      pdf.rect(x, y, colWidth, 24)
      const headerLines = pdf.splitTextToSize(header, colWidth - 8)
      pdf.text(headerLines.slice(0, 2), x + 4, y + 15)
    })

    y += 24
    pdf.setTextColor(0)
    pdf.setFont('helvetica', 'normal')
  }

  drawHeader()

  values.forEach((row, rowIndex) => {
    const lineSets = row.map((cell) => pdf.splitTextToSize(String(cell ?? '-'), colWidth - 8))
    const maxLines = Math.max(...lineSets.map((lines) => lines.length))
    const rowHeight = Math.max(22, maxLines * 11 + 8)

    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage()
      y = margin
      drawHeader()
    }

    if (rowIndex % 2 === 1) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, y, tableWidth, rowHeight, 'F')
    }

    lineSets.forEach((cellLines, i) => {
      const x = margin + i * colWidth
      pdf.rect(x, y, colWidth, rowHeight)
      pdf.text(cellLines, x + 4, y + 14)
    })

    y += rowHeight
  })

  pdf.save(filename)
}

// DOCX export (simple text document from rows or text)
export async function exportDOCXFromRows(rows: any[], filename = 'export.docx') {
  const { headerLabels, values } = prepareRows(rows)

  const content: Array<Paragraph | Table> = [
    new Paragraph({ children: [new TextRun({ text: 'Export Report', bold: true, size: 34 })] }),
    new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 20 })] }),
    new Paragraph({ children: [new TextRun('')] }),
  ]

  if (headerLabels.length === 0) {
    content.push(new Paragraph({ children: [new TextRun('No data available for export.')] }))
  } else {
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: headerLabels.map(
            (header) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
              })
          ),
        }),
        ...values.map(
          (row) =>
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun(String(cell ?? '-'))] })],
                  })
              ),
            })
        ),
      ],
    })

    content.push(table)
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: content,
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

export async function exportReportDOCX(data: any[], filename = 'report.docx', title = 'Officer Briefing') {
  const report = getReportBriefing(data)
  if (!report) {
    await exportDOCXFromRows(data, filename)
    return
  }

  const content: Array<Paragraph | Table> = [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 34 })] }),
    new Paragraph({ children: [new TextRun({ text: `Generated: ${formatDateTime(report.generatedAt)}`, size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: `Range: ${titleize(report.timeRange || 'month')}`, size: 20 })] }),
  ]

  const summaryRows: (string | number)[][] = [
    ['Total incidents', safeNumber(report.summary?.totalIncidents)],
    ['Open incidents', safeNumber(report.summary?.openIncidents)],
    ['Resolution rate', `${safeNumber(report.summary?.resolutionRate)}%`],
    ['Critical open', safeNumber(report.summary?.criticalOpen)],
    ['Unread alerts', safeNumber(report.summary?.unreadAlerts)],
    ['Alert pressure', `${safeNumber(report.summary?.alertPressure)}%`],
  ]
  content.push(...createReportTable('Summary', ['Metric', 'Value'], summaryRows))

  const incidentSeverity = Object.entries(report.incidentsBySeverity || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  content.push(...createReportTable('Incidents by severity', ['Severity', 'Count'], incidentSeverity))

  const alertSeverity = Object.entries(report.alertsBySeverity || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  content.push(...createReportTable('Alerts by severity', ['Severity', 'Count'], alertSeverity))

  const incidentStatus = Object.entries(report.incidentsByStatus || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  content.push(...createReportTable('Incidents by status', ['Status', 'Count'], incidentStatus))

  const alertTypes = Object.entries(report.alertsByType || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  content.push(...createReportTable('Alerts by type', ['Type', 'Count'], alertTypes))

  const timelineRows = (report.sevenDayActivity || []).map((row) => ([
    row.day,
    safeNumber(row.incidents),
    safeNumber(row.alerts),
  ]))
  content.push(...createReportTable('7-day activity', ['Day', 'Incidents', 'Alerts'], timelineRows))

  const hotspotRows = (report.hotspots || []).map((row) => ([
    row.location || '-',
    safeNumber(row.count),
    safeNumber(row.relatedAlerts),
    `${safeNumber(row.share)}%`,
  ]))
  content.push(...createReportTable('Hotspots', ['Location', 'Incidents', 'Related alerts', 'Share'], hotspotRows))

  const priorityRows = (report.priorityIncidents || []).map((row) => ([
    row.location || '-',
    titleize(row.severity || 'unknown'),
    safeNumber(row.injuries),
    titleize(row.status || 'unknown'),
    row.time || '-',
  ]))
  content.push(...createReportTable('Priority incidents', ['Location', 'Severity', 'Injuries', 'Status', 'Time'], priorityRows))

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: content,
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

export async function exportAlertsDOCX(data: any[], filename = 'alerts.docx', title = 'Alert Operations') {
  const briefing = buildAlertBriefing(data)
  const content: Array<Paragraph | Table> = [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 34 })] }),
    new Paragraph({ children: [new TextRun({ text: `Generated: ${formatDateTime(briefing.generatedAt)}`, size: 20 })] }),
    new Paragraph({ children: [new TextRun('')] }),
  ]

  content.push(...createReportTable('Summary', ['Metric', 'Value'], [
    ['Total alerts', briefing.total],
    ['Received', briefing.received],
    ['Sent', briefing.sent],
    ['Unread received', briefing.unread],
    ['Acknowledged rate', `${briefing.acknowledgedRate}%`],
  ]))

  content.push(...createReportTable('Severity', ['Severity', 'Count'], Object.entries(briefing.bySeverity).map(([k, v]) => ([titleize(k), safeNumber(v)]))))
  content.push(...createReportTable('Types', ['Type', 'Count'], Object.entries(briefing.byType).map(([k, v]) => ([titleize(k), safeNumber(v)]))))
  content.push(...createReportTable('Direction', ['Direction', 'Count'], Object.entries(briefing.byDirection).map(([k, v]) => ([titleize(k), safeNumber(v)]))))

  const alertRows = briefing.alerts.map((alert: any) => ([
    alert.id,
    titleize(alert.direction || 'received'),
    titleize(alert.severity || 'medium'),
    titleize(alert.type || 'system'),
    alert.time || '',
    alert.senderId || '',
    alert.comment || alert.description || '',
  ]))
  content.push(...createReportTable('Alerts', ['ID', 'Direction', 'Severity', 'Type', 'Time', 'Sender', 'Comment'], alertRows))

  const doc = new Document({
    sections: [{ properties: {}, children: content }],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

export async function exportIncidentsDOCX(data: any[], filename = 'incidents.docx', title = 'Incident Operations') {
  const briefing = buildIncidentBriefing(data)
  const content: Array<Paragraph | Table> = [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 34 })] }),
    new Paragraph({ children: [new TextRun({ text: `Generated: ${formatDateTime(briefing.generatedAt)}`, size: 20 })] }),
    new Paragraph({ children: [new TextRun('')] }),
  ]

  content.push(...createReportTable('Summary', ['Metric', 'Value'], [
    ['Total incidents', briefing.total],
    ['Active', briefing.active],
    ['Responded', briefing.responded],
    ['Resolved', briefing.resolved],
    ['Total vehicles', briefing.totalVehicles],
    ['Total injuries', briefing.totalInjuries],
  ]))
  content.push(...createReportTable('Severity', ['Severity', 'Count'], Object.entries(briefing.bySeverity).map(([k, v]) => ([titleize(k), safeNumber(v)]))))
  content.push(...createReportTable('Status', ['Status', 'Count'], Object.entries(briefing.byStatus).map(([k, v]) => ([titleize(k), safeNumber(v)]))))
  content.push(...createReportTable('Hotspots', ['Location', 'Count'], briefing.hotspots.map((row) => ([row.location, row.count]))))

  const incidentRows = briefing.incidents.map((incident: any) => ([
    incident.id,
    incident.location,
    titleize(incident.severity || 'medium'),
    titleize(incident.status || 'active'),
    incident.time || '',
    safeNumber(incident.vehicles),
    safeNumber(incident.injuries),
  ]))
  content.push(...createReportTable('Incidents', ['ID', 'Location', 'Severity', 'Status', 'Time', 'Vehicles', 'Injuries'], incidentRows))

  const doc = new Document({
    sections: [{ properties: {}, children: content }],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

export async function exportDOCXFromText(text: string, filename = 'export.docx') {
  const doc = new Document({
    sections: [
      { properties: {}, children: [new Paragraph({ children: [new TextRun(text)] })] },
    ],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

// JPG export from HTML element (screenshot)
export async function exportJPGFromElement(element: HTMLElement, filename = 'export.jpg', quality = 0.92) {
  const canvas = await html2canvas(element)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const byteString = atob(dataUrl.split(',')[1])
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
  const blob = new Blob([ab], { type: mimeString })
  downloadBlob(blob, filename, 'image/jpeg')
}

export async function exportJPGFromRows(rows: any[], filename = 'export.jpg', title = 'Export Report', quality = 0.92) {
  const { headerLabels, values } = prepareRows(rows)

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.background = '#ffffff'
  container.style.padding = '24px'
  container.style.width = '1200px'
  container.style.fontFamily = 'Arial, sans-serif'

  const heading = document.createElement('h2')
  heading.textContent = title
  heading.style.margin = '0 0 8px 0'
  heading.style.color = '#1e293b'
  container.appendChild(heading)

  const meta = document.createElement('p')
  meta.textContent = `Generated: ${new Date().toLocaleString()}`
  meta.style.margin = '0 0 16px 0'
  meta.style.color = '#64748b'
  meta.style.fontSize = '14px'
  container.appendChild(meta)

  if (headerLabels.length === 0) {
    const empty = document.createElement('p')
    empty.textContent = 'No data available for export.'
    empty.style.color = '#334155'
    container.appendChild(empty)
  } else {
    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.tableLayout = 'fixed'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    headerLabels.forEach((header) => {
      const th = document.createElement('th')
      th.textContent = header
      th.style.background = '#4f46e5'
      th.style.color = '#ffffff'
      th.style.padding = '10px'
      th.style.fontSize = '12px'
      th.style.textAlign = 'left'
      th.style.border = '1px solid #e2e8f0'
      th.style.wordBreak = 'break-word'
      headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    values.forEach((row, index) => {
      const tr = document.createElement('tr')
      tr.style.background = index % 2 ? '#f8fafc' : '#ffffff'

      row.forEach((cell) => {
        const td = document.createElement('td')
        td.textContent = String(cell ?? '-')
        td.style.padding = '8px 10px'
        td.style.fontSize = '12px'
        td.style.color = '#1e293b'
        td.style.border = '1px solid #e2e8f0'
        td.style.wordBreak = 'break-word'
        tr.appendChild(td)
      })

      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    container.appendChild(table)
  }

  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2 })
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const byteString = atob(dataUrl.split(',')[1])
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: mimeString })
    downloadBlob(blob, filename, 'image/jpeg')
  } finally {
    container.remove()
  }
}

export async function exportReportJPG(data: any[], filename = 'report.jpg', title = 'Officer Briefing', quality = 0.92) {
  const report = getReportBriefing(data)
  if (!report) {
    await exportJPGFromRows(data, filename, title, quality)
    return
  }

  const container = buildReportBriefingElement(report, title)
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#f8fafc', scale: 2 })
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const byteString = atob(dataUrl.split(',')[1])
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: mimeString })
    downloadBlob(blob, filename, 'image/jpeg')
  } finally {
    container.remove()
  }
}

export async function exportAlertsJPG(data: any[], filename = 'alerts.jpg', title = 'Alert Operations', quality = 0.92) {
  const container = buildAlertsBriefingElement(buildAlertBriefing(data), title)
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#f8fafc', scale: 2 })
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const byteString = atob(dataUrl.split(',')[1])
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: mimeString })
    downloadBlob(blob, filename, 'image/jpeg')
  } finally {
    container.remove()
  }
}

export async function exportIncidentsJPG(data: any[], filename = 'incidents.jpg', title = 'Incident Operations', quality = 0.92) {
  const container = buildIncidentsBriefingElement(buildIncidentBriefing(data), title)
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, { backgroundColor: '#f8fafc', scale: 2 })
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const byteString = atob(dataUrl.split(',')[1])
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: mimeString })
    downloadBlob(blob, filename, 'image/jpeg')
  } finally {
    container.remove()
  }
}

// ODT export (basic) - builds a minimal OpenDocument Text package
// Note: This is a simplified ODT generator suitable for basic text/rows exports
export async function exportODTFromText(text: string, filename = 'export.odt') {
  const zip = new JSZip()
  // Mimetype must be first and uncompressed per ODF spec
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' as any })
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`)
  const escaped = escapeXml(text)
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0">
  <office:body>
    <office:text>
      <text:p>${escaped}</text:p>
    </office:text>
  </office:body>
</office:document-content>`)
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, filename, 'application/vnd.oasis.opendocument.text')
}

export async function exportReportODT(data: any[], filename = 'report.odt', title = 'Officer Briefing') {
  const report = getReportBriefing(data)
  if (!report) {
    await exportODTFromRows(data, filename)
    return
  }

  const zip = new JSZip()
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' as any })
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`)

  const buildTableXml = (headers: string[], rows: (string | number)[][]) => {
    const headerCellsXml = headers
      .map((header) => `<table:table-cell office:value-type="string"><text:p>${escapeXml(header)}</text:p></table:table-cell>`)
      .join('')
    const rowCellsXml = rows
      .map(
        (row) =>
          `<table:table-row>${row
            .map((cell) => `<table:table-cell office:value-type="string"><text:p>${escapeXml(String(cell ?? '-'))}</text:p></table:table-cell>`)
            .join('')}</table:table-row>`
      )
      .join('')
    return `<table:table table:name="Table">
      <table:table-row>${headerCellsXml}</table:table-row>
      ${rowCellsXml}
    </table:table>`
  }

  const summaryRows = [
    ['Total incidents', safeNumber(report.summary?.totalIncidents)],
    ['Open incidents', safeNumber(report.summary?.openIncidents)],
    ['Resolution rate', `${safeNumber(report.summary?.resolutionRate)}%`],
    ['Critical open', safeNumber(report.summary?.criticalOpen)],
    ['Unread alerts', safeNumber(report.summary?.unreadAlerts)],
    ['Alert pressure', `${safeNumber(report.summary?.alertPressure)}%`],
  ]

  const incidentSeverity = Object.entries(report.incidentsBySeverity || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  const alertSeverity = Object.entries(report.alertsBySeverity || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  const incidentStatus = Object.entries(report.incidentsByStatus || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  const alertTypes = Object.entries(report.alertsByType || {}).map(([key, value]) => ([
    titleize(key),
    safeNumber(value),
  ]))
  const timelineRows = (report.sevenDayActivity || []).map((row) => ([
    row.day,
    safeNumber(row.incidents),
    safeNumber(row.alerts),
  ]))
  const hotspotRows = (report.hotspots || []).map((row) => ([
    row.location || '-',
    safeNumber(row.count),
    safeNumber(row.relatedAlerts),
    `${safeNumber(row.share)}%`,
  ]))
  const priorityRows = (report.priorityIncidents || []).map((row) => ([
    row.location || '-',
    titleize(row.severity || 'unknown'),
    safeNumber(row.injuries),
    titleize(row.status || 'unknown'),
    row.time || '-',
  ]))

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">${escapeXml(title)}</text:h>
      <text:p>Generated: ${escapeXml(formatDateTime(report.generatedAt))}</text:p>
      <text:p>Range: ${escapeXml(titleize(report.timeRange || 'month'))}</text:p>
      <text:p></text:p>

      <text:h text:outline-level="2">Summary</text:h>
      ${buildTableXml(['Metric', 'Value'], summaryRows)}

      <text:h text:outline-level="2">Incidents By Severity</text:h>
      ${buildTableXml(['Severity', 'Count'], incidentSeverity)}

      <text:h text:outline-level="2">Alerts By Severity</text:h>
      ${buildTableXml(['Severity', 'Count'], alertSeverity)}

      <text:h text:outline-level="2">Incidents By Status</text:h>
      ${buildTableXml(['Status', 'Count'], incidentStatus)}

      <text:h text:outline-level="2">Alerts By Type</text:h>
      ${buildTableXml(['Type', 'Count'], alertTypes)}

      <text:h text:outline-level="2">7-Day Activity</text:h>
      ${buildTableXml(['Day', 'Incidents', 'Alerts'], timelineRows)}

      <text:h text:outline-level="2">Hotspots</text:h>
      ${buildTableXml(['Location', 'Incidents', 'Related alerts', 'Share'], hotspotRows)}

      <text:h text:outline-level="2">Priority Incidents</text:h>
      ${buildTableXml(['Location', 'Severity', 'Injuries', 'Status', 'Time'], priorityRows)}
    </office:text>
  </office:body>
</office:document-content>`

  zip.file('content.xml', contentXml)
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, filename, 'application/vnd.oasis.opendocument.text')
}

export async function exportAlertsODT(data: any[], filename = 'alerts.odt', title = 'Alert Operations') {
  const briefing = buildAlertBriefing(data)
  const zip = new JSZip()
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' as any })
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`)

  const buildTableXml = (headers: string[], rows: (string | number)[][]) => {
    const headerCellsXml = headers
      .map((header) => `<table:table-cell office:value-type="string"><text:p>${escapeXml(header)}</text:p></table:table-cell>`)
      .join('')
    const rowCellsXml = rows
      .map(
        (row) =>
          `<table:table-row>${row
            .map((cell) => `<table:table-cell office:value-type="string"><text:p>${escapeXml(String(cell ?? '-'))}</text:p></table:table-cell>`)
            .join('')}</table:table-row>`
      )
      .join('')
    return `<table:table table:name="Table">
      <table:table-row>${headerCellsXml}</table:table-row>
      ${rowCellsXml}
    </table:table>`
  }

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">${escapeXml(title)}</text:h>
      <text:p>Generated: ${escapeXml(formatDateTime(briefing.generatedAt))}</text:p>
      <text:p></text:p>

      <text:h text:outline-level="2">Summary</text:h>
      ${buildTableXml(['Metric', 'Value'], [
        ['Total alerts', briefing.total],
        ['Received', briefing.received],
        ['Sent', briefing.sent],
        ['Unread received', briefing.unread],
        ['Acknowledged rate', `${briefing.acknowledgedRate}%`],
      ])}

      <text:h text:outline-level="2">Severity</text:h>
      ${buildTableXml(['Severity', 'Count'], Object.entries(briefing.bySeverity).map(([k, v]) => ([titleize(k), safeNumber(v)])))}

      <text:h text:outline-level="2">Types</text:h>
      ${buildTableXml(['Type', 'Count'], Object.entries(briefing.byType).map(([k, v]) => ([titleize(k), safeNumber(v)])))}

      <text:h text:outline-level="2">Direction</text:h>
      ${buildTableXml(['Direction', 'Count'], Object.entries(briefing.byDirection).map(([k, v]) => ([titleize(k), safeNumber(v)])))}
    </office:text>
  </office:body>
</office:document-content>`

  zip.file('content.xml', contentXml)
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, filename, 'application/vnd.oasis.opendocument.text')
}

export async function exportIncidentsODT(data: any[], filename = 'incidents.odt', title = 'Incident Operations') {
  const briefing = buildIncidentBriefing(data)
  const zip = new JSZip()
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' as any })
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`)

  // Styled table (borders, padding, full width, shaded bold header) so the ODT reads
  // like the Word export rather than an unstyled borderless grid.
  const buildTableXml = (headers: string[], rows: (string | number)[][]) => {
    const headerCellsXml = headers
      .map((header) => `<table:table-cell table:style-name="RACellH" office:value-type="string"><text:p text:style-name="RAHeadP">${escapeXml(header)}</text:p></table:table-cell>`)
      .join('')
    const rowCellsXml = rows
      .map(
        (row) =>
          `<table:table-row>${row
            .map((cell) => `<table:table-cell table:style-name="RACell" office:value-type="string"><text:p>${escapeXml(String(cell ?? '-'))}</text:p></table:table-cell>`)
            .join('')}</table:table-row>`
      )
      .join('')
    return `<table:table table:name="Table" table:style-name="RATbl">
      <table:table-column table:style-name="RACol" table:number-columns-repeated="${headers.length}"/>
      <table:table-row>${headerCellsXml}</table:table-row>
      ${rowCellsXml}
    </table:table>`
  }

  const incidentRows = briefing.incidents.map((incident: any) => ([
    incident.id,
    incident.location,
    titleize(incident.severity || 'medium'),
    titleize(incident.status || 'active'),
    incident.time || '',
    safeNumber(incident.vehicles),
    safeNumber(incident.injuries),
  ]))

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:automatic-styles>
    <style:style style:name="RATbl" style:family="table"><style:table-properties style:rel-width="100%" table:align="margins"/></style:style>
    <style:style style:name="RACol" style:family="table-column"><style:table-column-properties style:rel-column-width="1*"/></style:style>
    <style:style style:name="RACellH" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #334155" fo:padding="0.12cm" fo:background-color="#dbe4f0"/></style:style>
    <style:style style:name="RACell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #cbd5e1" fo:padding="0.1cm"/></style:style>
    <style:style style:name="RAHeadP" style:family="paragraph"><style:text-properties fo:font-weight="bold"/></style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:h text:outline-level="1">${escapeXml(title)}</text:h>
      <text:p>Generated: ${escapeXml(formatDateTime(briefing.generatedAt))}</text:p>
      <text:p></text:p>

      <text:h text:outline-level="2">Summary</text:h>
      ${buildTableXml(['Metric', 'Value'], [
        ['Total incidents', briefing.total],
        ['Active', briefing.active],
        ['Responded', briefing.responded],
        ['Resolved', briefing.resolved],
        ['Total vehicles', briefing.totalVehicles],
        ['Total injuries', briefing.totalInjuries],
      ])}

      <text:h text:outline-level="2">Severity</text:h>
      ${buildTableXml(['Severity', 'Count'], Object.entries(briefing.bySeverity).map(([k, v]) => ([titleize(k), safeNumber(v)])))}

      <text:h text:outline-level="2">Status</text:h>
      ${buildTableXml(['Status', 'Count'], Object.entries(briefing.byStatus).map(([k, v]) => ([titleize(k), safeNumber(v)])))}

      <text:h text:outline-level="2">Hotspots</text:h>
      ${buildTableXml(['Location', 'Count'], briefing.hotspots.map((row) => ([row.location, row.count])))}

      <text:h text:outline-level="2">Incidents</text:h>
      ${buildTableXml(['ID', 'Location', 'Severity', 'Status', 'Time', 'Vehicles', 'Injuries'], incidentRows)}
    </office:text>
  </office:body>
</office:document-content>`

  zip.file('content.xml', contentXml)
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, filename, 'application/vnd.oasis.opendocument.text')
}

export async function exportODTFromRows(rows: any[], filename = 'export.odt') {
  const { headerLabels, values } = prepareRows(rows)
  const zip = new JSZip()
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' as any })
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`)

  const headerCellsXml = headerLabels
    .map((header) => `<table:table-cell table:style-name="RACellH" office:value-type="string"><text:p text:style-name="RAHeadP">${escapeXml(header)}</text:p></table:table-cell>`)
    .join('')

  const rowCellsXml = values
    .map(
      (row) =>
        `<table:table-row>${row
          .map((cell) => `<table:table-cell table:style-name="RACell" office:value-type="string"><text:p>${escapeXml(String(cell ?? '-'))}</text:p></table:table-cell>`)
          .join('')}</table:table-row>`
    )
    .join('')

  const tableXml = headerLabels.length === 0
    ? '<text:p>No data available for export.</text:p>'
    : `<table:table table:name="ExportTable" table:style-name="RATbl">
        <table:table-column table:style-name="RACol" table:number-columns-repeated="${headerLabels.length}"/>
        <table:table-row>${headerCellsXml}</table:table-row>
        ${rowCellsXml}
      </table:table>`

  // Styled table (borders, padding, full width, shaded bold header) so the ODT is
  // presented like the Word export instead of an unstyled borderless grid.
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:automatic-styles>
    <style:style style:name="RATbl" style:family="table"><style:table-properties style:rel-width="100%" table:align="margins"/></style:style>
    <style:style style:name="RACol" style:family="table-column"><style:table-column-properties style:rel-column-width="1*"/></style:style>
    <style:style style:name="RACellH" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #334155" fo:padding="0.12cm" fo:background-color="#dbe4f0"/></style:style>
    <style:style style:name="RACell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #cbd5e1" fo:padding="0.1cm"/></style:style>
    <style:style style:name="RAHeadP" style:family="paragraph"><style:text-properties fo:font-weight="bold"/></style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:h text:outline-level="1">Export Report</text:h>
      <text:p>Generated: ${escapeXml(new Date().toLocaleString())}</text:p>
      <text:p></text:p>
      ${tableXml}
    </office:text>
  </office:body>
</office:document-content>`)

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, filename, 'application/vnd.oasis.opendocument.text')
}
