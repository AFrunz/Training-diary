import { WorkoutDateTaken } from '../../../domain/errors'
import { id, instant, localDate } from '../../../domain/model/types'
import { createFakePorts } from '../../testing/fakes'
import type { FakePorts } from '../../testing/fakes'
import {
  addAdHocExercise,
  addSet,
  createWorkout,
  deleteWorkout,
  editWorkoutTimes,
  suggestNextSet,
  toggleItemDone,
} from '../workouts'

const at = (iso: string) => instant(Date.parse(iso))
const TODAY = localDate('2026-08-11')
const NOW = at('2026-08-11T15:32:00Z') // 18:32 по Москве

/** Программа «Грудь + трицепс» с тремя упражнениями. */
const seed = (ports: FakePorts) => {
  const { state } = ports
  const stamps = { createdAt: at('2026-01-01T00:00:00Z'), updatedAt: at('2026-01-01T00:00:00Z') }
  state.exercises.push(
    { id: id('e-1'), name: 'Жим лёжа', ...stamps },
    { id: id('e-2'), name: 'Жим гантелей под углом', ...stamps },
    { id: id('e-3'), name: 'Разводка гантелей', ...stamps },
    { id: id('e-9'), name: 'Отжимания на брусьях', ...stamps },
  )
  state.programs.push({ id: id('p-1'), name: 'Грудь + трицепс', color: 'prog-red', ...stamps })
  state.programItems.push(
    { id: id('pi-1'), programId: id('p-1'), exerciseId: id('e-1'), order: 0, targetSets: 4, targetReps: 8 },
    { id: id('pi-2'), programId: id('p-1'), exerciseId: id('e-2'), order: 1 },
    { id: id('pi-3'), programId: id('p-1'), exerciseId: id('e-3'), order: 2 },
  )
}

const setup = () => {
  const ports = createFakePorts({ now: NOW })
  seed(ports)
  return ports
}

describe('createWorkout — ключевой сценарий', () => {
  it('копирует состав программы в тренировку с сохранением порядка (FR-3.5)', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })

    const created = await ports.workouts.byId(workoutId)
    expect(created!.items.map((i) => i.exerciseName)).toEqual([
      'Жим лёжа',
      'Жим гантелей под углом',
      'Разводка гантелей',
    ])
    expect(created!.items.map((i) => i.order)).toEqual([0, 1, 2])
  })

  it('сохраняет снапшот названия и цвета программы', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const created = await ports.workouts.byId(workoutId)
    expect(created!.workout.programName).toBe('Грудь + трицепс')
    expect(created!.workout.programColor).toBe('prog-red')
  })

  it('переименование программы после создания не меняет прошлую тренировку', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })

    const program = (await ports.programs.byId(id('p-1')))!
    await ports.programs.update({ ...program, name: 'Другое название' })

    const created = await ports.workouts.byId(workoutId)
    expect(created!.workout.programName).toBe('Грудь + трицепс')
  })

  it('временем начала становится момент создания записи (§5.1)', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    expect((await ports.workouts.byId(workoutId))!.workout.startedAt).toBe(NOW)
  })

  it('упражнения помечаются как программные, а не разовые', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const created = await ports.workouts.byId(workoutId)
    expect(created!.items.every((i) => i.isAdHoc === false)).toBe(true)
  })

  it('пустая программа даёт тренировку без упражнений (FR-3.2)', async () => {
    const ports = setup()
    ports.state.programs.push({
      id: id('p-empty'),
      name: 'Свободная',
      color: 'prog-teal',
      createdAt: NOW,
      updatedAt: NOW,
    })
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-empty') })
    expect((await ports.workouts.byId(workoutId))!.items).toHaveLength(0)
  })
})

