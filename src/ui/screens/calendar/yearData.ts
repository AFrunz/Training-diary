import type { Services } from '../../../app/container'
import type { LocalDate } from '../../../domain/model/types'
import { localDate } from '../../../domain/model/types'
import { addDays, isWithin, weeksOfRange } from '../../../domain/rules/dates'

/**
 * Данные годовой сетки календаря («02 · Календарь — год»): 12 мини-месяцев,
 * в каждом — недели по семь клеток. Расчётов здесь нет: недели берутся из
 * weeksOfRange, а тренировки и отсутствия — из портов одним запросом на год.
 */

/** Клетка дня. Пустая дата — день соседнего месяца: место занято, квадратик не рисуется. */
export interface YearDayCell {
  readonly date: LocalDate | null
  /** Ключ цвета программы из снапшота тренировки. */
  readonly programColor: string | null
  readonly absent: boolean
}

export interface YearMonthCell {
  /** Номер месяца, 1…12. */
  readonly month: number
  readonly start: LocalDate
  readonly weeks: readonly (readonly YearDayCell[])[]
}

const EMPTY_DAY: YearDayCell = { date: null, programColor: null, absent: false }

const pad2 = (value: number): string => String(value).padStart(2, '0')

const monthStartOf = (year: number, month: number): LocalDate =>
  localDate(`${String(year).padStart(4, '0')}-${pad2(month)}-01`)

const monthEndOf = (year: number, month: number): LocalDate =>
  addDays(month === 12 ? monthStartOf(year + 1, 1) : monthStartOf(year, month + 1), -1)

export const loadYearGrid = async (
  services: Services,
  input: { readonly year: number },
): Promise<readonly YearMonthCell[]> => {
  const range = { from: monthStartOf(input.year, 1), to: monthEndOf(input.year, 12) }

  const [settings, workouts, absences] = await Promise.all([
    services.ports.settings.get(),
    services.ports.workouts.listRange(range),
    services.ports.absences.listRange(range),
  ])

  const colorByDate = new Map<string, string>()
  for (const workout of workouts) colorByDate.set(workout.date, workout.programColor)

  const absentDates = new Set<string>()
  for (const absence of absences) {
    const from = absence.startDate < range.from ? range.from : absence.startDate
    const to = absence.endDate > range.to ? range.to : absence.endDate
    for (let day = from; day <= to; day = addDays(day, 1)) absentDates.add(day)
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const start = monthStartOf(input.year, month)
    const end = monthEndOf(input.year, month)

    const weeks = weeksOfRange(start, end, settings.firstDayOfWeek).map((week) =>
      Array.from({ length: 7 }, (_, offset) => {
        const date = addDays(week.start, offset)
        if (!isWithin(date, start, end)) return EMPTY_DAY
        return {
          date,
          programColor: colorByDate.get(date) ?? null,
          absent: absentDates.has(date),
        }
      }),
    )

    return { month, start, weeks }
  })
}
