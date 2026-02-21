import { useState } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  alpha,
  useTheme,
  CircularProgress,
  Box,
} from '@mui/material'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import TextSnippetRoundedIcon from '@mui/icons-material/TextSnippetRounded'

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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const theme = useTheme()
  const isOpen = Boolean(anchorEl)

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    handleClose()

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
    } finally {
      setIsExporting(false)
    }
  }

  const formats: { key: ExportFormat; label: string; icon: React.ReactNode }[] = [
    { key: 'csv', label: 'CSV', icon: <TextSnippetRoundedIcon fontSize="small" /> },
    { key: 'xlsx', label: 'Excel', icon: <TableChartRoundedIcon fontSize="small" /> },
    { key: 'pdf', label: 'PDF', icon: <PictureAsPdfRoundedIcon fontSize="small" /> },
    { key: 'docx', label: 'Word', icon: <ArticleRoundedIcon fontSize="small" /> },
    { key: 'jpg', label: 'JPG Image', icon: <ImageRoundedIcon fontSize="small" /> },
    { key: 'odt', label: 'ODT Document', icon: <DescriptionRoundedIcon fontSize="small" /> },
  ]

  return (
    <>
      <Button
        variant="contained"
        onClick={handleOpen}
        disabled={isExporting || data.length === 0}
        startIcon={isExporting ? <CircularProgress size={18} color="inherit" /> : <FileDownloadRoundedIcon />}
        endIcon={<KeyboardArrowDownRoundedIcon sx={{ 
          transition: 'transform 0.2s',
          transform: isOpen ? 'rotate(180deg)' : 'none'
        }} />}
        sx={{
          borderRadius: 'var(--radius-m3-full, 100px)',
          textTransform: 'none',
          fontWeight: 700,
          px: 3,
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
          '&:hover': {
             boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
          }
        }}
      >
        {isExporting ? 'Exporting...' : label}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-m3-xl, 24px)',
            mt: 1,
            minWidth: 200,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            border: '1px solid',
            borderColor: 'divider',
            p: 1
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
           <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: 1 }}>
             Select Format
           </Typography>
        </Box>
        {formats.map((format) => (
          <MenuItem
            key={format.key}
            onClick={() => handleExport(format.key)}
            sx={{
              borderRadius: 'var(--radius-m3-md, 12px)',
              py: 1.5,
              mb: 0.5,
              '&:last-child': { mb: 0 }
            }}
          >
            <ListItemIcon sx={{ color: 'primary.main' }}>
              {format.icon}
            </ListItemIcon>
            <ListItemText 
              primary={format.label} 
              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
            />
          </MenuItem>
        ))}
        <Box sx={{ px: 2, py: 1, mt: 1, bgcolor: alpha(theme.palette.action.active, 0.03), borderRadius: '12px' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            {data.length} records ready
          </Typography>
        </Box>
      </Menu>
    </>
  )
}
