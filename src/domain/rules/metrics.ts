import type { DateRange, FirstDayOfWeek, LocalDate, WeightKg } from '../model/types'

/**
 * Правила §5.3 ТЗ.
 *
 * 1ПМ по Эпли: вес × (1 + повторы / 30), показывается при повторах ≤ 12 и заполненном весе.
 * Тренировок в неделю: число тренировок / число недель периода, где недели,
 * целиком попавшие в отсутствие, из знаменателя исключаются.
 */

/** Формула Эпли перестаёт быть осмысленной на больших числах повторов. */
export const ONE_RM_MAX_REPS = 12

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализована`)
}

/** Оценочный разовый максимум. null, если вес не заполнен или повторы вне допустимого диапазона. */
export function epley1RM(_weightKg: WeightKg | null, _reps: number): number | null {
  return notImplemented('epley1RM')
}

/** Среднее по значениям, где null — «нет данных». Если данных нет вовсе, результат null, а не 0 (FR-6.4). */
export function averageOrNull(_values: readonly (number | null)[]): number | null {
  return notImplemented('averageOrNull')
}

export interface WorkoutsPerWeekInput {
  readonly period: DateRange
  /** Даты проведённых тренировок; вне периода игнорируются. */
  readonly workoutDates: readonly LocalDate[]
  /** Отрезки отсутствия: отпуск, болезнь. */
  readonly absences: readonly DateRange[]
  readonly firstDayOfWeek: FirstDayOfWeek
}

/** Среднее число тренировок в неделю. null, если в периоде не осталось ни одной «зачётной» недели. */
export function workoutsPerWeek(_input: WorkoutsPerWeekInput): number | null {
  return notImplemented('workoutsPerWeek')
}

/** Сколько недель периода идут в знаменатель: недели целиком внутри отсутствия исключаются. */
export function countEligibleWeeks(_input: Omit<WorkoutsPerWeekInput, 'workoutDates'>): number {
  return notImplemented('countEligibleWeeks')
}
