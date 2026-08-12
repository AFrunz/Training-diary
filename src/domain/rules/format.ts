import type { WeightKg, WeightUnit } from '../model/types'
import { toDisplayWeight } from './units'

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

export function formatSet(
  set: { weightKg?: WeightKg | null; reps: number },
  unit: WeightUnit,
): string {
  const weight = toDisplayWeight(set.weightKg ?? null, unit)
  return weight === null ? `× ${set.reps}` : `${formatNumber(weight)} × ${set.reps}`
}

export function formatWeight(kg: WeightKg | null, unit: WeightUnit, locale: Locale): string {
  const weight = toDisplayWeight(kg, unit)
  if (weight === null) return EMPTY_VALUE
  return `${formatNumber(weight)} ${WORDS[locale][unit]}`
}

export function formatCompletion(done: number, total: number): string {
  return `${done}/${total}`
}
