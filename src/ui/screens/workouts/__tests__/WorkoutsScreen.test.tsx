import { act, fireEvent, screen, within } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import type { FakePorts } from '../../../../app/testing/fakes'
import type { Id } from '../../../../domain/model/types'
import { instant, localDate } from '../../../../domain/model/types'
import type { CompletionTone } from '../../../../domain/rules/completion'
import { computeCompletion } from '../../../../domain/rules/completion'
import { Donut } from '../../../components/Donut'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { WorkoutsScreen } from '../WorkoutsScreen'

/** Фейковые часы стоят на 11 августа 2026, 18:32 по Москве — как в макете. */
const NOW = '2026-08-11T15:32:00Z'
const at = (iso: string) => instant(Date.parse(iso))

interface World {
  readonly services: Services
  readonly ports: FakePorts
  readonly chest: Id
  readonly back: Id
}

const buildWorld = async (): Promise<World> => {
  const { services, ports } = createTestServices()
  const press = await services.createExercise({ name: 'Жим лёжа' })
  const fly = await services.createExercise({ name: 'Разводка гантелей' })
  const dip = await services.createExercise({ name: 'Отжимания на брусьях' })

  const chest = await services.createProgram({
    name: 'Грудь + трицепс',
    color: 'prog-red',
    exerciseIds: [press, fly, dip],
  })
  const back = await services.createProgram({
    name: 'Спина + бицепс',
    color: 'prog-blue',
    exerciseIds: [press, fly, dip],
  })

  return { services, ports, chest, back }
}

/**
 * Заводит тренировку так, как это сделал бы пользователь: сценариями и с
 * переводом часов, иначе длительность окажется «задним числом».
 */
const addWorkout = async (
  world: World,
  input: {
    readonly date: string
    readonly programId: Id
    readonly done: number
    readonly startedAt?: string
    readonly finishedAt?: string
  },
): Promise<Id> => {
  const { services, ports } = world

  ports.clock.set(at(input.startedAt ?? NOW))
  const workoutId = await services.createWorkout({
    date: localDate(input.date),
    programId: input.programId,
  })

  const aggregate = await ports.workouts.byId(workoutId)
  ports.clock.set(at(input.finishedAt ?? input.startedAt ?? NOW))

  for (const item of (aggregate?.items ?? []).slice(0, input.done)) {
    await services.addSet({ workoutId, itemId: item.id, weightKg: 60, reps: 8 })
    await services.toggleItemDone({ workoutId, itemId: item.id, done: true })
  }

  ports.clock.set(at(NOW))
  return workoutId
}

/** Эталонный цвет дуги для тона: сравниваем с ним, а не с пикселями. */
const strokeOfTone = (tone: CompletionTone): unknown => {
  const view = render(<Donut done={1} total={2} tone={tone} />)
  const stroke: unknown = view.getByTestId('workout-donut-arc').props.stroke
  view.unmount()
  return stroke
}

/** TanStack Query рассылает обновления через таймер: даём им приземлиться внутри act. */
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

