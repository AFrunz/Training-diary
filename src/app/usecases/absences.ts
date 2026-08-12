import { NotFound, ValidationFailed } from '../../domain/errors'
import type { AbsenceType } from '../../domain/model/entities'
import type { DateRange, Id, LocalDate } from '../../domain/model/types'
import { localDate } from '../../domain/model/types'
import { validateAbsenceRange } from '../../domain/validation/rules'
import type { Ports } from '../ports'

/** Отсутствия: отпуск, болезнь, травма (FR-1.6). Пропуском в статистике они не считаются. */

/** Поиск отсутствия по идентификатору идёт по всему времени. */
const ALL_TIME: DateRange = { from: localDate('0000-01-01'), to: localDate('9999-12-31') }

export interface CreateAbsenceInput {
  readonly startDate: LocalDate
  readonly endDate: LocalDate
  readonly type: AbsenceType
  readonly note?: string | null
}

export const createAbsence = (p: Ports) => async (input: CreateAbsenceInput): Promise<Id> => {
  const check = validateAbsenceRange(input.startDate, input.endDate)
  if (!check.ok) throw new ValidationFailed(check.code)

  const now = p.clock.now()
  const absenceId = p.ids.uuid()

  await p.absences.insert({
    id: absenceId,
    startDate: input.startDate,
    endDate: input.endDate,
    type: input.type,
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  })

  return absenceId
}

export const deleteAbsence = (p: Ports) => async (absenceId: Id): Promise<void> => {
  const existing = await p.absences.listRange(ALL_TIME)
  if (!existing.some((absence) => absence.id === absenceId)) {
    throw new NotFound('absence', absenceId)
  }
  await p.absences.remove(absenceId)
}
