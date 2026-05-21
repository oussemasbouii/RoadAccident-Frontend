import ar from './locales/ar'
import en from './locales/en'
import fr from './locales/fr'
import type { LocaleCode, TextDirection, TranslationMessages } from './i18n.types'

export type { LocaleCode, TextDirection } from './i18n.types'

type Primitive = string | number | boolean | null | undefined
type TranslationValue = Primitive | { [key: string]: TranslationValue }
type TranslationParams = Record<string, string | number>

type JoinPath<Prefix extends string, Key extends string> = Prefix extends '' ? Key : `${Prefix}.${Key}`

type LeafPaths<T, Prefix extends string = ''> = {
  [K in Extract<keyof T, string>]: T[K] extends string
    ? JoinPath<Prefix, K>
    : T[K] extends Record<string, any>
      ? LeafPaths<T[K], JoinPath<Prefix, K>>
      : never
}[Extract<keyof T, string>]

export type TranslationKey = LeafPaths<TranslationMessages>

export const translations: Record<LocaleCode, TranslationMessages> = {
  en,
  fr,
  ar,
}

export const localeLabels: Record<LocaleCode, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
}

export const localeDirections: Record<LocaleCode, TextDirection> = {
  en: 'ltr',
  fr: 'ltr',
  ar: 'rtl',
}

export const localeOptions = (['en', 'fr', 'ar'] as const).map((locale) => ({
  value: locale,
  label: localeLabels[locale],
  direction: localeDirections[locale],
}))

const isRecord = (value: unknown): value is Record<string, TranslationValue> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

function resolveTranslation(tree: TranslationMessages, key: string): string | undefined {
  const path = key.split('.')
  let current: TranslationValue = tree
  for (const part of path) {
    if (!isRecord(current) || !(part in current)) return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = params[token]
    return value === undefined ? match : String(value)
  })
}

export function translate(locale: LocaleCode, key: TranslationKey, fallback?: string): string
export function translate(locale: LocaleCode, key: TranslationKey, params?: TranslationParams): string
export function translate(locale: LocaleCode, key: TranslationKey, fallbackOrParams?: string | TranslationParams): string {
  const resolved = resolveTranslation(translations[locale], key)
    ?? resolveTranslation(translations.en, key)
    ?? (typeof fallbackOrParams === 'string' ? fallbackOrParams : undefined)
    ?? key
  return typeof fallbackOrParams === 'object' && fallbackOrParams !== null
    ? interpolate(resolved, fallbackOrParams)
    : resolved
}
