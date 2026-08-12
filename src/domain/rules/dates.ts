import type { FirstDayOfWeek, Instant, LocalDate, WeekRange, WeekdayNumber } from '../model/types'

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализована`)
}

/** Календарная дата момента в указанной зоне. Принадлежность дню считается по локальной дате, а не по UTC (§5.3). */
export function toLocalDate(_at: Instant, _timeZone: string): LocalDate {
  return notImplemented('toLocalDate')
}

/** Попадают ли два момента в один локальный день. */
export function isSameLocalDay(_a: Instant, _b: Instant, _timeZone: string): boolean {
  return notImplemented('isSameLocalDay')
}

/** День недели по ISO: 1 — понедельник … 7 — воскресенье. */
export function weekdayOf(_date: LocalDate): WeekdayNumber {
  return notImplemented('weekdayOf')
}

/** Начало недели, содержащей дату, с учётом настройки первого дня недели. */
export function startOfWeek(_date: LocalDate, _firstDay: FirstDayOfWeek): LocalDate {
  return notImplemented('startOfWeek')
}

/** Неделя, содержащая дату. */
export function weekOf(_date: LocalDate, _firstDay: FirstDayOfWeek): WeekRange {
  return notImplemented('weekOf')
}

/** Все недели, пересекающиеся с отрезком дат, по возрастанию. Границы включительно. */
export function weeksOfRange(_from: LocalDate, _to: LocalDate, _firstDay: FirstDayOfWeek): WeekRange[] {
  return notImplemented('weeksOfRange')
}

/** Разница в календарных днях: b − a. Для одной и той же даты — 0. */
export function daysBetween(_a: LocalDate, _b: LocalDate): number {
  return notImplemented('daysBetween')
}

/** Сдвиг даты на указанное число дней. */
export function addDays(_date: LocalDate, _days: number): LocalDate {
  return notImplemented('addDays')
}

/** Пересекается ли дата с отрезком, границы включительно. */
export function isWithin(_date: LocalDate, _from: LocalDate, _to: LocalDate): boolean {
  return notImplemented('isWithin')
}
