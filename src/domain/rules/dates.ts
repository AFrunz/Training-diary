import type { FirstDayOfWeek, Instant, LocalDate, WeekRange, WeekdayNumber } from '../model/types'
import { localDate } from '../model/types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const formatters = new Map<string, Intl.DateTimeFormat>()

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    // формат собирается из частей: полагаться на порядок и разделители локали нельзя,
    // на Android набор локалей движка отличается от настольного
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** Разбирает `YYYY-MM-DD` в числа без обращения к таймзонам. */
const parts = (date: LocalDate): [number, number, number] => {
  const [year, month, day] = date.split('-').map(Number)
  return [year!, month!, day!]
}

/** Календарная арифметика идёт через UTC-полночь: перевод часов на неё не влияет. */
const toEpochDay = (date: LocalDate): number => {
  const [year, month, day] = parts(date)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

const fromEpochDay = (epochDay: number): LocalDate => {
  const at = new Date(epochDay * MS_PER_DAY)
  const year = String(at.getUTCFullYear()).padStart(4, '0')
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  const day = String(at.getUTCDate()).padStart(2, '0')
  return localDate(`${year}-${month}-${day}`)
}

export function toLocalDate(at: Instant, timeZone: string): LocalDate {
  const parts = formatterFor(timeZone).formatToParts(new Date(at))
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return localDate(`${value('year').padStart(4, '0')}-${value('month')}-${value('day')}`)
}

export function isSameLocalDay(a: Instant, b: Instant, timeZone: string): boolean {
  return toLocalDate(a, timeZone) === toLocalDate(b, timeZone)
}

export function weekdayOf(date: LocalDate): WeekdayNumber {
  const [year, month, day] = parts(date)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return (weekday === 0 ? 7 : weekday) as WeekdayNumber
}

export function startOfWeek(date: LocalDate, firstDay: FirstDayOfWeek): LocalDate {
  const offset = (weekdayOf(date) - firstDay + 7) % 7
  return addDays(date, -offset)
}

export function weekOf(date: LocalDate, firstDay: FirstDayOfWeek): WeekRange {
  const start = startOfWeek(date, firstDay)
  return { start, end: addDays(start, 6) }
}

export function weeksOfRange(from: LocalDate, to: LocalDate, firstDay: FirstDayOfWeek): WeekRange[] {
  if (from > to) return []
  const weeks: WeekRange[] = []
  let start = startOfWeek(from, firstDay)
  while (start <= to) {
    weeks.push({ start, end: addDays(start, 6) })
    start = addDays(start, 7)
  }
  return weeks
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return toEpochDay(b) - toEpochDay(a)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + days)
}

export function isWithin(date: LocalDate, from: LocalDate, to: LocalDate): boolean {
  return date >= from && date <= to
}
