import { useState, useRef, useEffect } from 'react'
import {
  exportCSV,
  exportXLSX,
  exportPDFFromRows,
  exportDOCXFromRows,
  exportJPGFromRows,
  exportODTFromRows,
} from '../../utils/exporters'

interface ExportButtonProps {
  data: any[]
  filename?: string
  label?: string
}

type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'docx' | 'jpg' | 'odt'

export default function ExportButton({ data, filename = 'export', label = 'Export' }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    setIsOpen(false)

    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const baseFilename = `${filename}-${timestamp}`

      switch (format) {
        case 'csv':
          exportCSV(data, `${baseFilename}.csv`)
          break
        case 'xlsx':
          exportXLSX(data, `${baseFilename}.xlsx`, 'Sheet1')
          break
        case 'pdf':
          exportPDFFromRows(data, `${baseFilename}.pdf`, label)
          break
        case 'docx':
          await exportDOCXFromRows(data, `${baseFilename}.docx`)
          break
        case 'jpg':
          await exportJPGFromRows(data, `${baseFilename}.jpg`, label)
          break
        case 'odt':
          await exportODTFromRows(data, `${baseFilename}.odt`)
          break
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const formats: { key: ExportFormat; label: string; icon: string }[] = [
    { key: 'csv', label: 'CSV', icon: '📄' },
    { key: 'xlsx', label: 'Excel', icon: '📊' },
    { key: 'pdf', label: 'PDF', icon: '📕' },
    { key: 'docx', label: 'Word', icon: '📝' },
    { key: 'jpg', label: 'JPG', icon: '🖼️' },
    { key: 'odt', label: 'ODT', icon: '📘' },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting || data.length === 0}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200 ease-in-out
          ${data.length === 0 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-md hover:shadow-lg'
          }
        `}
      >
        {isExporting ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Select Format
            </div>
            {formats.map((format) => (
              <button
                key={format.key}
                onClick={() => handleExport(format.key)}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-3 transition-colors"
              >
                <span className="text-base">{format.icon}</span>
                <span>Export as {format.label}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-700/50">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {data.length} item{data.length !== 1 ? 's' : ''} to export
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
