import { NotFound, ValidationFailed, WorkoutDateTaken } from '../../domain/errors'
import type { WorkoutItem, WorkoutSet } from '../../domain/model/entities'
import type { Id, Instant, LocalDate, SetUnit } from '../../domain/model/types'
import { deriveFinishedAt } from '../../domain/rules/duration'
import { measureFromInput, measureToDisplay } from '../../domain/rules/units'
import { validateSet } from '../../domain/validation/rules'
import type { Ports, WorkoutAggregate } from '../ports'

/** Сценарии работы с тренировкой. Каждый — фабрика, получающая порты. */

export interface CreateWorkoutInput {
  readonly date: LocalDate
  readonly programId: Id
}

const requireWorkout = async (p: Ports, workoutId: Id): Promise<WorkoutAggregate> => {
  const aggregate = await p.workouts.byId(workoutId)
  if (!aggregate) throw new NotFound('workout', workoutId)
  return aggregate
}

/**
 * Создание тренировки (FR-4.1). Состав программы копируется снапшотом (FR-3.5),
 * время начала берётся из часов, на занятую дату — ошибка WorkoutDateTaken.
 */
export const createWorkout = (p: Ports) => async (input: CreateWorkoutInput): Promise<Id> => {
  const occupied = await p.workouts.byDate(input.date)
  if (occupied) throw new WorkoutDateTaken(input.date, occupied.id)

  const program = await p.programs.byIdWithItems(input.programId)
  if (!program) throw new NotFound('program', input.programId)

  const now = p.clock.now()
  const workoutId = p.ids.uuid()

  const items: WorkoutItem[] = program.items.map((item, index) => ({
    id: p.ids.uuid(),
    workoutId,
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    order: index,
    isAdHoc: false,
    completedAt: null,
  }))

  await p.uow.tx(async () => {
    await p.workouts.insert(
      {
        id: workoutId,
        date: input.date,
        programId: program.program.id,
        programName: program.program.name,
        programColor: program.program.color,
        startedAt: now,
        finishedAt: null,
        manualStartedAt: null,
        manualFinishedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      items,
    )
  })

  return workoutId
}

export interface AddSetInput {
  readonly workoutId: Id
  readonly itemId: Id
  /** Число из поля ввода в единицах `unit`; null — подход без веса. */
  readonly value?: number | null
  readonly unit: SetUnit
  readonly reps: number
}

/**
 * Добавление подхода (FR-4.4). Вес необязателен, единица своя у каждого подхода
 * (FR-4.11). Пишется сразу, без кнопки «Сохранить».
 */
export const addSet = (p: Ports) => async (input: AddSetInput): Promise<Id> => {
  const measure = measureFromInput(input.value ?? null, input.unit)
  const check = validateSet({ ...measure, reps: input.reps })
  if (!check.ok) throw new ValidationFailed(check.code)

  const aggregate = await requireWorkout(p, input.workoutId)
  const item = aggregate.items.find((candidate) => candidate.id === input.itemId)
  if (!item) throw new NotFound('workout-item', input.itemId)

  const set: WorkoutSet = {
    id: p.ids.uuid(),
    workoutItemId: item.id,
    order: item.sets.length,
    ...measure,
    unit: input.unit,
    reps: input.reps,
    createdAt: p.clock.now(),
  }
  await p.workouts.addSet(set)
  return set.id
}

export interface EditSetInput {
  readonly workoutId: Id
  readonly itemId: Id
  readonly setId: Id
  readonly value?: number | null
  readonly unit: SetUnit
  readonly reps: number
}

const requireSet = (aggregate: WorkoutAggregate, itemId: Id, setId: Id): WorkoutSet => {
  const item = aggregate.items.find((candidate) => candidate.id === itemId)
  if (!item) throw new NotFound('workout-item', itemId)

  const set = item.sets.find((candidate) => candidate.id === setId)
  if (!set) throw new NotFound('workout-set', setId)
  return set
}

/** Правка записанного подхода по тапу (FR-4.4.1). Номер и время создания не меняются. */
export const editSet = (p: Ports) => async (input: EditSetInput): Promise<void> => {
  const measure = measureFromInput(input.value ?? null, input.unit)
  const check = validateSet({ ...measure, reps: input.reps })
  if (!check.ok) throw new ValidationFailed(check.code)

  const aggregate = await requireWorkout(p, input.workoutId)
  const set = requireSet(aggregate, input.itemId, input.setId)

  await p.workouts.updateSet({ ...set, ...measure, unit: input.unit, reps: input.reps })
}

export interface DeleteSetInput {
  readonly workoutId: Id
  readonly itemId: Id
  readonly setId: Id
}

/**
 * Удаление подхода из того же окна правки (FR-4.4.1).
 *
 * Оставшиеся подходы перенумеровываются: номер подхода — это его порядок, и без
 * сжатия дырка сдвинула бы сопоставление с прошлой тренировкой.
 */
export const deleteSet = (p: Ports) => async (input: DeleteSetInput): Promise<void> => {
  const aggregate = await requireWorkout(p, input.workoutId)
  const set = requireSet(aggregate, input.itemId, input.setId)
  const item = aggregate.items.find((candidate) => candidate.id === input.itemId)!

  await p.uow.tx(async () => {
    await p.workouts.removeSet(set.id)

    const rest = item.sets.filter((candidate) => candidate.id !== set.id)
    for (const [index, remaining] of rest.entries()) {
      if (remaining.order !== index) await p.workouts.updateSet({ ...remaining, order: index })
    }
  })
}

export interface ToggleItemDoneInput {
  readonly workoutId: Id
  readonly itemId: Id
  readonly done: boolean
}

/** Отметка «выполнено» (FR-4.5): проставляет и снимает временную метку. */
export const toggleItemDone = (p: Ports) => async (input: ToggleItemDoneInput): Promise<void> => {
  const aggregate = await requireWorkout(p, input.workoutId)
  const item = aggregate.items.find((candidate) => candidate.id === input.itemId)
  if (!item) throw new NotFound('workout-item', input.itemId)

  // повторная отметка не должна сдвигать уже проставленное время
  if (input.done && item.completedAt) return
  if (!input.done && !item.completedAt) return

  const at = input.done ? p.clock.now() : null

  await p.uow.tx(async () => {
    await p.workouts.setItemCompleted(item.id, at)

    const updated = await requireWorkout(p, input.workoutId)
    await p.workouts.update({
      ...updated.workout,
      finishedAt: deriveFinishedAt(updated.items),
      updatedAt: p.clock.now(),
    })
  })
}

/** Добавление упражнения сверх программы (FR-4.6). */
export const addAdHocExercise =
  (p: Ports) =>
  async (input: { readonly workoutId: Id; readonly exerciseId: Id }): Promise<Id> => {
    const aggregate = await requireWorkout(p, input.workoutId)
    if (aggregate.items.some((item) => item.exerciseId === input.exerciseId)) {
      throw new ValidationFailed('exercise-duplicate-in-program')
    }

    const exercise = await p.exercises.byId(input.exerciseId)
    if (!exercise) throw new NotFound('exercise', input.exerciseId)

    const item: WorkoutItem = {
      id: p.ids.uuid(),
      workoutId: input.workoutId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      order: aggregate.items.length,
      isAdHoc: true,
      completedAt: null,
    }
    await p.workouts.addItem(item)
    return item.id
  }

export interface EditWorkoutTimesInput {
  readonly workoutId: Id
  readonly manualStartedAt?: Instant | null
  readonly manualFinishedAt?: Instant | null
}

/** Ручная правка времени по завершении тренировки (FR-4.7). */
export const editWorkoutTimes = (p: Ports) => async (input: EditWorkoutTimesInput): Promise<void> => {
  const aggregate = await requireWorkout(p, input.workoutId)

  const manualStartedAt = input.manualStartedAt ?? null
  const manualFinishedAt = input.manualFinishedAt ?? null
  if (manualStartedAt !== null && manualFinishedAt !== null && manualFinishedAt < manualStartedAt) {
    throw new ValidationFailed('range-inverted')
  }

  await p.workouts.update({
    ...aggregate.workout,
    manualStartedAt,
    manualFinishedAt,
    updatedAt: p.clock.now(),
  })
}

export const deleteWorkout = (p: Ports) => async (workoutId: Id): Promise<void> => {
  await requireWorkout(p, workoutId)
  await p.workouts.remove(workoutId)
}

/**
 * Подходы прошлой тренировки по каждому упражнению текущей (FR-4.10): экран
 * показывает их над сегодняшними, чтобы сравнение было наглядным.
 */
export const previousSets =
  (p: Ports) =>
  async (workoutId: Id): Promise<Readonly<Record<string, readonly WorkoutSet[]>>> => {
    const aggregate = await requireWorkout(p, workoutId)

    const entries = await Promise.all(
      aggregate.items.map(
        async (item) =>
          [
            item.id,
            await p.workouts.previousSetsOf(item.exerciseId, {
              before: aggregate.workout.date,
              exceptWorkoutId: workoutId,
            }),
          ] as const,
      ),
    )

    return Object.fromEntries(entries)
  }

export interface SetSuggestion {
  /** Число для поля ввода в единицах `unit`. */
  readonly value: number | null
  readonly unit: SetUnit
  readonly reps: number
  readonly source: 'previous-workout' | 'this-workout' | 'program-target' | 'empty'
  /** Подход прошлой тренировки под тем же номером — его показывает подсказка. */
  readonly previous: WorkoutSet | null
}

const fromSet = (
  set: WorkoutSet,
  source: SetSuggestion['source'],
  previous: WorkoutSet | null,
): SetSuggestion => ({
  value: measureToDisplay(set, set.unit),
  unit: set.unit,
  reps: set.reps,
  source,
  previous,
})

/**
 * Предзаполнение полей нового подхода (FR-4.4). Ведущий источник — подход прошлой
 * тренировки под тем же номером: второй подход подставляется из второго, а не из
 * последнего сделанного. Дальше — последний подход в этой тренировке (когда
 * подходов сегодня уже больше, чем было), план программы и пустые поля.
 */
export const suggestNextSet =
  (p: Ports) =>
  async (input: { readonly workoutId: Id; readonly itemId: Id }): Promise<SetSuggestion> => {
    const aggregate = await requireWorkout(p, input.workoutId)
    const item = aggregate.items.find((candidate) => candidate.id === input.itemId)
    if (!item) throw new NotFound('workout-item', input.itemId)

    const previousAll = await p.workouts.previousSetsOf(item.exerciseId, {
      before: aggregate.workout.date,
      exceptWorkoutId: input.workoutId,
    })
    const sameNumber = previousAll[item.sets.length] ?? null

    if (sameNumber) return fromSet(sameNumber, 'previous-workout', sameNumber)

    const lastInThisWorkout = item.sets.at(-1)
    if (lastInThisWorkout) return fromSet(lastInThisWorkout, 'this-workout', null)

    const lastPrevious = previousAll.at(-1)
    if (lastPrevious) return fromSet(lastPrevious, 'previous-workout', null)

    const settings = await p.settings.get()
    const program = await p.programs.byIdWithItems(aggregate.workout.programId)
    const planned = program?.items.find((candidate) => candidate.exerciseId === item.exerciseId)
    if (planned?.targetReps) {
      return {
        value: null,
        unit: settings.unit,
        reps: planned.targetReps,
        source: 'program-target',
        previous: null,
      }
    }

    return { value: null, unit: settings.unit, reps: 0, source: 'empty', previous: null }
  }