describe('createWorkout — одна тренировка в день (FR-1.3)', () => {
  it('вторая тренировка на ту же дату отклоняется', async () => {
    const ports = setup()
    await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await expect(createWorkout(ports)({ date: TODAY, programId: id('p-1') })).rejects.toBeInstanceOf(
      WorkoutDateTaken,
    )
  })

  it('ошибка сообщает идентификатор существующей тренировки, чтобы её можно было открыть', async () => {
    const ports = setup()
    const existing = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await expect(createWorkout(ports)({ date: TODAY, programId: id('p-1') })).rejects.toMatchObject({
      existingId: existing,
    })
  })

  it('неудачная попытка не оставляет мусора в базе', async () => {
    const ports = setup()
    await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await createWorkout(ports)({ date: TODAY, programId: id('p-1') }).catch(() => undefined)
    expect(ports.state.workouts).toHaveLength(1)
    expect(ports.state.workoutItems).toHaveLength(3)
  })

  it('на соседнюю дату тренировка создаётся спокойно', async () => {
    const ports = setup()
    await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await expect(
      createWorkout(ports)({ date: localDate('2026-08-12'), programId: id('p-1') }),
    ).resolves.toBeDefined()
  })

  it('несуществующая программа — ошибка «не найдено»', async () => {
    const ports = setup()
    await expect(
      createWorkout(ports)({ date: TODAY, programId: id('нет-такой') }),
    ).rejects.toMatchObject({ name: 'NotFound' })
  })
})

describe('addSet', () => {
  const withWorkout = async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const items = (await ports.workouts.byId(workoutId))!.items
    return { ports, workoutId, itemId: items[0]!.id }
  }

  it('записывает вес и повторы', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await addSet(ports)({ workoutId, itemId, weightKg: 80, reps: 8 })

    const sets = (await ports.workouts.byId(workoutId))!.items[0]!.sets
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ weightKg: 80, reps: 8, order: 0 })
  })

  it('подход без веса — штатный случай для турника и брусьев', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await addSet(ports)({ workoutId, itemId, weightKg: null, reps: 12 })
    expect((await ports.workouts.byId(workoutId))!.items[0]!.sets[0]!.weightKg).toBeNull()
  })

  it('порядок подходов возрастает', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await addSet(ports)({ workoutId, itemId, weightKg: 80, reps: 8 })
    await addSet(ports)({ workoutId, itemId, weightKg: 80, reps: 8 })
    await addSet(ports)({ workoutId, itemId, weightKg: 82.5, reps: 6 })
    expect((await ports.workouts.byId(workoutId))!.items[0]!.sets.map((s) => s.order)).toEqual([0, 1, 2])
  })

  it('подход пишется сразу, без отдельного «Сохранить» (§7.1)', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await addSet(ports)({ workoutId, itemId, weightKg: 80, reps: 8 })
    expect(ports.state.workoutSets).toHaveLength(1)
  })

  it('нулевые повторы отклоняются', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await expect(addSet(ports)({ workoutId, itemId, weightKg: 80, reps: 0 })).rejects.toMatchObject({
      code: 'reps-not-positive-integer',
    })
  })

  it('отрицательный вес отклоняется и ничего не записывает', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await addSet(ports)({ workoutId, itemId, weightKg: -10, reps: 8 }).catch(() => undefined)
    expect(ports.state.workoutSets).toHaveLength(0)
  })

  it('подход к чужому упражнению не записывается', async () => {
    const { ports, workoutId } = await withWorkout()
    await expect(
      addSet(ports)({ workoutId, itemId: id('нет-такого'), weightKg: 80, reps: 8 }),
    ).rejects.toMatchObject({ name: 'NotFound' })
  })
})

