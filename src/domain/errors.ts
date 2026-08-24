import type { ValidationCode } from './validation/rules'
import type { Id, LocalDate } from './model/types'

/** Доменные ошибки несут код, а не готовый текст: тексты живут в словаре интерфейса. */

export class ValidationFailed extends Error {
  constructor(readonly code: ValidationCode) {
    super(code)
    this.name = 'ValidationFailed'
  }
}

/** Одна тренировка на дату (FR-1.3): попытка завести вторую. */
export class WorkoutDateTaken extends Error {
  constructor(
    readonly date: LocalDate,
    readonly existingId: Id,
  ) {
    super(`workout-date-taken:${date}`)
    this.name = 'WorkoutDateTaken'
  }
}

export class NotFound extends Error {
  constructor(
    readonly entity: 'exercise' | 'program' | 'workout' | 'workout-item' | 'workout-set' | 'absence',
    readonly entityId: Id,
  ) {
    super(`not-found:${entity}:${entityId}`)
    this.name = 'NotFound'
  }
}
