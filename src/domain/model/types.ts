/**
 * Базовые типы предметной области. Никаких импортов извне: этот слой не знает
 * ни про React Native, ни про SQLite (см. ARCHITECTURE.md §1).
 */

/** Идентификатор сущности. UUID, чтобы импорт из разных копий не конфликтовал. */
export type Id = string & { readonly __brand: 'Id' }

/** Календарная дата в локальной зоне пользователя, формат `YYYY-MM-DD`. */
export type LocalDate = string & { readonly __brand: 'LocalDate' }

/** Момент времени, миллисекунды эпохи UTC. */
export type Instant = number & { readonly __brand: 'Instant' }

/** Вес всегда хранится в килограммах (FR-7.5). */
export type WeightKg = number

/** Единица веса из настроек: значение по умолчанию для новых подходов. */
export type WeightUnit = 'kg' | 'lb'

/**
 * Чем измеряется подход (FR-4.11). Вес — в килограммах или фунтах, `deg` — угол
 * наклона скамьи: для пресса и жимов под углом сама «нагрузка» задаётся им.
 */
export type SetUnit = WeightUnit | 'deg'

export const SET_UNITS: readonly SetUnit[] = ['kg', 'lb', 'deg']

export const isWeightUnit = (unit: SetUnit): unit is WeightUnit => unit !== 'deg'

/** 1 — понедельник, 7 — воскресенье (нумерация ISO-8601). */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Первый день недели из настроек: только понедельник или воскресенье. */
export type FirstDayOfWeek = 1 | 7

export const id = (value: string): Id => value as Id
export const localDate = (value: string): LocalDate => value as LocalDate
export const instant = (value: number): Instant => value as Instant

export interface DateRange {
  readonly from: LocalDate
  readonly to: LocalDate
}

export interface WeekRange {
  /** Дата начала недели, она же ключ недели. */
  readonly start: LocalDate
  /** Дата конца недели включительно. */
  readonly end: LocalDate
}
