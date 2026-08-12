import type { DateRange, FirstDayOfWeek, LocalDate, WeekRange } from '../model/types'
import { addDays, isWithin, weeksOfRange } from './dates'

/**
 * Правила §5.3 ТЗ: серия — количество подряд идущих недель, в каждой из которых
 * была хотя бы одна тренировка. Недели отсутствия серию не прерывают, но и в её
 * длину не засчитываются: пользователь в это время не тренировался.
 *
 * Текущая незакрытая неделя пропуском не считается: она ещё не закончилась.
 */

export interface StreakInput {
  readonly period: DateRange
  readonly workoutDates: readonly LocalDate[]
  readonly absences: readonly DateRange[]
  readonly firstDayOfWeek: FirstDayOfWeek
  readonly today: LocalDate
}

export interface StreakResult {
  readonly current: number
  readonly record: number
}

type WeekKind = 'worked' | 'absent' | 'missed'

const classify = (
  week: WeekRange,
  workoutDates: readonly LocalDate[],
  absences: readonly DateRange[],
): WeekKind => {
  if (workoutDates.some((date) => isWithin(date, week.start, week.end))) return 'worked'

  for (let day = week.start; day <= week.end; day = addDays(day, 1)) {
    const covered = absences.some((absence) => isWithin(day, absence.from, absence.to))
    if (!covered) return 'missed'
  }
  return 'absent'
}

export function computeStreaks(input: StreakInput): StreakResult {
  const weeks = weeksOfRange(input.period.from, input.period.to, input.firstDayOfWeek)
  const kinds = weeks.map((week) => classify(week, input.workoutDates, input.absences))

  let record = 0
  let run = 0
  for (const [index, kind] of kinds.entries()) {
    // недели, которые ещё не наступили, пропуском не считаются
    if (weeks[index]!.start > input.today) break
    if (kind === 'worked') {
      run += 1
      record = Math.max(record, run)
    } else if (kind === 'missed') {
      run = 0
    }
  }

  let current = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    const week = weeks[i]!
    const kind = kinds[i]!

    // будущие недели ещё не наступили
    if (week.start > input.today) continue
    if (kind === 'absent') continue
    if (kind === 'worked') {
      current += 1
      continue
    }
    // незакрытая текущая неделя пропуском не считается
    if (isWithin(input.today, week.start, week.end)) continue
    break
  }

  return { current, record }
}
