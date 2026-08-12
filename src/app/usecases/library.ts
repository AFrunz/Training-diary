import { NotFound, ValidationFailed } from '../../domain/errors'
import type { ProgramItem } from '../../domain/model/entities'
import type { Id } from '../../domain/model/types'
import {
  validateExerciseName,
  validateProgramItems,
  validateProgramName,
} from '../../domain/validation/rules'
import type { Ports } from '../ports'

/** Сценарии библиотеки: упражнения и программы. */

/** Палитра из §7.3 ТЗ: восемь различимых цветов. */
export const PROGRAM_PALETTE = [
  'prog-red',
  'prog-orange',
  'prog-amber',
  'prog-green',
  'prog-teal',
  'prog-blue',
  'prog-violet',
  'prog-pink',
] as const

/** Создание упражнения (FR-2.1.1): имя обязательное и уникальное без учёта регистра. */
export const createExercise =
  (p: Ports) =>
  async (input: {
    readonly name: string
    readonly muscleGroup?: string | null
    readonly note?: string | null
  }): Promise<Id> => {
    // архивные упражнения тоже занимают имя, иначе появятся два «Жима лёжа»
    const existing = await p.exercises.list({ includeArchived: true })
    const check = validateExerciseName(
      input.name,
      existing.map((exercise) => exercise.name),
    )
    if (!check.ok) throw new ValidationFailed(check.code)

    const now = p.clock.now()
    const exerciseId = p.ids.uuid()
    await p.exercises.insert({
      id: exerciseId,
      name: input.name.trim(),
      muscleGroup: input.muscleGroup ?? null,
      note: input.note ?? null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    return exerciseId
  }

/**
 * Удаление упражнения (FR-2.4): использованное в тренировках только архивируется,
 * неиспользованное удаляется по-настоящему.
 */
export const removeExercise = (p: Ports) => async (id: Id): Promise<'archived' | 'deleted'> => {
  const exercise = await p.exercises.byId(id)
  if (!exercise) throw new NotFound('exercise', id)

  if (await p.exercises.isUsed(id)) {
    await p.exercises.update({ ...exercise, archivedAt: p.clock.now(), updatedAt: p.clock.now() })
    return 'archived'
  }

  await p.exercises.remove(id)
  return 'deleted'
}

/** Первый цвет палитры, не занятый действующими программами (FR-3.1.1). */
export const suggestProgramColor = (p: Ports) => async (): Promise<string> => {
  const programs = await p.programs.list()
  const taken = new Set(programs.map((program) => program.color))
  // когда заняты все восемь, цвета начинают повторяться — это допустимо (§7.3)
  return PROGRAM_PALETTE.find((color) => !taken.has(color)) ?? PROGRAM_PALETTE[0]
}

export const createProgram =
  (p: Ports) =>
  async (input: {
    readonly name: string
    readonly color?: string
    readonly exerciseIds?: readonly Id[]
  }): Promise<Id> => {
    const nameCheck = validateProgramName(input.name)
    if (!nameCheck.ok) throw new ValidationFailed(nameCheck.code)

    const exerciseIds = input.exerciseIds ?? []
    const itemsCheck = validateProgramItems(exerciseIds)
    if (!itemsCheck.ok) throw new ValidationFailed(itemsCheck.code)

    const now = p.clock.now()
    const programId = p.ids.uuid()
    const color = input.color ?? (await suggestProgramColor(p)())

    const items: ProgramItem[] = exerciseIds.map((exerciseId, index) => ({
      id: p.ids.uuid(),
      programId,
      exerciseId,
      order: index,
    }))

    await p.uow.tx(async () => {
      await p.programs.insert(
        { id: programId, name: input.name.trim(), color, archivedAt: null, createdAt: now, updatedAt: now },
        items,
      )
    })
    return programId
  }

/** Дублирование программы (FR-3.6): состав копируется, к названию добавляется «(копия)». */
export const duplicateProgram = (p: Ports) => async (id: Id): Promise<Id> => {
  const source = await p.programs.byIdWithItems(id)
  if (!source) throw new NotFound('program', id)

  return createProgram(p)({
    name: `${source.program.name} (копия)`,
    exerciseIds: source.items.map((item) => item.exerciseId),
  })
}

/** Полная замена состава программы с сохранением порядка (FR-3.1). */
export const setProgramItems =
  (p: Ports) =>
  async (input: { readonly programId: Id; readonly exerciseIds: readonly Id[] }): Promise<void> => {
    const program = await p.programs.byId(input.programId)
    if (!program) throw new NotFound('program', input.programId)

    const check = validateProgramItems(input.exerciseIds)
    if (!check.ok) throw new ValidationFailed(check.code)

    const items: ProgramItem[] = input.exerciseIds.map((exerciseId, index) => ({
      id: p.ids.uuid(),
      programId: input.programId,
      exerciseId,
      order: index,
    }))

    await p.uow.tx(async () => {
      await p.programs.replaceItems(input.programId, items)
      await p.programs.update({ ...program, updatedAt: p.clock.now() })
    })
  }

export const archiveProgram = (p: Ports) => async (id: Id): Promise<void> => {
  const program = await p.programs.byId(id)
  if (!program) throw new NotFound('program', id)
  await p.programs.update({ ...program, archivedAt: p.clock.now(), updatedAt: p.clock.now() })
}
