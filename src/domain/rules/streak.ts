import type { DateRange, FirstDayOfWeek, LocalDate } from '../model/types'

/**
 * Правила §5.3 ТЗ: серия — количество подряд идущих недель, в каждой из которых
 * была хотя бы одна тренировка. Недели отсутствия серию не прерывают, но и в её
 * длину не засчитываются: пользователь в это время не тренировался.
 */

export interface StreakInput {
  /** Период, внутри которого считаем: обычно от первой тренировки до сегодня. */
  readonly period: DateRange
  readonly workoutDates: readonly LocalDate[]
  readonly absences: readonly DateRange[]
  readonly firstDayOfWeek: FirstDayOfWeek
  /** Сегодняшняя дата: текущая незакрытая неделя не считается пропуском. */
  readonly today: LocalDate
}

export interface StreakResult {
  /** Текущая серия на сегодня. */
  readonly current: number
  /** Рекорд за весь период. */
  readonly record: number
}

export function computeStreaks(_input: StreakInput): StreakResult {
  throw new Error('computeStreaks не реализована')
}