describe('toggleItemDone (FR-4.5)', () => {
  const withWorkout = async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const items = (await ports.workouts.byId(workoutId))!.items
    return { ports, workoutId, itemId: items[0]!.id, secondItemId: items[1]!.id }
  }

  it('отметка проставляет время по часам', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    ports.clock.advance(72 * 60 * 1000)
    await toggleItemDone(ports)({ workoutId, itemId, done: true })

    const item = (await ports.workouts.byId(workoutId))!.items[0]!
    expect(item.completedAt).toBe(at('2026-08-11T16:44:00Z'))
  })

  it('снятие отметки удаляет время, а не оставляет его', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await toggleItemDone(ports)({ workoutId, itemId, done: true })
    await toggleItemDone(ports)({ workoutId, itemId, done: false })
    expect((await ports.workouts.byId(workoutId))!.items[0]!.completedAt).toBeNull()
  })

  it('повторная отметка не сдвигает уже проставленное время', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await toggleItemDone(ports)({ workoutId, itemId, done: true })
    const first = (await ports.workouts.byId(workoutId))!.items[0]!.completedAt
    ports.clock.advance(10 * 60 * 1000)
    await toggleItemDone(ports)({ workoutId, itemId, done: true })
    expect((await ports.workouts.byId(workoutId))!.items[0]!.completedAt).toBe(first)
  })

  it('окончанием тренировки становится последняя отметка', async () => {
    const { ports, workoutId, itemId, secondItemId } = await withWorkout()
    await toggleItemDone(ports)({ workoutId, itemId, done: true })
    ports.clock.advance(15 * 60 * 1000)
    await toggleItemDone(ports)({ workoutId, itemId: secondItemId, done: true })

    expect((await ports.workouts.byId(workoutId))!.workout.finishedAt).toBe(at('2026-08-11T15:47:00Z'))
  })

  it('снятие последней отметки откатывает окончание к предыдущей', async () => {
    const { ports, workoutId, itemId, secondItemId } = await withWorkout()
    await toggleItemDone(ports)({ workoutId, itemId, done: true })
    ports.clock.advance(15 * 60 * 1000)
    await toggleItemDone(ports)({ workoutId, itemId: secondItemId, done: true })
    await toggleItemDone(ports)({ workoutId, itemId: secondItemId, done: false })

    expect((await ports.workouts.byId(workoutId))!.workout.finishedAt).toBe(NOW)
  })

  it('снятие единственной отметки обнуляет окончание', async () => {
    const { ports, workoutId, itemId } = await withWorkout()
    await toggleItemDone(ports)({ workoutId, itemId, done: true })
    await toggleItemDone(ports)({ workoutId, itemId, done: false })
    expect((await ports.workouts.byId(workoutId))!.workout.finishedAt).toBeNull()
  })
})

describe('addAdHocExercise (FR-4.6)', () => {
  it('упражнение добавляется в конец и помечается как разовое', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await addAdHocExercise(ports)({ workoutId, exerciseId: id('e-9') })

    const items = (await ports.workouts.byId(workoutId))!.items
    expect(items).toHaveLength(4)
    expect(items[3]).toMatchObject({ exerciseName: 'Отжимания на брусьях', isAdHoc: true, order: 3 })
  })

  it('одно и то же упражнение нельзя добавить в тренировку дважды', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await expect(addAdHocExercise(ports)({ workoutId, exerciseId: id('e-1') })).rejects.toMatchObject({
      code: 'exercise-duplicate-in-program',
    })
  })
})

