import type { Exercise, Program, Workout, WorkoutItem, WorkoutSet } from '../../../domain/model/entities'
import { id, instant, localDate } from '../../../domain/model/types'
import { applyMigrations } from '../migrations'
import { createSqliteRepositories } from '../repositories'
import type { DataPorts } from '../repositories'
import { createNodeSqlDriver } from '../testing/nodeSqlite'

const at = (iso: string) => instant(Date.parse(iso))
const d = (s: string) => localDate(s)
const stamps = { createdAt: at('2026-01-01T00:00:00Z'), updatedAt: at('2026-01-01T00:00:00Z') }

const exercise = (n: number, name: string): Exercise => ({ id: id(`e-${n}`), name, ...stamps })

const program = (): Program => ({
  id: id('p-1'),
  name: 'Грудь + трицепс',
  color: 'prog-red',
  ...stamps,
})

const workout = (over: Partial<Workout> & Pick<Workout, 'id' | 'date'>): Workout => ({
  programId: id('p-1'),
  programName: 'Грудь + трицепс',
  programColor: 'prog-red',
  startedAt: at('2026-08-11T15:32:00Z'),
  ...stamps,
  ...over,
})

const item = (over: Partial<WorkoutItem> & Pick<WorkoutItem, 'id' | 'workoutId'>): WorkoutItem => ({
  exerciseId: id('e-1'),
  exerciseName: 'Жим лёжа',
  order: 0,
  isAdHoc: false,
  ...over,
})

const set = (over: Partial<WorkoutSet> & Pick<WorkoutSet, 'id' | 'workoutItemId'>): WorkoutSet => ({
  order: 0,
  weightKg: 80,
  reps: 8,
  createdAt: at('2026-08-11T15:40:00Z'),
  ...over,
})

const setup = async (): Promise<DataPorts> => {
  const driver = createNodeSqlDriver()
  await applyMigrations(driver)
  const repos = createSqliteRepositories(driver)
  await repos.exercises.insert(exercise(1, 'Жим лёжа'))
  await repos.exercises.insert(exercise(2, 'Жим гантелей под углом'))
  await repos.programs.insert(program(), [
    { id: id('pi-1'), programId: id('p-1'), exerciseId: id('e-1'), order: 0 },
  ])
  return repos
}

describe('WorkoutRepo — ограничения базы', () => {
  it('вторая тренировка на ту же дату отвергается самой базой, а не только кодом (FR-1.3)', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [])

    await expect(
      repos.workouts.insert(workout({ id: id('w-2'), date: d('2026-08-11') }), []),
    ).rejects.toThrow()
  })

  it('удаление тренировки уносит упражнения и подходы каскадом', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
      item({ id: id('wi-1'), workoutId: id('w-1') }),
    ])
    await repos.workouts.addSet(set({ id: id('ws-1'), workoutItemId: id('wi-1') }))

    await repos.workouts.remove(id('w-1'))

    expect(await repos.workouts.byId(id('w-1'))).toBeNull()
  })

  it('удаление тренировки не трогает справочник упражнений', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
      item({ id: id('wi-1'), workoutId: id('w-1') }),
    ])
    await repos.workouts.remove(id('w-1'))

    expect(await repos.exercises.list()).toHaveLength(2)
  })

  it('одно упражнение не может быть в тренировке дважды', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
      item({ id: id('wi-1'), workoutId: id('w-1'), exerciseId: id('e-1') }),
    ])

    await expect(
      repos.workouts.addItem(item({ id: id('wi-2'), workoutId: id('w-1'), exerciseId: id('e-1') })),
    ).rejects.toThrow()
  })
})

