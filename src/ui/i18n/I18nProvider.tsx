import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { LanguageMode } from '../../domain/model/entities'
import { dictionaries, plurals } from './dictionaries'
import type { TranslationKey } from './dictionaries'
import { formatCount } from './plural'
import type { Locale } from './plural'

/**
 * Локализация интерфейса (FR-7.6). Язык меняется на лету: провайдер держит
 * выбранное значение, все строки берутся через `useT` в момент отрисовки.
 */

export interface I18n {
  readonly locale: Locale
  /** Строка по ключу с подстановками: t('workout.startedAt', {time: '18:32'}). */
  readonly t: (key: TranslationKey, params?: Record<string, string | number>) => string
  /** Число со склонённым словом: count('workouts', 12) → «12 тренировок». */
  readonly count: (word: keyof typeof plurals, value: number) => string
}

const I18nContext = createContext<I18n | null>(null)

/** Системный язык сводится к поддерживаемому; неизвестный — английский. */
export const resolveLocale = (mode: LanguageMode, systemLanguage: string): Locale => {
  if (mode !== 'system') return mode
  return systemLanguage.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function I18nProvider({
  children,
  mode,
  systemLanguage,
}: {
  children: ReactNode
  mode: LanguageMode
  systemLanguage: string
}) {
  const locale = resolveLocale(mode, systemLanguage)

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const template = dictionaries[locale][key]
      if (!params) return template
      return Object.entries(params).reduce(
        (result, [name, value]) => result.replace(`{${name}}`, String(value)),
        template,
      )
    },
    [locale],
  )

  const count = useCallback(
    (word: keyof typeof plurals, value: number) => formatCount(locale, value, plurals[word][locale]),
    [locale],
  )

  const value = useMemo<I18n>(() => ({ locale, t, count }), [locale, t, count])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18n {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useT вызван вне I18nProvider')
  return context
}
