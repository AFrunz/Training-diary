import type { Instant } from '../model/types'

/**
 * Правила §5.2 ТЗ: доля выполненных упражнений и цвет бублика.
 *
 *   100 %      → success
 *   50–99 %    → warning
 *   меньше 50% → danger
 *   0 % и нет ни одного подхода → muted, «не начата»
 *
 * Разово добавленные упражнения (FR-4.6) входят в знаменатель наравне с остальными.
 */

export type CompletionTone = 'success' | 'warning' | 'danger' | 'muted'

export interface CompletionItem {
  readonly completedAt: Instant | null
  /** Сколько подходов записано: отличает «не начата» от «начата, но ничего не отмечено». */
  readonly setCount: number
}

export interface CompletionResult {
  readonly done: number
  readonly total: number
  /** Доля от 0 до 1. Для тренировки без упражнений — 0. */
  readonly ratio: number
  readonly tone: CompletionTone
}

export function computeCompletion(_items: readonly CompletionItem[]): CompletionResult {
  throw new Error('computeCompletion не реализована')
}
