import { PaletteMode, createTheme, alpha } from '@mui/material/styles'

// ===========================================
// Modern Purple - Material Design 3 Color Palette
// Derived from the Mobile App (Jetpack Compose)
// ===========================================

export const mobileTokens = {
  light: {
    primary: '#6750A4',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
    secondary: '#625B71',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8DEF8',
    onSecondaryContainer: '#1D192B',
    tertiary: '#7D5260',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFD8E4',
    onTertiaryContainer: '#31111D',
    background: '#FEFBFF',
    onBackground: '#1C1B1F',
    surface: '#FFFFFF',
    onSurface: '#1C1B1F',
    surfaceVariant: '#E7E0EC',
    onSurfaceVariant: '#49454F',
    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',
    outline: '#79747E',
    outlineVariant: '#CAC4D0',
    inverseSurface: '#313033',
    inverseOnSurface: '#F4EFF4',
    inversePrimary: '#D0BCFF',
    // Custom
    cardBackground: '#FFFFFF',
    border: '#F1F5F9',
    warning: '#F59E0B',
    textMuted: '#9CA3AF',
  },
  dark: {
    primary: '#6750A4', // Deep Purple (matched to mobile)
    onPrimary: '#FFFFFF',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',
    tertiary: '#EFB8C8',
    onTertiary: '#492532',
    tertiaryContainer: '#633B48',
    onTertiaryContainer: '#FFD8E4',
    background: '#000000', // OLED Optimized
    onBackground: '#E6E1E5',
    surface: '#000000', // OLED Optimized
    onSurface: '#E6E1E5',
    surfaceVariant: '#1C1B1F',
    onSurfaceVariant: '#CAC4D0',
    error: '#F2B8B5',
    onError: '#601410',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',
    outline: '#938F99',
    outlineVariant: '#49454F',
    inverseSurface: '#E6E1E5',
    inverseOnSurface: '#313033',
    inversePrimary: '#6750A4',
    // Custom
    cardBackground: '#121212',
    border: '#2D2D2D',
    warning: '#F59E0B',
    textMuted: '#938F99',
  },
}

export function createAppTheme(mode: PaletteMode) {
  const t = mode === 'dark' ? mobileTokens.dark : mobileTokens.light

  return createTheme({
    // Enable CSS variables for Tailwind v4 integration
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: t.primary,
        contrastText: t.onPrimary,
      },
      secondary: {
        main: t.secondary,
        contrastText: t.onSecondary,
      },
      error: {
        main: t.error,
        contrastText: t.onError,
      },
      warning: {
        main: t.warning,
      },
      background: {
        default: t.background,
        paper: t.cardBackground,
      },
      text: {
        primary: t.onBackground,
        secondary: t.onSurfaceVariant,
      },
      divider: t.border,
      action: {
        hover: alpha(t.primary, 0.08),
        selected: alpha(t.primary, 0.16),
      },
    },
    shape: {
      borderRadius: 16, // More rounded Material 3 style
    },
    typography: {
      fontFamily: ['"Public Sans"', 'Roboto', 'Inter', 'sans-serif'].join(','),
      // Display
      h1: { fontSize: '3.5625rem', lineHeight: '4rem', fontWeight: 400, letterSpacing: '-0.25px' },
      h2: { fontSize: '2.8125rem', lineHeight: '3.25rem', fontWeight: 400, letterSpacing: 0 },
      h3: { fontSize: '2.25rem', lineHeight: '2.75rem', fontWeight: 400, letterSpacing: 0 },
      // Headline
      h4: { fontSize: '2rem', lineHeight: '2.5rem', fontWeight: 600, letterSpacing: 0 },
      h5: { fontSize: '1.75rem', lineHeight: '2.25rem', fontWeight: 600, letterSpacing: 0 },
      h6: { fontSize: '1.5rem', lineHeight: '2rem', fontWeight: 600, letterSpacing: 0 },
      // Title
      subtitle1: { fontSize: '1rem', lineHeight: '1.5rem', fontWeight: 500, letterSpacing: '0.15px' },
      subtitle2: { fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: 500, letterSpacing: '0.1px' },
      // Body
      body1: { fontSize: '1rem', lineHeight: '1.5rem', fontWeight: 400, letterSpacing: '0.5px' },
      body2: { fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: 400, letterSpacing: '0.25px' },
      // Label / Button
      button: { fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: 500, letterSpacing: '0.1px', textTransform: 'none' },
      caption: { fontSize: '0.75rem', lineHeight: '1rem', fontWeight: 400, letterSpacing: '0.4px' },
      overline: { fontSize: '0.6875rem', lineHeight: '1rem', fontWeight: 500, letterSpacing: '0.5px' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(t.outline, 0.3),
              borderRadius: '8px',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 100, // Fully rounded M3 buttons
            padding: '10px 24px',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 24, // M3 Card Large
            padding: '16px',
            backgroundImage: 'none',
            backgroundColor: t.cardBackground,
            border: `1px solid ${t.outlineVariant}`,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
            },
          },
        },
      },
    },
  })
}
