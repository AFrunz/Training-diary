import { NotFound, ValidationFailed, WorkoutDateTaken } from '../../domain/errors'
import type { WorkoutItem, WorkoutSet } from '../../domain/model/entities'
import type { Id, Instant, LocalDate, WeightKg } from '../../domain/model/types'
import { deriveFinishedAt } from '../../domain/rules/duration'
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
  readonly weightKg?: WeightKg | null
  readonly reps: number
}

/** Добавление подхода (FR-4.4). Вес необязателен. Пишется сразу, без кнопки «Сохранить». */
export const addSet = (p: Ports) => async (input: AddSetInput): Promise<Id> => {
  const check = validateSet({ weightKg: input.weightKg ?? null, reps: input.reps })
  if (!check.ok) throw new ValidationFailed(check.code)

  const aggregate = await requireWorkout(p, input.workoutId)
  const item = aggregate.items.find((candidate) => candidate.id === input.itemId)
  if (!item) throw new NotFound('workout-item', input.itemId)

  const set: WorkoutSet = {
    id: p.ids.uuid(),
    workoutItemId: item.id,
    order: item.sets.length,
    weightKg: input.weightKg ?? null,
    reps: input.reps,
    createdAt: p.clock.now(),
  }
  await p.workouts.addSet(set)
  return set.id
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

export interface SetSuggestion {
  readonly weightKg: WeightKg | null
  readonly reps: number
  readonly source: 'this-workout' | 'previous-workout' | 'program-target' | 'empty'
}

/**
 * Предзаполнение полей нового подхода (FR-4.4): сначала предыдущий подход этого
 * упражнения в текущей тренировке, иначе — из прошлой тренировки, иначе — план программы.
 */
export const suggestNextSet =
  (p: Ports) =>
  async (input: { readonly workoutId: Id; readonly itemId: Id }): Promise<SetSuggestion> => {
    const aggregate = await requireWorkout(p, input.workoutId)
    const item = aggregate.items.find((candidate) => candidate.id === input.itemId)
    if (!item) throw new NotFound('workout-item', input.itemId)

    const lastInThisWorkout = item.sets.at(-1)
    if (lastInThisWorkout) {
      return {
        weightKg: lastInThisWorkout.weightKg ?? null,
        reps: lastInThisWorkout.reps,
        source: 'this-workout',
      }
    }

    const previous = await p.workouts.lastSetOf(item.exerciseId, { exceptWorkoutId: input.workoutId })
    if (previous) {
      return { weightKg: previous.weightKg ?? null, reps: previous.reps, source: 'previous-workout' }
    }

    const program = await p.programs.byIdWithItems(aggregate.workout.programId)
    const planned = program?.items.find((candidate) => candidate.exerciseId === item.exerciseId)
    if (planned?.targetReps) {
      return { weightKg: null, reps: planned.targetReps, source: 'program-target' }
    }

    return { weightKg: null, reps: 0, source: 'empty' }
  }