describe('WorkoutRepo — чтение', () => {
  const seeded = async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
      item({ id: id('wi-2'), workoutId: id('w-1'), exerciseId: id('e-2'), order: 1, exerciseName: 'Жим гантелей под углом' }),
      item({ id: id('wi-1'), workoutId: id('w-1'), exerciseId: id('e-1'), order: 0 }),
    ])
    await repos.workouts.addSet(set({ id: id('ws-2'), workoutItemId: id('wi-1'), order: 1, weightKg: 82.5, reps: 6 }))
    await repos.workouts.addSet(set({ id: id('ws-1'), workoutItemId: id('wi-1'), order: 0 }))
    return repos
  }

  it('упражнения и подходы возвращаются в заданном порядке, а не в порядке вставки', async () => {
    const repos = await seeded()
    const aggregate = (await repos.workouts.byId(id('w-1')))!

    expect(aggregate.items.map((i) => i.id)).toEqual(['wi-1', 'wi-2'])
    expect(aggregate.items[0]!.sets.map((s) => s.id)).toEqual(['ws-1', 'ws-2'])
  })

  it('дробный вес не теряет точность при обходе базы', async () => {
    const repos = await seeded()
    const aggregate = (await repos.workouts.byId(id('w-1')))!
    expect(aggregate.items[0]!.sets[1]!.weightKg).toBe(82.5)
  })

  it('пустой вес читается как null, а не как ноль', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
      item({ id: id('wi-1'), workoutId: id('w-1') }),
    ])
    await repos.workouts.addSet(set({ id: id('ws-1'), workoutItemId: id('wi-1'), weightKg: null, reps: 12 }))

    const aggregate = (await repos.workouts.byId(id('w-1')))!
    expect(aggregate.items[0]!.sets[0]!.weightKg).toBeNull()
  })

  it('логический флаг возвращается булевым, а не единицей', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
      item({ id: id('wi-1'), workoutId: id('w-1'), isAdHoc: true }),
    ])

    expect((await repos.workouts.byId(id('w-1')))!.items[0]!.isAdHoc).toBe(true)
  })

  it('несуществующая тренировка — null, а не исключение', async () => {
    const repos = await setup()
    expect(await repos.workouts.byId(id('нет'))).toBeNull()
  })

  it('выборка по диапазону включает границы', async () => {
    const repos = await setup()
    for (const date of ['2026-07-31', '2026-08-01', '2026-08-15', '2026-08-31', '2026-09-01']) {
      await repos.workouts.insert(workout({ id: id(`w-${date}`), date: d(date) }), [])
    }

    const found = await repos.workouts.listRange({ from: d('2026-08-01'), to: d('2026-08-31') })
    expect(found.map((w) => w.date)).toEqual(['2026-08-01', '2026-08-15', '2026-08-31'])
  })

  it('lastSetOf берёт подход из самой свежей тренировки', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-old'), date: d('2026-08-03') }), [
      item({ id: id('wi-old'), workoutId: id('w-old') }),
    ])
    await repos.workouts.addSet(set({ id: id('ws-old'), workoutItemId: id('wi-old'), weightKg: 75, reps: 8 }))

    await repos.workouts.insert(workout({ id: id('w-new'), date: d('2026-08-07') }), [
      item({ id: id('wi-new'), workoutId: id('w-new') }),
    ])
    await repos.workouts.addSet(set({ id: id('ws-new'), workoutItemId: id('wi-new'), weightKg: 80, reps: 8 }))

    const last = await repos.workouts.lastSetOf(id('e-1'))
    expect(last!.weightKg).toBe(80)
  })

  it('lastSetOf умеет исключать текущую тренировку', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-old'), date: d('2026-08-03') }), [
      item({ id: id('wi-old'), workoutId: id('w-old') }),
    ])
    await repos.workouts.addSet(set({ id: id('ws-old'), workoutItemId: id('wi-old'), weightKg: 75, reps: 8 }))
    await repos.workouts.insert(workout({ id: id('w-now'), date: d('2026-08-11') }), [
      item({ id: id('wi-now'), workoutId: id('w-now') }),
    ])
    await repos.workouts.addSet(set({ id: id('ws-now'), workoutItemId: id('wi-now'), weightKg: 82.5, reps: 6 }))

    const last = await repos.workouts.lastSetOf(id('e-1'), { exceptWorkoutId: id('w-now') })
    expect(last!.weightKg).toBe(75)
  })

  it('упражнение без истории — null', async () => {
    const repos = await setup()
    expect(await repos.workouts.lastSetOf(id('e-2'))).toBeNull()
  })
})

