import { id, instant, localDate } from '../../domain/model/types'
import { createServices } from '../container'
import { createFakePorts } from '../testing/fakes'

const at = (iso: string) => instant(Date.parse(iso))
const stamps = { createdAt: at('2026-01-01T00:00:00Z'), updatedAt: at('2026-01-01T00:00:00Z') }

describe('createServices', () => {
  it('связывает сценарии с переданными портами', async () => {
    const ports = createFakePorts({ now: at('2026-08-11T15:32:00Z') })
    const services = createServices(ports)

    const exerciseId = await services.createExercise({ name: 'Жим лёжа' })
    const programId = await services.createProgram({
      name: 'Грудь + трицепс',
      exerciseIds: [exerciseId],
    })
    const workoutId = await services.createWorkout({ date: localDate('2026-08-11'), programId })

    const workout = await ports.workouts.byId(workoutId)
    expect(workout!.items).toHaveLength(1)
    expect(workout!.workout.programName).toBe('Грудь + трицепс')
  })

  it('два контейнера над разными портами не делят состояние', async () => {
    const first = createServices(createFakePorts())
    const second = createServices(createFakePorts())

    await first.createExercise({ name: 'Жим лёжа' })

    expect(await first.ports.exercises.list()).toHaveLength(1)
    expect(await second.ports.exercises.list()).toHaveLength(0)
  })

  it('отдаёт все сценарии, которые нужны экранам', () => {
    const services = createServices(createFakePorts())
    const expected = [
      'createWorkout',
      'addSet',
      'toggleItemDone',
      'addAdHocExercise',
      'editWorkoutTimes',
      'deleteWorkout',
      'suggestNextSet',
      'createExercise',
      'removeExercise',
      'createProgram',
      'duplicateProgram',
      'setProgramItems',
      'archiveProgram',
      'suggestProgramColor',
      'monthStats',
      'exportAll',
      'importAll',
    ]

    for (const name of expected) {
      expect(typeof (services as unknown as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('статистика видит данные, записанные через сценарии', async () => {
    const ports = createFakePorts({ now: at('2026-08-11T15:32:00Z') })
    const services = createServices(ports)

    ports.state.exercises.push({ id: id('e-1'), name: 'Жим лёжа', ...stamps })
    const programId = await services.createProgram({ name: 'Грудь', exerciseIds: [id('e-1')] })
    const workoutId = await services.createWorkout({ date: localDate('2026-08-11'), programId })
    const itemId = (await ports.workouts.byId(workoutId))!.items[0]!.id
    await services.addSet({ workoutId, itemId, weightKg: 80, reps: 8 })
    await services.toggleItemDone({ workoutId, itemId, done: true })

    const stats = await services.monthStats({
      anyDateOfMonth: localDate('2026-08-11'),
      today: localDate('2026-08-11'),
    })

    expect(stats.workouts).toBe(1)
    expect(stats.completionRate).toBe(1)
  })
})
