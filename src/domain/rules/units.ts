import type { WeightKg, WeightUnit } from '../model/types'

/**
 * FR-7.5: вес хранится в килограммах всегда. Переключение единиц меняет только
 * отображение и не переписывает историю.
 *
 * Шаг ввода: 2.5 кг или 5 фунтов (§7.2), округление показа — до 0.5 кг и до 1 фунта.
 */

export const LB_PER_KG = 2.20462262185

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализована`)
}

export function kgToLb(_kg: WeightKg): number {
  return notImplemented('kgToLb')
}

export function lbToKg(_lb: number): WeightKg {
  return notImplemented('lbToKg')
}

/** Округление к шагу отображения: 0.5 для килограммов, 1 для фунтов. */
export function roundForUnit(_value: number, _unit: WeightUnit): number {
  return notImplemented('roundForUnit')
}

/** Вес в выбранных единицах, готовый к показу. null для упражнений без веса — подпись рисуется отдельно. */
export function toDisplayWeight(_kg: WeightKg | null, _unit: WeightUnit): number | null {
  return notImplemented('toDisplayWeight')
}

/** Значение из поля ввода в килограммы для хранения. */
export function fromInputWeight(_value: number | null, _unit: WeightUnit): WeightKg | null {
  return notImplemented('fromInputWeight')
}

/** Шаг кнопок «−» и «+» рядом с полем веса. */
export function stepForUnit(_unit: WeightUnit): number {
  return notImplemented('stepForUnit')
}
