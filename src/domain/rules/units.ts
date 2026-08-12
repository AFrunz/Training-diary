import type { WeightKg, WeightUnit } from '../model/types'

/**
 * FR-7.5: вес хранится в килограммах всегда. Переключение единиц меняет только
 * отображение и не переписывает историю.
 *
 * Шаг ввода: 2.5 кг или 5 фунтов (§7.2), округление показа — до 0.5 кг и до 1 фунта.
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
