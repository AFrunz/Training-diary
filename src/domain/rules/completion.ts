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
  readonly ratio: number
  readonly tone: CompletionTone
}

/**
 * Завершена ли тренировка (FR-4.12).
 *
 * Отметки на всех упражнениях — обычный путь, но тренировку можно закрыть и
 * руками: упражнение пропущено осознанно, а счётчик не должен идти до ночи.
 * Ручное время окончания и есть этот признак, доля выполненного на него не
 * влияет — она остаётся честной.
 */
export function isWorkoutFinished(input: {
  readonly manualFinishedAt?: Instant | null
  readonly completion: Pick<CompletionResult, 'done' | 'total'>
}): boolean {
  if (input.manualFinishedAt !== null && input.manualFinishedAt !== undefined) return true
  return input.completion.total > 0 && input.completion.done === input.completion.total
}

export function computeCompletion(items: readonly CompletionItem[]): CompletionResult {
  const total = items.length
  const done = items.filter((item) => item.completedAt !== null).length
  const ratio = total === 0 ? 0 : done / total

  const tone: CompletionTone = (() => {
    if (total === 0) return 'muted'
    if (done === total) return 'success'
    if (ratio >= 0.5) return 'warning'
    // ничего не отмечено и ни одного подхода — тренировка даже не начата
    if (done === 0 && items.every((item) => item.setCount === 0)) return 'muted'
    return 'danger'
  })()

  return { done, total, ratio, tone }
}
