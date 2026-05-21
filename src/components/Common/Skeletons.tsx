import { Box, Skeleton, alpha, useTheme } from '@mui/material'
import { motion } from 'framer-motion'
import { fadeIn } from '../../utils/motion'

const MotionBox = motion(Box)

// StatCard skeleton — matches StatCard layout exactly
export function StatCardSkeleton() {
  const theme = useTheme()
  return (
    <MotionBox
      variants={fadeIn}
      initial="initial"
      animate="animate"
      sx={{
        p: 2.5,
        borderRadius: 'var(--radius-m3-xl, 24px)',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Skeleton
          variant="rounded"
          width={44}
          height={44}
          sx={{ borderRadius: '12px', bgcolor: alpha(theme.palette.action.active, 0.06) }}
        />
        <Skeleton
          variant="rounded"
          width={88}
          height={26}
          sx={{ borderRadius: '100px', bgcolor: alpha(theme.palette.action.active, 0.06) }}
        />
      </Box>
      <Box>
        <Skeleton
          variant="text"
          width="45%"
          height={44}
          sx={{ mb: 0.25, bgcolor: alpha(theme.palette.action.active, 0.06) }}
        />
        <Skeleton
          variant="text"
          width="68%"
          height={20}
          sx={{ bgcolor: alpha(theme.palette.action.active, 0.06) }}
        />
      </Box>
    </MotionBox>
  )
}

// Single incident/alert list row skeleton
export function ListRowSkeleton({ index = 0 }: { index?: number }) {
  const theme = useTheme()
  return (
    <MotionBox
      variants={fadeIn}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.04 }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Skeleton
        variant="rounded"
        width={40}
        height={40}
        sx={{ borderRadius: '12px', flexShrink: 0, bgcolor: alpha(theme.palette.action.active, 0.06) }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="55%" height={20} sx={{ bgcolor: alpha(theme.palette.action.active, 0.06) }} />
        <Skeleton variant="text" width="35%" height={16} sx={{ bgcolor: alpha(theme.palette.action.active, 0.06) }} />
      </Box>
      <Skeleton
        variant="rounded"
        width={72}
        height={24}
        sx={{ borderRadius: '6px', flexShrink: 0, bgcolor: alpha(theme.palette.action.active, 0.06) }}
      />
    </MotionBox>
  )
}

// Table row skeleton — 6 cells (uses native tr/td to avoid MUI polymorphic type issues)
export function TableRowSkeleton({ index = 0 }: { index?: number }) {
  const theme = useTheme()
  const widths = [56, 200, 72, 72, 100, 64]
  return (
    <motion.tr
      variants={fadeIn}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.035 }}
    >
      {widths.map((w, i) => (
        <td
          key={i}
          style={{
            padding: '20px 16px',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Skeleton
            variant={i === 2 || i === 3 ? 'rounded' : 'text'}
            width={w}
            height={i === 2 || i === 3 ? 24 : 18}
            sx={{
              borderRadius: i === 2 || i === 3 ? '6px' : undefined,
              bgcolor: alpha(theme.palette.action.active, 0.06),
            }}
          />
        </td>
      ))}
    </motion.tr>
  )
}