describe('ExerciseRepo', () => {
  it('архивные упражнения не попадают в обычный список', async () => {
    const repos = await setup()
    await repos.exercises.update({ ...exercise(1, 'Жим лёжа'), archivedAt: at('2026-08-11T00:00:00Z') })

    expect((await repos.exercises.list()).map((e) => e.id)).toEqual(['e-2'])
    expect(await repos.exercises.list({ includeArchived: true })).toHaveLength(2)
  })

  it('isUsed различает упражнение из тренировки и свободное', async () => {
    const repos = await setup()
    await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
      item({ id: id('wi-1'), workoutId: id('w-1'), exerciseId: id('e-1') }),
    ])

    expect(await repos.exercises.isUsed(id('e-1'))).toBe(true)
    expect(await repos.exercises.isUsed(id('e-2'))).toBe(false)
  })

  it('упражнение из состава программы нельзя удалить физически', async () => {
    const repos = await setup()
    await expect(repos.exercises.remove(id('e-1'))).rejects.toThrow()
  })
})

describe('UnitOfWork', () => {
  it('при ошибке внутри транзакции не остаётся ни одной записи', async () => {
    const repos = await setup()

    await repos.uow
      .tx(async () => {
        await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
          item({ id: id('wi-1'), workoutId: id('w-1') }),
        ])
        throw new Error('сбой посреди сценария')
      })
      .catch(() => undefined)

    expect(await repos.workouts.byId(id('w-1'))).toBeNull()
  })

  it('успешная транзакция сохраняет всё разом', async () => {
    const repos = await setup()

    await repos.uow.tx(async () => {
      await repos.workouts.insert(workout({ id: id('w-1'), date: d('2026-08-11') }), [
        item({ id: id('wi-1'), workoutId: id('w-1') }),
      ])
    })

    expect((await repos.workouts.byId(id('w-1')))!.items).toHaveLength(1)
  })
})

describe('производительность на реальном объёме (§7.1)', () => {
  /** Пять лет по четыре тренировки в неделю: ~1000 тренировок и ~20 000 подходов. */
  const seedLarge = async (repos: DataPorts) => {
    await repos.uow.tx(async () => {
      let day = Date.parse('2021-08-11T00:00:00Z')
      for (let w = 0; w < 1000; w++) {
        const date = new Date(day).toISOString().slice(0, 10)
        const workoutId = id(`w-${w}`)
        await repos.workouts.insert(
          workout({ id: workoutId, date: d(date), startedAt: instant(day) }),
          [item({ id: id(`wi-${w}`), workoutId })],
        )
        for (let s = 0; s < 20; s++) {
          await repos.workouts.addSet(
            set({ id: id(`ws-${w}-${s}`), workoutItemId: id(`wi-${w}`), order: s }),
          )
        }
        day += 2 * 24 * 60 * 60 * 1000
      }
    })
  }

  it('месяц календаря читается быстрее 300 мс', async () => {
    const repos = await setup()
    await seedLarge(repos)

    const started = performance.now()
    await repos.workouts.listRange({ from: d('2024-03-01'), to: d('2024-03-31') })
    expect(performance.now() - started).toBeLessThan(300)
  }, 120_000)

  it('открытие тренировки со всеми подходами быстрее 100 мс', async () => {
    const repos = await setup()
    await seedLarge(repos)

    const started = performance.now()
    await repos.workouts.byId(id('w-500'))
    expect(performance.now() - started).toBeLessThan(100)
  }, 120_000)
})
