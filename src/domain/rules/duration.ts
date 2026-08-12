import type { Instant, LocalDate } from '../model/types'

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
 *  - получилось больше порога выброса (6 ч)  → 'outlier'
 *
 * Ручные значения времени приоритетнее вычисленных и снимают проверку на «задним числом»:
 * пользователь заполнил их осознанно.
 */

export type DurationReason = 'ok' | 'no-completion' | 'backdated' | 'invalid-range' | 'outlier'

/** Порог выброса из §5.1: больше шести часов — скорее всего забыли отметить упражнение. */
export const OUTLIER_THRESHOLD_MS = 6 * 60 * 60 * 1000

export interface CompletableItem {
  readonly completedAt: Instant | null
}

export interface DurationInput {
  /** Календарная дата тренировки. */
  readonly date: LocalDate
  /** Момент создания записи. */
  readonly startedAt: Instant | null
  /** Последняя отметка о выполнении; null, если ничего не отмечено. */
  readonly finishedAt: Instant | null
  readonly manualStartedAt?: Instant | null
  readonly manualFinishedAt?: Instant | null
  /** Зона пользователя — нужна, чтобы понять, заведена ли тренировка задним числом. */
  readonly timeZone: string
}

export interface DurationResult {
  /** Длительность в миллисекундах или null, если недостоверна. */
  readonly ms: number | null
  readonly reason: DurationReason
  /** Использованы введённые вручную границы. */
  readonly isManual: boolean
  /** Длительность посчиталась, но признана выбросом: в средние не входит, на экране показывается. */
  readonly isOutlier: boolean
}

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализована`)
}

/** Момент окончания тренировки: самая поздняя отметка о выполнении. */
export function deriveFinishedAt(_items: readonly CompletableItem[]): Instant | null {
  return notImplemented('deriveFinishedAt')
}

export function computeDuration(_input: DurationInput): DurationResult {
  return notImplemented('computeDuration')
}
