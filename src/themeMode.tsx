import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { PaletteMode } from '@mui/material/styles'
import { createAppTheme } from './theme'
import { localeDirections, translate, type LocaleCode } from './i18n'

type ThemeModeContextValue = {
  mode: PaletteMode
  toggleMode: () => void
  locale: LocaleCode
  direction: 'ltr' | 'rtl'
  setLocale: (locale: LocaleCode) => void
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'light',
  toggleMode: () => {},
  locale: 'en',
  direction: 'ltr',
  setLocale: () => {},
})

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(() => {
    const saved = localStorage.getItem('themeMode')
    return saved === 'dark' ? 'dark' : 'light'
  })
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    const saved = localStorage.getItem('appLocale')
    return (saved === 'fr' || saved === 'ar' || saved === 'en') ? saved : 'en'
  })

  useEffect(() => {
    localStorage.setItem('themeMode', mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem('appLocale', locale)
    document.documentElement.lang = locale
    document.documentElement.dir = localeDirections[locale]
  }, [locale])

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
      locale,
      direction: localeDirections[locale],
      setLocale: setLocaleState,
    }),
    [locale, mode],
  )

  const theme = useMemo(() => createAppTheme(mode, localeDirections[locale]), [locale, mode])

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export const useThemeMode = () => useContext(ThemeModeContext)

export const useTranslation = () => {
  const { locale } = useThemeMode()
  const t = useMemo(
    () => (key: string, fallbackOrParams?: string | Record<string, string | number>) =>
      translate(locale, key as any, fallbackOrParams as any),
    [locale],
  )
  return {
    locale,
    t,
  }
}
