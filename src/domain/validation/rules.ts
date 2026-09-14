import type { Id, LocalDate, WeightKg } from '../model/types'
import { daysBetween } from '../rules/dates'
import { MAX_ANGLE_DEG, MIN_ANGLE_DEG } from '../rules/units'

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
  | 'angle-out-of-range'
  | 'range-inverted'
  | 'range-too-long'
  | 'exercise-duplicate-in-program'

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ValidationCode }

export const MAX_NAME_LENGTH = 60
export const MAX_REPS = 999
export const MAX_WEIGHT_KG = 1000
export const MAX_ABSENCE_DAYS = 365

export { MAX_ANGLE_DEG, MIN_ANGLE_DEG }

const ok: ValidationResult = { ok: true }
const fail = (code: ValidationCode): ValidationResult => ({ ok: false, code })

/** Краевые пробелы не значимы, внутренние — значимы: «Жим  лёжа» и «Жим лёжа» разные. */
const normalize = (name: string): string => name.trim()

const checkName = (name: string): ValidationResult => {
  const trimmed = normalize(name)
  if (trimmed.length === 0) return fail('name-empty')
  if (trimmed.length > MAX_NAME_LENGTH) return fail('name-too-long')
  return ok
}

export function validateExerciseName(
  name: string,
  existingNames: readonly string[],
): ValidationResult {
  const basic = checkName(name)
  if (!basic.ok) return basic

  const candidate = normalize(name).toLowerCase()
  const isDuplicate = existingNames.some((existing) => normalize(existing).toLowerCase() === candidate)
  return isDuplicate ? fail('name-duplicate') : ok
}

/** Названия программ повторяться могут: это дело пользователя (FR-3.1). */
export function validateProgramName(name: string): ValidationResult {
  return checkName(name)
}

export function validateSet(set: {
  weightKg?: WeightKg | null
  angleDeg?: number | null
  reps: number
}): ValidationResult {
  if (!Number.isInteger(set.reps) || set.reps <= 0) return fail('reps-not-positive-integer')
  if (set.reps > MAX_REPS) return fail('reps-too-large')

  const weight = set.weightKg ?? null
  if (weight !== null) {
    if (!Number.isFinite(weight)) return fail('weight-not-finite')
    if (weight < 0) return fail('weight-negative')
    if (weight > MAX_WEIGHT_KG) return fail('weight-too-large')
  }

  const angle = set.angleDeg ?? null
  if (angle !== null) {
    // наклон бывает и отрицательным (декалайн), но «больше вертикали» — опечатка
    if (!Number.isFinite(angle) || angle < MIN_ANGLE_DEG || angle > MAX_ANGLE_DEG) {
      return fail('angle-out-of-range')
    }
  }
  return ok
}

export function validateAbsenceRange(from: LocalDate, to: LocalDate): ValidationResult {
  if (to < from) return fail('range-inverted')
  if (daysBetween(from, to) + 1 > MAX_ABSENCE_DAYS) return fail('range-too-long')
  return ok
}

export function validateProgramItems(exerciseIds: readonly Id[]): ValidationResult {
  return new Set(exerciseIds).size === exerciseIds.length
    ? ok
    : fail('exercise-duplicate-in-program')
}
