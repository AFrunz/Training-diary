import type { SetUnit, WeightKg, WeightUnit } from '../model/types'
import { measureToDisplay, toDisplayWeight } from './units'

/**
 * Форматирование значений для интерфейса. Чистые функции: ни времени, ни локали
 * из окружения — всё приходит параметрами.
 *
 * Формат длительности взят из макетов: «47 мин» без часов и «1 ч 08 мин» с часами.
 */

export type Locale = 'ru' | 'en'

export const EMPTY_VALUE = '—'

const WORDS = {
  ru: { hour: 'ч', minute: 'мин', kg: 'кг', lb: 'lb' },
  en: { hour: 'h', minute: 'min', kg: 'kg', lb: 'lb' },
} as const

const pad2 = (value: number): string => String(value).padStart(2, '0')

/** Число без хвостовых нулей: 80 вместо 80.0, но 82.5 сохраняется. */
const formatNumber = (value: number): string => String(value)

export function formatDuration(ms: number | null, locale: Locale): string {
  if (ms === null) return EMPTY_VALUE

  const words = WORDS[locale]
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return hours > 0
    ? `${hours} ${words.hour} ${pad2(minutes)} ${words.minute}`
    : `${totalMinutes} ${words.minute}`
}

export function formatElapsed(startedAt: number, now: number, locale: Locale): string {
  return formatDuration(Math.max(0, now - startedAt), locale)
}

export interface FormattableSet {
  readonly weightKg?: WeightKg | null
  readonly angleDeg?: number | null
  /** Единица подхода; без неё считается, что подход записан в единицах по умолчанию. */
  readonly unit?: SetUnit
  readonly reps: number
}

/**
 * Подход чипом: «82.5 × 6».
 *
 * Единица не подписывается, пока она совпадает с той, что выбрана в настройках:
 * иначе чипы разрослись бы у всех. Подпись появляется у подходов, записанных
 * иначе — «180 lb × 6» и «45° × 12» (FR-4.11).
 */
export function formatSet(set: FormattableSet, defaultUnit: WeightUnit, locale: Locale): string {
  const unit = set.unit ?? defaultUnit
  const value = measureToDisplay(set, unit)
  if (value === null) return `× ${set.reps}`

  const suffix = unit === 'deg' ? '°' : unit === defaultUnit ? '' : ` ${WORDS[locale][unit]}`
  return `${formatNumber(value)}${suffix} × ${set.reps}`
}

export function formatWeight(kg: WeightKg | null, unit: WeightUnit, locale: Locale): string {
  const weight = toDisplayWeight(kg, unit)
  if (weight === null) return EMPTY_VALUE
  return `${formatNumber(weight)} ${WORDS[locale][unit]}`
}

export function formatCompletion(done: number, total: number): string {
  return `${done}/${total}`
}