describe('editWorkoutTimes (FR-4.7)', () => {
  const withWorkout = async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    return { ports, workoutId }
  }

  it('сохраняет ручные границы', async () => {
    const { ports, workoutId } = await withWorkout()
    await editWorkoutTimes(ports)({
      workoutId,
      manualStartedAt: at('2026-08-11T15:00:00Z'),
      manualFinishedAt: at('2026-08-11T16:15:00Z'),
    })
    const workout = (await ports.workouts.byId(workoutId))!.workout
    expect(workout.manualStartedAt).toBe(at('2026-08-11T15:00:00Z'))
    expect(workout.manualFinishedAt).toBe(at('2026-08-11T16:15:00Z'))
  })

  it('конец раньше начала отклоняется (§5.1)', async () => {
    const { ports, workoutId } = await withWorkout()
    await expect(
      editWorkoutTimes(ports)({
        workoutId,
        manualStartedAt: at('2026-08-11T17:00:00Z'),
        manualFinishedAt: at('2026-08-11T16:00:00Z'),
      }),
    ).rejects.toMatchObject({ code: 'range-inverted' })
  })

  it('сброс ручных значений возвращает к вычисленным', async () => {
    const { ports, workoutId } = await withWorkout()
    await editWorkoutTimes(ports)({
      workoutId,
      manualStartedAt: at('2026-08-11T15:00:00Z'),
      manualFinishedAt: at('2026-08-11T16:15:00Z'),
    })
    await editWorkoutTimes(ports)({ workoutId, manualStartedAt: null, manualFinishedAt: null })

    const workout = (await ports.workouts.byId(workoutId))!.workout
    expect(workout.manualStartedAt).toBeNull()
    expect(workout.startedAt).toBe(NOW)
  })
})

describe('deleteWorkout', () => {
  it('удаляет тренировку вместе с упражнениями и подходами', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const itemId = (await ports.workouts.byId(workoutId))!.items[0]!.id
    await addSet(ports)({ workoutId, itemId, weightKg: 80, reps: 8 })

    await deleteWorkout(ports)(workoutId)

    expect(ports.state.workouts).toHaveLength(0)
    expect(ports.state.workoutItems).toHaveLength(0)
    expect(ports.state.workoutSets).toHaveLength(0)
  })

  it('справочник упражнений при этом не страдает', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await deleteWorkout(ports)(workoutId)
    expect(ports.state.exercises).toHaveLength(4)
  })

  it('после удаления дата снова свободна', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    await deleteWorkout(ports)(workoutId)
    await expect(createWorkout(ports)({ date: TODAY, programId: id('p-1') })).resolves.toBeDefined()
  })
})

describe('suggestNextSet — предзаполнение полей (FR-4.4)', () => {
  it('берёт последний подход этого упражнения в текущей тренировке', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const itemId = (await ports.workouts.byId(workoutId))!.items[0]!.id
    await addSet(ports)({ workoutId, itemId, weightKg: 80, reps: 8 })
    await addSet(ports)({ workoutId, itemId, weightKg: 82.5, reps: 6 })

    await expect(suggestNextSet(ports)({ workoutId, itemId })).resolves.toMatchObject({
      weightKg: 82.5,
      reps: 6,
      source: 'this-workout',
    })
  })

  it('если в этой тренировке подходов ещё нет — берёт из прошлой', async () => {
    const ports = setup()
    const previous = await createWorkout(ports)({ date: localDate('2026-08-07'), programId: id('p-1') })
    const previousItemId = (await ports.workouts.byId(previous))!.items[0]!.id
    await addSet(ports)({ workoutId: previous, itemId: previousItemId, weightKg: 80, reps: 8 })

    const today = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const itemId = (await ports.workouts.byId(today))!.items[0]!.id

    await expect(suggestNextSet(ports)({ workoutId: today, itemId })).resolves.toMatchObject({
      weightKg: 80,
      reps: 8,
      source: 'previous-workout',
    })
  })

  it('упражнение делается впервые — подставляется план из программы', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const itemId = (await ports.workouts.byId(workoutId))!.items[0]!.id

    await expect(suggestNextSet(ports)({ workoutId, itemId })).resolves.toMatchObject({
      weightKg: null,
      reps: 8,
      source: 'program-target',
    })
  })

  it('ни истории, ни плана — пустые поля, а не выдуманные числа', async () => {
    const ports = setup()
    const workoutId = await createWorkout(ports)({ date: TODAY, programId: id('p-1') })
    const itemId = (await ports.workouts.byId(workoutId))!.items[1]!.id

    await expect(suggestNextSet(ports)({ workoutId, itemId })).resolves.toMatchObject({
      weightKg: null,
      source: 'empty',
    })
  })
})
