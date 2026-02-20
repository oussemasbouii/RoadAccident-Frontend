import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType } from 'docx'
import JSZip from 'jszip'

type RowData = Record<string, any>

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

// PDF export from HTML element (screenshot) or from text content
export async function exportPDFFromElement(element: HTMLElement, filename = 'export.pdf', options?: { orientation?: 'p' | 'l' }) {
  const canvas = await html2canvas(element)
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
    .map((header) => `<table:table-cell office:value-type="string"><text:p>${escapeXml(header)}</text:p></table:table-cell>`)
    .join('')

  const rowCellsXml = values
    .map(
      (row) =>
        `<table:table-row>${row
          .map((cell) => `<table:table-cell office:value-type="string"><text:p>${escapeXml(String(cell ?? '-'))}</text:p></table:table-cell>`)
          .join('')}</table:table-row>`
    )
    .join('')

  const noDataRow = '<text:p>No data available for export.</text:p>'

  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">Export Report</text:h>
      <text:p>Generated: ${escapeXml(new Date().toLocaleString())}</text:p>
      <text:p></text:p>
      ${headerLabels.length === 0
        ? noDataRow
        : `<table:table table:name="ExportTable">
            <table:table-row>${headerCellsXml}</table:table-row>
            ${rowCellsXml}
          </table:table>`}
    </office:text>
  </office:body>
</office:document-content>`)

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, filename, 'application/vnd.oasis.opendocument.text')
}
