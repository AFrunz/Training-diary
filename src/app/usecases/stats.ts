import type { LocalDate } from '../../domain/model/types'
import type { Ports } from '../ports'

/** Сводка за период для экрана статистики (FR-6.2). */
export interface PeriodStats {
  readonly workouts: number
  /** null, если в периоде не осталось зачётных недель (весь период — отпуск). */
  readonly perWeek: number | null
  /** Среднее по достоверным длительностям; выбросы исключены (§5.1). */
  readonly averageDurationMs: number | null
  /** Средняя доля выполненных упражнений, 0…1. */
  readonly completionRate: number | null
  readonly streak: { readonly current: number; readonly record: number }
  readonly byProgram: readonly {
    readonly programId: string
    readonly name: string
    readonly color: string
    readonly count: number
  }[]
  readonly absenceDays: number
}

/** Статистика за месяц, содержащий указанную дату. */
export const monthStats =
  (_p: Ports) =>
  async (_input: { readonly anyDateOfMonth: LocalDate; readonly today: LocalDate }): Promise<PeriodStats> => {
    throw new Error('monthStats не реализован')
  }
