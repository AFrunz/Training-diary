/**
 * Склонение числительных (§7.2). Чистая функция без зависимостей от React Native,
 * поэтому тестируется как обычный модуль.
 *
 * Русский: «1 тренировка», «3 тренировки», «11 тренировок» — форма зависит не от
 * последней цифры, а от правил языка, поэтому конкатенацией строк это не решается.
 */

export type Locale = 'ru' | 'en'

export interface PluralForms {
  readonly one: string
  /** Русская форма для 2–4; в английском не используется. */
  readonly few?: string
  /** Русская форма для 5–20 и подобных; в английском — форма множественного числа. */
  readonly many?: string
  /** Английская форма множественного числа. */
  readonly other?: string
}

/** Выбирает нужную форму слова. Само число не подставляет. */
export function pluralize(_locale: Locale, _count: number, _forms: PluralForms): string {
  throw new Error('pluralize не реализована')
}

/** Число вместе со словом: `12 тренировок`. */
export function formatCount(_locale: Locale, _count: number, _forms: PluralForms): string {
  throw new Error('formatCount не реализована')
}
