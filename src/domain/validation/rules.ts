import type { Id, LocalDate, WeightKg } from '../model/types'

/**
 * Проверки ввода. Возвращают код ошибки, а не готовый текст: тексты живут в словаре
 * интерфейса, домен про язык не знает (ARCHITECTURE.md §4).
 */

export type ValidationCode =
  | 'name-empty'
  | 'name-too-long'
  | 'name-duplicate'
  | 'reps-not-positive-integer'
  | 'reps-too-large'
  | 'weight-negative'
  | 'weight-not-finite'
  | 'weight-too-large'
  | 'range-inverted'
  | 'range-too-long'
  | 'exercise-duplicate-in-program'

export type ValidationResult = { readonly ok: true } | { readonly ok: false; readonly code: ValidationCode }

/** Названия длиннее не помещаются ни в одну строку интерфейса и обрезаются везде. */
export const MAX_NAME_LENGTH = 60
/** Больше повторов в одном подходе — почти наверняка опечатка. */
export const MAX_REPS = 999
/** Мировой рекорд в приседе меньше, значит это опечатка в поле ввода. */
export const MAX_WEIGHT_KG = 1000
/** Отсутствие длиннее года — тоже опечатка при выборе дат. */
export const MAX_ABSENCE_DAYS = 365

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализована`)
}

/**
 * Название упражнения: обязательное, уникальное без учёта регистра и краевых пробелов (FR-2.1).
 * `existingNames` — названия других упражнений, включая архивные.
 */
export function validateExerciseName(_name: string, _existingNames: readonly string[]): ValidationResult {
  return notImplemented('validateExerciseName')
}

/** Название программы: обязательное, но повторы разрешены — это дело пользователя (FR-3.1). */
export function validateProgramName(_name: string): ValidationResult {
  return notImplemented('validateProgramName')
}

/** Подход: повторы обязательны, вес — нет (упражнения без веса). */
export function validateSet(_set: { weightKg?: WeightKg | null; reps: number }): ValidationResult {
  return notImplemented('validateSet')
}

/** Отсутствие: конец не раньше начала, разумная длина. */
export function validateAbsenceRange(_from: LocalDate, _to: LocalDate): ValidationResult {
  return notImplemented('validateAbsenceRange')
}

/** Состав программы: одно упражнение не может входить в неё дважды (FR-3.3). */
export function validateProgramItems(_exerciseIds: readonly Id[]): ValidationResult {
  return notImplemented('validateProgramItems')
}
