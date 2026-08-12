import type { Id } from '../../domain/model/types'
import type { Ports } from '../ports'

/** Сценарии библиотеки: упражнения и программы. */

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализован`)
}

/** Создание упражнения (FR-2.1.1): имя обязательное и уникальное без учёта регистра. */
export const createExercise =
  (_p: Ports) =>
  async (_input: {
    readonly name: string
    readonly muscleGroup?: string | null
    readonly note?: string | null
  }): Promise<Id> =>
    notImplemented('createExercise')

/**
 * Удаление упражнения (FR-2.4): использованное в тренировках только архивируется,
 * неиспользованное удаляется по-настоящему.
 */
export const removeExercise = (_p: Ports) => async (_id: Id): Promise<'archived' | 'deleted'> =>
  notImplemented('removeExercise')

/** Первый цвет палитры, не занятый другими программами (FR-3.1.1). */
export const suggestProgramColor = (_p: Ports) => async (): Promise<string> =>
  notImplemented('suggestProgramColor')

export const createProgram =
  (_p: Ports) =>
  async (_input: {
    readonly name: string
    readonly color?: string
    readonly exerciseIds?: readonly Id[]
  }): Promise<Id> =>
    notImplemented('createProgram')

/** Дублирование программы (FR-3.6): состав копируется, к названию добавляется «(копия)». */
export const duplicateProgram = (_p: Ports) => async (_id: Id): Promise<Id> =>
  notImplemented('duplicateProgram')

/** Полная замена состава программы с сохранением порядка (FR-3.1). */
export const setProgramItems =
  (_p: Ports) =>
  async (_input: { readonly programId: Id; readonly exerciseIds: readonly Id[] }): Promise<void> =>
    notImplemented('setProgramItems')

export const archiveProgram = (_p: Ports) => async (_id: Id): Promise<void> =>
  notImplemented('archiveProgram')
