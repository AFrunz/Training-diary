import type { Instant, LocalDate } from '../model/types'
import { toLocalDate } from './dates'

/**
 * Правила §5.1 ТЗ.
 *
 * startedAt  — момент создания записи о тренировке
 * finishedAt — временная метка последнего отмеченного упражнения
 * duration   — finishedAt − startedAt
 *
 * Длительность недостоверна и равна null, если:
 *  - не отмечено ни одного упражнения        → 'no-completion'
 *  - тренировка заведена задним числом       → 'backdated'
 *  - конец раньше начала                     → 'invalid-range'
 *
 * Выброс (больше шести часов) значение сохраняет: на экране показывается,
 * из средних исключается.
 *
 * Ручные значения времени приоритетнее вычисленных и снимают проверку на
 * «задним числом»: пользователь заполнил их осознанно.
 */

export type DurationReason = 'ok' | 'no-completion' | 'backdated' | 'invalid-range' | 'outlier'

/** Порог выброса из §5.1: больше шести часов — скорее всего забыли отметить упражнение. */
export const OUTLIER_THRESHOLD_MS = 6 * 60 * 60 * 1000

export interface CompletableItem {
  readonly completedAt: Instant | null
}

export interface DurationInput {
  readonly date: LocalDate
  readonly startedAt: Instant | null
  readonly finishedAt: Instant | null
  readonly manualStartedAt?: Instant | null
  readonly manualFinishedAt?: Instant | null
  readonly timeZone: string
}

export interface DurationResult {
  readonly ms: number | null
  readonly reason: DurationReason
  readonly isManual: boolean
  readonly isOutlier: boolean
}

export function deriveFinishedAt(items: readonly CompletableItem[]): Instant | null {
  let latest: Instant | null = null
  for (const item of items) {
    if (item.completedAt !== null && (latest === null || item.completedAt > latest)) {
      latest = item.completedAt
    }
  }
  return latest
}

export function computeDuration(input: DurationInput): DurationResult {
  const manualStartedAt = input.manualStartedAt ?? null
  const manualFinishedAt = input.manualFinishedAt ?? null
  const isManual = manualStartedAt !== null || manualFinishedAt !== null

  const startedAt = manualStartedAt ?? input.startedAt
  const finishedAt = manualFinishedAt ?? input.finishedAt

  const fail = (reason: DurationReason): DurationResult => ({
    ms: null,
    reason,
    isManual,
    isOutlier: false,
  })

  if (startedAt === null) return fail('invalid-range')
  if (finishedAt === null) return fail('no-completion')
  if (!isManual && toLocalDate(startedAt, input.timeZone) !== input.date) return fail('backdated')

  const ms = finishedAt - startedAt
  if (ms < 0) return fail('invalid-range')

  const isOutlier = ms > OUTLIER_THRESHOLD_MS
  return {
    ms,
    reason: isOutlier ? 'outlier' : 'ok',
    isManual,
    isOutlier,
  }
}
