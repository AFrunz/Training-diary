import type { Id, Instant, LocalDate, WeightKg } from '../../domain/model/types'
import type { Ports } from '../ports'

/** Сценарии работы с тренировкой. Каждый — фабрика, получающая порты. */

const notImplemented = (name: string): never => {
  throw new Error(`${name} не реализован`)
}

export interface CreateWorkoutInput {
  readonly date: LocalDate
  readonly programId: Id
}

/**
 * Создание тренировки (FR-4.1). Состав программы копируется снапшотом (FR-3.5),
 * время начала берётся из часов, на занятую дату — ошибка WorkoutDateTaken.
 */
export const createWorkout = (_p: Ports) => async (_input: CreateWorkoutInput): Promise<Id> =>
  notImplemented('createWorkout')

export interface AddSetInput {
  readonly workoutId: Id
  readonly itemId: Id
  readonly weightKg?: WeightKg | null
  readonly reps: number
}

/** Добавление подхода (FR-4.4). Вес необязателен. */
export const addSet = (_p: Ports) => async (_input: AddSetInput): Promise<Id> => notImplemented('addSet')

export interface ToggleItemDoneInput {
  readonly workoutId: Id
  readonly itemId: Id
  readonly done: boolean
}

/** Отметка «выполнено» (FR-4.5): проставляет и снимает временную метку. */
export const toggleItemDone = (_p: Ports) => async (_input: ToggleItemDoneInput): Promise<void> =>
  notImplemented('toggleItemDone')

/** Добавление упражнения сверх программы (FR-4.6). */
export const addAdHocExercise =
  (_p: Ports) =>
  async (_input: { readonly workoutId: Id; readonly exerciseId: Id }): Promise<Id> =>
    notImplemented('addAdHocExercise')

export interface EditWorkoutTimesInput {
  readonly workoutId: Id
  readonly manualStartedAt?: Instant | null
  readonly manualFinishedAt?: Instant | null
}

/** Ручная правка времени по завершении тренировки (FR-4.7). */
export const editWorkoutTimes = (_p: Ports) => async (_input: EditWorkoutTimesInput): Promise<void> =>
  notImplemented('editWorkoutTimes')

export const deleteWorkout = (_p: Ports) => async (_workoutId: Id): Promise<void> =>
  notImplemented('deleteWorkout')

export interface SetSuggestion {
  readonly weightKg: WeightKg | null
  readonly reps: number
  /** Откуда взято значение: помогает объяснить поведение в тестах и в интерфейсе. */
  readonly source: 'this-workout' | 'previous-workout' | 'program-target' | 'empty'
}

/**
 * Предзаполнение полей нового подхода (FR-4.4): сначала предыдущий подход этого
 * упражнения в текущей тренировке, иначе — из прошлой тренировки.
 */
export const suggestNextSet =
  (_p: Ports) =>
  async (_input: { readonly workoutId: Id; readonly itemId: Id }): Promise<SetSuggestion> =>
    notImplemented('suggestNextSet')
