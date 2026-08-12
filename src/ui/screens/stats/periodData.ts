import type { Services } from '../../../app/container'
import type { PeriodStats } from '../../../app/usecases/stats'
import type { Absence } from '../../../domain/model/entities'
import type { LocalDate } from '../../../domain/model/types'
import { localDate } from '../../../domain/model/types'
import { addDays, isWithin, weeksOfRange } from '../../../domain/rules/dates'

/**
 * Данные экрана статистики: сводка сценария monthStats плюс разбивка по столбцам
 * графика. Расчётов здесь нет — только сборка уже посчитанных значений.
 *
 * Годовой режим складывается из двенадцати месячных сводок: отдельного сценария
 * yearStats в app пока нет, поэтому средние берутся взвешенными по числу
 * тренировок, а серия — из месяца, в который попадает сегодняшний день.
 */

export type StatsMode = 'month' | 'year'

/** Столбец графика: неделя в месячном режиме, месяц в годовом. */
export interface StatsColumn {
  readonly key: string
  readonly start: LocalDate
  readonly end: LocalDate
  readonly count: number
  /** Период целиком закрыт отсутствием: вместо столбика показывается плашка. */
  readonly absent: boolean
}

export interface PeriodData {
  readonly stats: PeriodStats
  /** Предыдущий период для строки сравнения. В годовом режиме не считается. */
  readonly previous: PeriodStats | null
  readonly columns: readonly StatsColumn[]
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

const yearOf = (date: LocalDate): number => Number(date.slice(0, 4))
const monthOf = (date: LocalDate): number => Number(date.slice(5, 7))

export const monthStart = (date: LocalDate): LocalDate => localDate(`${date.slice(0, 7)}-01`)

const nextMonthStart = (date: LocalDate): LocalDate => {
  const year = yearOf(date)
  const month = monthOf(date)
  return month === 12 ? localDate(`${year + 1}-01-01`) : localDate(`${year}-${pad2(month + 1)}-01`)
}

export const monthEnd = (date: LocalDate): LocalDate => addDays(nextMonthStart(date), -1)

export const shiftPeriod = (anchor: LocalDate, mode: StatsMode, direction: 1 | -1): LocalDate =>
  mode === 'month'
    ? direction === 1
      ? nextMonthStart(anchor)
      : addDays(monthStart(anchor), -1)
    : localDate(`${yearOf(anchor) + direction}-01-01`)

/** Один и тот же период: месяц сравнивается по YYYY-MM, год — по YYYY. */
export const isSamePeriod = (a: LocalDate, b: LocalDate, mode: StatsMode): boolean =>
  mode === 'month' ? a.slice(0, 7) === b.slice(0, 7) : a.slice(0, 4) === b.slice(0, 4)

const fullyAbsent = (
  range: { readonly start: LocalDate; readonly end: LocalDate },
  absences: readonly Absence[],
): boolean => {
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
    if (!absences.some((absence) => isWithin(day, absence.startDate, absence.endDate))) return false
  }
  return absences.length > 0
}

const loadMonth = async (
  services: Services,
  input: { readonly anchor: LocalDate; readonly today: LocalDate },
): Promise<PeriodData> => {
  const from = monthStart(input.anchor)
  const to = monthEnd(input.anchor)

  const [stats, previous, settings] = await Promise.all([
    services.monthStats({ anyDateOfMonth: input.anchor, today: input.today }),
    services.monthStats({ anyDateOfMonth: addDays(from, -1), today: input.today }),
    services.ports.settings.get(),
  ])

  const weeks = weeksOfRange(from, to, settings.firstDayOfWeek)
  const span = { from: weeks[0]?.start ?? from, to: weeks.at(-1)?.end ?? to }

  const [workouts, absences] = await Promise.all([
    services.ports.workouts.listRange(span),
    services.ports.absences.listRange(span),
  ])

  const columns = weeks.map((week) => {
    const count = workouts.filter((workout) => isWithin(workout.date, week.start, week.end)).length
    return {
      key: week.start,
      start: week.start,
      end: week.end,
      count,
      absent: count === 0 && fullyAbsent(week, absences),
    }
  })

  return { stats, previous, columns }
}

const loadYear = async (
  services: Services,
  input: { readonly anchor: LocalDate; readonly today: LocalDate },
): Promise<PeriodData> => {
  const year = yearOf(input.anchor)
  const anchors = Array.from({ length: 12 }, (_, index) => localDate(`${year}-${pad2(index + 1)}-01`))
  const monthly = await Promise.all(
    anchors.map((anchor) => services.monthStats({ anyDateOfMonth: anchor, today: input.today })),
  )

  const workouts = monthly.reduce((sum, month) => sum + month.workouts, 0)

  /** Среднее по месяцам, взвешенное числом тренировок: длинный месяц весит больше. */
  const weighted = (pick: (month: PeriodStats) => number | null): number | null => {
    let sum = 0
    let weight = 0
    for (const month of monthly) {
      const value = pick(month)
      if (value === null || month.workouts === 0) continue
      sum += value * month.workouts
      weight += month.workouts
    }
    return weight === 0 ? null : sum / weight
  }

  const perWeekValues = monthly
    .map((month) => month.perWeek)
    .filter((value): value is number => value !== null)

  const byProgram = new Map<string, { programId: string; name: string; color: string; count: number }>()
  for (const month of monthly) {
    for (const program of month.byProgram) {
      const existing = byProgram.get(program.programId)
      if (existing) existing.count += program.count
      else byProgram.set(program.programId, { ...program })
    }
  }

  const currentIndex = yearOf(input.today) === year ? monthOf(input.today) - 1 : 11

  const stats: PeriodStats = {
    workouts,
    perWeek:
      perWeekValues.length === 0
        ? null
        : perWeekValues.reduce((sum, value) => sum + value, 0) / perWeekValues.length,
    averageDurationMs: weighted((month) => month.averageDurationMs),
    completionRate: weighted((month) => month.completionRate),
    streak: {
      current: monthly[currentIndex]?.streak.current ?? 0,
      record: monthly.reduce((max, month) => Math.max(max, month.streak.record), 0),
    },
    byProgram: [...byProgram.values()].sort((a, b) => b.count - a.count),
    absenceDays: monthly.reduce((sum, month) => sum + month.absenceDays, 0),
  }

  const columns = anchors.map((anchor, index) => ({
    key: anchor,
    start: anchor,
    end: monthEnd(anchor),
    count: monthly[index]?.workouts ?? 0,
    absent: (monthly[index]?.workouts ?? 0) === 0 && (monthly[index]?.absenceDays ?? 0) > 0,
  }))

  return { stats, previous: null, columns }
}

export const loadPeriod = (
  services: Services,
  input: { readonly mode: StatsMode; readonly anchor: LocalDate; readonly today: LocalDate },
): Promise<PeriodData> =>
  input.mode === 'month'
    ? loadMonth(services, input)
    : loadYear(services, input)
