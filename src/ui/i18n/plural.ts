/**
 * Склонение числительных (§7.2). Чистая функция без зависимостей от React Native.
 *
 * Формы выбираются правилами CLDR через Intl.PluralRules, а не по последней цифре:
 * 11–14 в русском — исключение, а дробные значения («3.1 тренировки») требуют
 * отдельной формы.
 */

export type Locale = 'ru' | 'en'

export interface PluralForms {
  readonly one: string
  readonly few?: string
  readonly many?: string
  readonly other?: string
}

const rules = new Map<Locale, Intl.PluralRules>()

const rulesFor = (locale: Locale): Intl.PluralRules => {
  let rule = rules.get(locale)
  if (!rule) {
    rule = new Intl.PluralRules(locale)
    rules.set(locale, rule)
  }
  return rule
}

export function pluralize(locale: Locale, count: number, forms: PluralForms): string {
  const category = rulesFor(locale).select(count)

  const form =
    category === 'one'
      ? forms.one
      : category === 'few'
        ? (forms.few ?? forms.other)
        : category === 'many'
          ? (forms.many ?? forms.other)
          : (forms.other ?? forms.many)

  if (form === undefined) {
    throw new Error(
      `не задана форма «${category}» для языка ${locale}: добавьте её в словарь`,
    )
  }
  return form
}

export function formatCount(locale: Locale, count: number, forms: PluralForms): string {
  return `${count} ${pluralize(locale, count, forms)}`
}
