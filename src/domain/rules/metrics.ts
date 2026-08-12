import type { DateRange, FirstDayOfWeek, LocalDate, WeightKg } from '../model/types'
import { addDays, isWithin, weeksOfRange } from './dates'

/**
 * Правила §5.3 ТЗ.
 *
 * 1ПМ по Эпли: вес × (1 + повторы / 30), показывается при повторах ≤ 12 и заполненном весе.
 * Тренировок в неделю: число тренировок / число недель периода, где недели,
 * целиком попавшие в отсутствие, из знаменателя исключаются.
 */

export const ONE_RM_MAX_REPS = 12

export function epley1RM(weightKg: WeightKg | null, reps: number): number | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) return null
  if (!Number.isInteger(reps) || reps <= 0 || reps > ONE_RM_MAX_REPS) return null
  // на одном повторе разовый максимум — это и есть поднятый вес; формула его завысила бы
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function averageOrNull(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null)
  if (known.length === 0) return null
  return known.reduce((sum, value) => sum + value, 0) / known.length
}

export interface WorkoutsPerWeekInput {
  readonly period: DateRange
  readonly workoutDates: readonly LocalDate[]
  readonly absences: readonly DateRange[]
  readonly firstDayOfWeek: FirstDayOfWeek
}

/** Дни, попавшие хотя бы в одно отсутствие. Пересекающиеся отрезки не удваиваются. */
const absentDays = (absences: readonly DateRange[]): Set<string> => {
  const days = new Set<string>()
  for (const absence of absences) {
    if (absence.from > absence.to) continue
    for (let day = absence.from; day <= absence.to; day = addDays(day, 1)) {
      days.add(day)
    }
  }
  return days
}

export function countEligibleWeeks(input: Omit<WorkoutsPerWeekInput, 'workoutDates'>): number {
  const weeks = weeksOfRange(input.period.from, input.period.to, input.firstDayOfWeek)
  const absent = absentDays(input.absences)

  return weeks.filter((week) => {
    for (let day = week.start; day <= week.end; day = addDays(day, 1)) {
      if (!absent.has(day)) return true
    }
    return false
  }).length
}

export function workoutsPerWeek(input: WorkoutsPerWeekInput): number | null {
  const eligibleWeeks = countEligibleWeeks(input)
  if (eligibleWeeks === 0) return null

  const workouts = input.workoutDates.filter((date) =>
    isWithin(date, input.period.from, input.period.to),
  ).length

  return workouts / eligibleWeeks
}
