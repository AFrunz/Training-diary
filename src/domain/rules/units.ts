import type { SetUnit, WeightKg, WeightUnit } from '../model/types'
import { isWeightUnit } from '../model/types'

/**
 * FR-7.5: вес хранится в килограммах всегда. Переключение единиц меняет только
 * отображение и не переписывает историю.
 *
 * Шаг ввода: 2.5 кг или 5 фунтов (§7.2), округление показа — до 0.5 кг и до 1 фунта.
 * Угол (FR-4.11) не конвертируется: он и хранится, и показывается в градусах.
 */

export const LB_PER_KG = 2.20462262185

const assertNonNegative = (value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`вес не может быть отрицательным: ${value}`)
  }
}

export function kgToLb(kg: WeightKg): number {
  assertNonNegative(kg)
  return kg * LB_PER_KG
}

export function lbToKg(lb: number): WeightKg {
  assertNonNegative(lb)
  return lb / LB_PER_KG
}

export function roundForUnit(value: number, unit: WeightUnit): number {
  // умножение на 2 и деление обратно даёт точные половины без хвостов вида 82.50000000000001
  return unit === 'kg' ? Math.round(value * 2) / 2 : Math.round(value)
}

export function toDisplayWeight(kg: WeightKg | null, unit: WeightUnit): number | null {
  if (kg === null) return null
  return roundForUnit(unit === 'kg' ? kg : kgToLb(kg), unit)
}

export function fromInputWeight(value: number | null, unit: WeightUnit): WeightKg | null {
  if (value === null) return null
  // округление живёт только на отображении: в базу уходит точное значение
  return unit === 'kg' ? value : lbToKg(value)
}

export function stepForUnit(unit: WeightUnit): number {
  return unit === 'kg' ? 2.5 : 5
}

/** Что именно записывается в подход: вес в килограммах либо угол. */
export interface SetMeasure {
  readonly weightKg: WeightKg | null
  readonly angleDeg: number | null
}

export const ANGLE_STEP_DEG = 5

/**
 * Скамья наклоняется в обе стороны: 30° — жим под углом вверх, −15° — декалайн,
 * 0° — горизонталь. Ноль здесь настоящее значение, а не «пусто».
 */
export const MAX_ANGLE_DEG = 90
export const MIN_ANGLE_DEG = -90

/** Введённое число раскладывается по полям подхода согласно выбранной единице. */
export function measureFromInput(value: number | null, unit: SetUnit): SetMeasure {
  if (unit === 'deg') return { weightKg: null, angleDeg: value }
  return { weightKg: fromInputWeight(value, unit), angleDeg: null }
}

/** Обратное преобразование: число, которое показывается в поле ввода и в чипе. */
export function measureToDisplay(measure: Partial<SetMeasure>, unit: SetUnit): number | null {
  if (unit === 'deg') return measure.angleDeg ?? null
  return toDisplayWeight(measure.weightKg ?? null, unit)
}

export function roundForSetUnit(value: number, unit: SetUnit): number {
  return unit === 'deg' ? Math.round(value) : roundForUnit(value, unit)
}

export function stepForSetUnit(unit: SetUnit): number {
  return isWeightUnit(unit) ? stepForUnit(unit) : ANGLE_STEP_DEG
}