describe('Экран «Тренировки»', () => {
  it('показывает карточки прошлых тренировок с датой, программой и длительностью', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-08-07',
      programId: world.chest,
      done: 3,
      startedAt: '2026-08-07T09:00:00Z',
      finishedAt: '2026-08-07T10:08:00Z',
    })
    await addWorkout(world, {
      date: '2026-08-05',
      programId: world.back,
      done: 3,
      startedAt: '2026-08-05T09:00:00Z',
      finishedAt: '2026-08-05T09:47:00Z',
    })

    render(<WorkoutsScreen />, { services: world.services })

    expect(await screen.findByTestId('workout-card-2026-08-07')).toBeTruthy()
    expect(screen.getByTestId('workout-card-2026-08-05')).toBeTruthy()
    expect(screen.getByTestId('workout-meta-2026-08-07')).toHaveTextContent('7 августа · 1 ч 08 мин')
    expect(screen.getByTestId('workout-meta-2026-08-05')).toHaveTextContent('5 августа · 47 мин')
    expect(within(screen.getByTestId('workout-card-2026-08-07')).getByText('Грудь + трицепс')).toBeTruthy()
    expect(within(screen.getByTestId('workout-card-2026-08-05')).getByText('Спина + бицепс')).toBeTruthy()
  })

  it('свежая тренировка идёт первой в ленте', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-08-03',
      programId: world.chest,
      done: 3,
      startedAt: '2026-08-03T09:00:00Z',
      finishedAt: '2026-08-03T10:00:00Z',
    })
    await addWorkout(world, {
      date: '2026-08-09',
      programId: world.back,
      done: 3,
      startedAt: '2026-08-09T09:00:00Z',
      finishedAt: '2026-08-09T10:00:00Z',
    })

    render(<WorkoutsScreen />, { services: world.services })
    await screen.findByTestId('workout-card-2026-08-09')

    const dates = screen
      .getAllByTestId(/^workout-card-/)
      .map((card): unknown => card.props.testID)
    expect(dates).toEqual(['workout-card-2026-08-09', 'workout-card-2026-08-03'])
  })

  it('цвет бублика соответствует тону завершённости', async () => {
    const success = strokeOfTone('success')
    const warning = strokeOfTone('warning')
    const danger = strokeOfTone('danger')

    const world = await buildWorld()
    for (const [date, done] of [
      ['2026-08-03', 3],
      ['2026-08-05', 2],
      ['2026-08-07', 1],
    ] as const) {
      await addWorkout(world, {
        date,
        programId: world.chest,
        done,
        startedAt: `${date}T09:00:00Z`,
        finishedAt: `${date}T10:00:00Z`,
      })
    }

    render(<WorkoutsScreen />, { services: world.services })
    await screen.findByTestId('workout-card-2026-08-03')

    const toneOf = (done: number) =>
      computeCompletion(
        Array.from({ length: 3 }, (_, index) => ({
          completedAt: index < done ? instant(0) : null,
          setCount: index < done ? 1 : 0,
        })),
      ).tone

    expect(toneOf(3)).toBe('success')
    expect(toneOf(2)).toBe('warning')
    expect(toneOf(1)).toBe('danger')

    const strokeOf = (date: string): unknown =>
      screen.getByTestId(`workout-donut-${date}-arc`).props.stroke

    expect(strokeOf('2026-08-03')).toEqual(success)
    expect(strokeOf('2026-08-05')).toEqual(warning)
    expect(strokeOf('2026-08-07')).toEqual(danger)
  })

  it('фильтр по программе прячет чужие тренировки', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-08-07',
      programId: world.chest,
      done: 3,
      startedAt: '2026-08-07T09:00:00Z',
      finishedAt: '2026-08-07T10:00:00Z',
    })
    await addWorkout(world, {
      date: '2026-08-05',
      programId: world.back,
      done: 3,
      startedAt: '2026-08-05T09:00:00Z',
      finishedAt: '2026-08-05T10:00:00Z',
    })

    render(<WorkoutsScreen />, { services: world.services })
    await screen.findByTestId('workout-card-2026-08-07')

    fireEvent.press(await screen.findByTestId(`filter-chip-${world.back}`))

    expect(screen.queryByTestId('workout-card-2026-08-07')).toBeNull()
    expect(screen.getByTestId('workout-card-2026-08-05')).toBeTruthy()

    fireEvent.press(screen.getByTestId('filter-chip-all'))
    expect(screen.getByTestId('workout-card-2026-08-07')).toBeTruthy()
  })

  it('«Идёт» получает только сегодняшняя незавершённая тренировка', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-07-31',
      programId: world.chest,
      done: 1,
      startedAt: '2026-07-31T09:00:00Z',
      finishedAt: '2026-07-31T09:22:00Z',
    })
    await addWorkout(world, {
      date: '2026-08-11',
      programId: world.back,
      done: 1,
      startedAt: '2026-08-11T14:20:00Z',
      finishedAt: '2026-08-11T15:00:00Z',
    })

    render(<WorkoutsScreen />, { services: world.services })

    const active = await screen.findByTestId('active-workout-card')
    expect(within(active).getByText('Идёт')).toBeTruthy()
    expect(within(active).getByText('Спина + бицепс')).toBeTruthy()
    // сегодняшняя ушла в закреплённую карточку и в ленту не попала
    expect(screen.queryByTestId('workout-card-2026-08-11')).toBeNull()
    expect(screen.getAllByText('Идёт')).toHaveLength(1)
    expect(within(screen.getByTestId('workout-card-2026-07-31')).getByText('не завершена')).toBeTruthy()
  })

  it('завершённая сегодняшняя тренировка не считается активной', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-08-11',
      programId: world.chest,
      done: 3,
      startedAt: '2026-08-11T13:00:00Z',
      finishedAt: '2026-08-11T14:00:00Z',
    })

    render(<WorkoutsScreen />, { services: world.services })

    expect(await screen.findByTestId('workout-card-2026-08-11')).toBeTruthy()
    expect(screen.queryByTestId('active-workout-card')).toBeNull()
  })

  it('без тренировок показывает пустое состояние', async () => {
    const world = await buildWorld()
    render(<WorkoutsScreen />, { services: world.services })

    expect(await screen.findByTestId('workouts-empty')).toBeTruthy()
    expect(screen.getByText('Тренировок пока нет')).toBeTruthy()
  })

  it('недостоверная длительность показывается как «—»', async () => {
    const world = await buildWorld()
    // заведена задним числом: часы стоят на сегодня, а дата — прошлая
    await addWorkout(world, { date: '2026-08-04', programId: world.chest, done: 3 })

    render(<WorkoutsScreen />, { services: world.services })

    expect(await screen.findByTestId('workout-meta-2026-08-04')).toHaveTextContent('4 августа · —')
  })

  it('кнопка «＋» сообщает о создании тренировки', async () => {
    const world = await buildWorld()
    const onCreateWorkout = jest.fn()
    render(<WorkoutsScreen onCreateWorkout={onCreateWorkout} />, { services: world.services })
    await screen.findByTestId(`filter-chip-${world.chest}`)

    fireEvent.press(screen.getByTestId('add-button'))
    expect(onCreateWorkout).toHaveBeenCalled()
  })

  it('ряд фильтров содержит «Все» и по чипу на каждую действующую программу', async () => {
    const world = await buildWorld()
    await world.services.archiveProgram(world.back)

    render(<WorkoutsScreen />, { services: world.services })

    expect(await screen.findByTestId(`filter-chip-${world.chest}`)).toBeTruthy()
    expect(screen.getByTestId('filter-chip-all')).toBeTruthy()
    expect(screen.queryByTestId(`filter-chip-${world.back}`)).toBeNull()
  })
})
