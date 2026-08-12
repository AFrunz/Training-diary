import type { WeightKg, WeightUnit } from '../model/types'

/**
 * Форматирование значений для интерфейса. Чистые функции: ни времени, ни локали
 * из окружения — всё приходит параметрами, иначе тесты станут недетерминированными.
 *
 * Формат длительности взят из макетов: «47 мин» без часов и «1 ч 08 мин» с часами,
 * то есть при наличии часов минуты дополняются нулём.
 */

export type Locale = 'ru' | 'en'

/** Показывается вместо значения, когда данных нет (FR-6.4). */
export const EMPTY_VALUE = '—'

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализована`)
}

/** Длительность в человекочитаемом виде. null → «—». */
export function formatDuration(_ms: number | null, _locale: Locale): string {
  return notImplemented('formatDuration')
}

/** Время, прошедшее с начала тренировки, для счётчика в шапке (FR-4.3). */
export function formatElapsed(_startedAt: number, _now: number, _locale: Locale): string {
  return notImplemented('formatElapsed')
}

/**
 * Подпись подхода: «80 × 8», а для упражнения без веса — «× 12».
 * Разделитель дробной части — точка, как в макетах, независимо от языка.
 */
export function formatSet(
  _set: { weightKg?: WeightKg | null; reps: number },
  _unit: WeightUnit,
): string {
  return notImplemented('formatSet')
}

/** Вес с единицей измерения: «82.5 кг», «182 lb». null → «—». */
export function formatWeight(_kg: WeightKg | null, _unit: WeightUnit, _locale: Locale): string {
  return notImplemented('formatWeight')
}

/** Доля выполненных упражнений для бублика: «3/5». */
export function formatCompletion(_done: number, _total: number): string {
  return notImplemented('formatCompletion')
}
