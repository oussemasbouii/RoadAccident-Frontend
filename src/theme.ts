import { PaletteMode, createTheme } from '@mui/material/styles'

export const mobileTokens = {
  light: {
    primary: '#6750A4',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
    secondary: '#625B71',
    tertiary: '#7D5260',
    background: '#FEFBFF',
    surface: '#FFFFFF',
    surfaceVariant: '#E7E0EC',
    textPrimary: '#1C1B1F',
    textSecondary: '#49454F',
    textMuted: '#9CA3AF',
    error: '#B3261E',
    border: '#F1F5F9',
    warning: '#F59E0B',
  },
  dark: {
    primary: '#6750A4',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    secondary: '#CCC2DC',
    tertiary: '#EFB8C8',
    background: '#000000',
    surface: '#000000',
    surfaceVariant: '#1C1B1F',
    textPrimary: '#E6E1E5',
    textSecondary: '#CAC4D0',
    textMuted: '#938F99',
    error: '#F2B8B5',
    border: '#2D2D2D',
    warning: '#F59E0B',
  },
}

export function createAppTheme(mode: PaletteMode) {
  const t = mode === 'dark' ? mobileTokens.dark : mobileTokens.light

  return createTheme({
    palette: {
      mode,
      primary: { main: t.primary },
      secondary: { main: t.secondary },
      error: { main: t.error },
      warning: { main: t.warning },
      background: {
        default: t.background,
        paper: t.surface,
      },
      text: {
        primary: t.textPrimary,
        secondary: t.textSecondary,
      },
      divider: t.border,
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
      h6: { fontWeight: 700 },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
      },
    },
  })
}
