import type { LocalDate } from '../../domain/model/types'
import { localDate } from '../../domain/model/types'
import { computeCompletion } from '../../domain/rules/completion'
import { addDays, daysBetween } from '../../domain/rules/dates'
import { computeDuration } from '../../domain/rules/duration'
import { averageOrNull, workoutsPerWeek } from '../../domain/rules/metrics'
import { computeStreaks } from '../../domain/rules/streak'
import type { Ports } from '../ports'

/** Сводка за период для экрана статистики (FR-6.2). */
export interface PeriodStats {
  readonly workouts: number
  readonly perWeek: number | null
  readonly averageDurationMs: number | null
  readonly completionRate: number | null
  readonly streak: { readonly current: number; readonly record: number }
  readonly byProgram: readonly {
    readonly programId: string
    readonly name: string
    readonly color: string
    readonly count: number
  }[]
  readonly absenceDays: number
}

const monthBounds = (anyDate: LocalDate): { from: LocalDate; to: LocalDate } => {
  const [year, month] = anyDate.split('-').map(Number)
  const from = localDate(`${anyDate.slice(0, 7)}-01`)
  const nextMonth = month === 12 ? `${year! + 1}-01-01` : `${year}-${String(month! + 1).padStart(2, '0')}-01`
  return { from, to: addDays(localDate(nextMonth), -1) }
}

const yearBounds = (anyDate: LocalDate): { from: LocalDate; to: LocalDate } => {
  const year = anyDate.slice(0, 4)
  return { from: localDate(`${year}-01-01`), to: localDate(`${year}-12-31`) }
}

/**
 * Сводка за произвольный период. Год считается одним куском, а не суммой месяцев:
 * иначе серия недель рвалась бы на каждой границе месяца.
 */
const periodStats =
  (p: Ports) =>
  async (period: { from: LocalDate; to: LocalDate }, today: LocalDate): Promise<PeriodStats> => {
    const settings = await p.settings.get()

    const workouts = await p.workouts.listRange(period)
    const absences = await p.absences.listRange(period)
    const absenceRanges = absences.map((absence) => ({ from: absence.startDate, to: absence.endDate }))

    const aggregates = await Promise.all(workouts.map((workout) => p.workouts.byId(workout.id)))

    const durations: (number | null)[] = []
    const completions: number[] = []

    for (const aggregate of aggregates) {
      if (!aggregate) continue

      const duration = computeDuration({
        date: aggregate.workout.date,
        startedAt: aggregate.workout.startedAt,
        finishedAt: aggregate.workout.finishedAt ?? null,
        manualStartedAt: aggregate.workout.manualStartedAt ?? null,
        manualFinishedAt: aggregate.workout.manualFinishedAt ?? null,
        timeZone: p.timeZone,
      })
      // выбросы в среднее не входят (§5.1)
      durations.push(duration.isOutlier ? null : duration.ms)

      completions.push(
        computeCompletion(
          aggregate.items.map((item) => ({
            completedAt: item.completedAt ?? null,
            setCount: item.sets.length,
          })),
        ).ratio,
      )
    }

    const byProgram = new Map<string, { programId: string; name: string; color: string; count: number }>()
    for (const workout of workouts) {
      const existing = byProgram.get(workout.programId)
      if (existing) {
        existing.count += 1
        continue
      }
      byProgram.set(workout.programId, {
        programId: workout.programId,
        name: workout.programName,
        color: workout.programColor,
        count: 1,
      })
    }

    // дни отсутствия считаются только внутри периода, даже если отпуск шире
    let absenceDays = 0
    for (const absence of absences) {
      const from = absence.startDate < period.from ? period.from : absence.startDate
      const to = absence.endDate > period.to ? period.to : absence.endDate
      if (from <= to) absenceDays += daysBetween(from, to) + 1
    }

    const workoutDates = workouts.map((workout) => workout.date)

    return {
      workouts: workouts.length,
      perWeek: workoutsPerWeek({
        period,
        workoutDates,
        absences: absenceRanges,
        firstDayOfWeek: settings.firstDayOfWeek,
      }),
      averageDurationMs: averageOrNull(durations),
      completionRate: completions.length === 0 ? null : averageOrNull(completions),
      streak: computeStreaks({
        period,
        workoutDates,
        absences: absenceRanges,
        firstDayOfWeek: settings.firstDayOfWeek,
        today,
      }),
      byProgram: [...byProgram.values()].sort((a, b) => b.count - a.count),
      absenceDays,
    }
  }

/** Статистика за месяц, содержащий указанную дату. */
export const monthStats =
  (p: Ports) =>
  async (input: { readonly anyDateOfMonth: LocalDate; readonly today: LocalDate }): Promise<PeriodStats> =>
    periodStats(p)(monthBounds(input.anyDateOfMonth), input.today)

/** Статистика за год, содержащий указанную дату. */
export const yearStats =
  (p: Ports) =>
  async (input: { readonly anyDateOfYear: LocalDate; readonly today: LocalDate }): Promise<PeriodStats> =>
    periodStats(p)(yearBounds(input.anyDateOfYear), input.today)
