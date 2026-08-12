/**
 * Склонение числительных (§7.2).
 *
 * Правила CLDR реализованы вручную, а не через `Intl.PluralRules`: движок Hermes
 * на Android его не поддерживает, и обращение к нему роняет приложение. Формы
 * выбираются не по последней цифре — 11–14 в русском исключение, а дробные
 * значения («3.1 тренировки») требуют отдельной формы.
 */

export type Locale = 'ru' | 'en'

export type PluralCategory = 'one' | 'few' | 'many' | 'other'

export interface PluralForms {
  readonly one: string
  readonly few?: string
  readonly many?: string
  readonly other?: string
}

/** Категория по правилам CLDR для поддерживаемых языков. */
export function pluralCategory(locale: Locale, count: number): PluralCategory {
  const isFraction = !Number.isInteger(count)
  if (locale === 'en') return count === 1 && !isFraction ? 'one' : 'other'

  // русский: дробные значения всегда «other» — «3.1 тренировки»
  if (isFraction) return 'other'

  const abs = Math.abs(count)
  const lastDigit = abs % 10
  const lastTwo = abs % 100

  if (lastDigit === 1 && lastTwo !== 11) return 'one'
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'few'
  return 'many'
}

export function pluralize(locale: Locale, count: number, forms: PluralForms): string {
  const category = pluralCategory(locale, count)

  const form =
    category === 'one'
      ? forms.one
      : category === 'few'
        ? (forms.few ?? forms.other)
        : category === 'many'
          ? (forms.many ?? forms.other)
          : (forms.other ?? forms.many)

  if (form === undefined) {
    throw new Error(`не задана форма «${category}» для языка ${locale}: добавьте её в словарь`)
  }
  return form
}

export function formatCount(locale: Locale, count: number, forms: PluralForms): string {
  return `${count} ${pluralize(locale, count, forms)}`
}
