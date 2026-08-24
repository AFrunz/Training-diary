import { act, fireEvent, screen, within } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import type { FakePorts } from '../../../../app/testing/fakes'
import type { FirstDayOfWeek, Id } from '../../../../domain/model/types'
import { id as makeId, instant, localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { palette, programColors } from '../../../theme/tokens'
import { CalendarScreen } from '../CalendarScreen'

/** Фейковые часы стоят на 11 августа 2026, 18:32 по Москве — как в макете. */
const NOW = '2026-08-11T15:32:00Z'
const at = (iso: string) => instant(Date.parse(iso))
const light = palette.light

interface World {
  readonly services: Services
  readonly ports: FakePorts
  readonly chest: Id
  readonly back: Id
}

const buildWorld = async (firstDayOfWeek: FirstDayOfWeek = 1): Promise<World> => {
  const { services, ports } = createTestServices()
  ports.state.settings = { ...ports.state.settings, firstDayOfWeek }

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
    await services.addSet({ workoutId, itemId: item.id, value: 60, unit: 'kg', reps: 8 })
    await services.toggleItemDone({ workoutId, itemId: item.id, done: true })
  }

  ports.clock.set(at(NOW))
  return workoutId
}

const addAbsence = async (world: World, from: string, to: string): Promise<void> => {
  await world.ports.absences.insert({
    id: makeId(`absence-${from}`),
    startDate: localDate(from),
    endDate: localDate(to),
    type: 'vacation',
    note: null,
    createdAt: at(NOW),
    updatedAt: at(NOW),
  })
}

/** TanStack Query рассылает обновления через таймер: даём им приземлиться внутри act. */
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

describe('Экран «Календарь»', () => {
  it('показывает месяц и год из заголовка макета', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })

    expect(await screen.findByTestId('calendar-title')).toHaveTextContent('Август 2026')
  })

  it('в день тренировки появляется точка цвета программы', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-08-07',
      programId: world.back,
      done: 3,
      startedAt: '2026-08-07T09:00:00Z',
      finishedAt: '2026-08-07T10:00:00Z',
    })

    render(<CalendarScreen />, { services: world.services })

    expect(await screen.findByTestId('calendar-dot-2026-08-07')).toHaveStyle({
      backgroundColor: programColors['prog-blue'],
    })
    expect(screen.queryByTestId('calendar-dot-2026-08-06')).toBeNull()
  })

  it('дни отпуска залиты серым', async () => {
    const world = await buildWorld()
    await addAbsence(world, '2026-08-17', '2026-08-23')

    render(<CalendarScreen />, { services: world.services })

    expect(await screen.findByTestId('calendar-day-2026-08-18')).toHaveStyle({
      backgroundColor: light.surface2,
    })
    expect(screen.getByTestId('calendar-day-2026-08-23')).toHaveStyle({ backgroundColor: light.surface2 })
    expect(screen.getByTestId('calendar-day-2026-08-24')).toHaveStyle({ backgroundColor: 'transparent' })
  })

  it('сегодняшний день выделен', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })

    expect(await screen.findByTestId('calendar-day-2026-08-11')).toHaveStyle({
      backgroundColor: light.accentSoft,
    })
    expect(screen.getByTestId('calendar-day-2026-08-11-num')).toHaveStyle({ color: light.accent })
    expect(screen.getByTestId('calendar-day-2026-08-12')).toHaveStyle({ backgroundColor: 'transparent' })
  })

  it('дни соседних месяцев приглушены', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })

    expect(await screen.findByTestId('calendar-day-2026-07-27-num')).toHaveStyle({
      color: light.textMuted,
    })
    expect(screen.getByTestId('calendar-day-2026-09-01-num')).toHaveStyle({ color: light.textMuted })
    expect(screen.getByTestId('calendar-day-2026-08-12-num')).toHaveStyle({ color: light.textPrimary })
  })

  it('переключение месяца меняет заголовок и сетку', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })
    await screen.findByTestId('calendar-day-2026-08-11')

    fireEvent.press(screen.getByTestId('calendar-prev-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('Июль 2026')
    expect(screen.getByTestId('calendar-day-2026-07-15')).toBeTruthy()
    expect(screen.queryByTestId('calendar-day-2026-08-11')).toBeNull()

    fireEvent.press(screen.getByTestId('calendar-prev-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('Июнь 2026')

    fireEvent.press(screen.getByTestId('calendar-next-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('Июль 2026')
  })

  it('переключение месяца через январь меняет год', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })
    await screen.findByTestId('calendar-day-2026-08-11')

    for (let step = 0; step < 8; step += 1) {
      fireEvent.press(screen.getByTestId('calendar-prev-month'))
    }
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('Декабрь 2025')
  })

  it('вперёд ходить можно: отпуск планируют заранее', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })
    await screen.findByTestId('calendar-day-2026-08-11')

    fireEvent.press(screen.getByTestId('calendar-next-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('Сентябрь 2026')
  })

  it('неделя начинается с понедельника по настройкам', async () => {
    const world = await buildWorld(1)
    render(<CalendarScreen />, { services: world.services })

    expect(await screen.findByTestId('calendar-weekday-0')).toHaveTextContent('Пн')
    expect(screen.getByTestId('calendar-weekday-6')).toHaveTextContent('Вс')
    expect(screen.getByTestId('calendar-day-2026-07-27')).toBeTruthy()
    expect(screen.queryByTestId('calendar-day-2026-07-26')).toBeNull()
  })

  it('неделя начинается с воскресенья по настройкам', async () => {
    const world = await buildWorld(7)
    render(<CalendarScreen />, { services: world.services })

    expect(await screen.findByTestId('calendar-weekday-0')).toHaveTextContent('Вс')
    expect(screen.getByTestId('calendar-weekday-1')).toHaveTextContent('Пн')
    expect(screen.getByTestId('calendar-day-2026-07-26')).toBeTruthy()
  })

  it('легенда перечисляет программы и отпуск', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })

    await screen.findByTestId(`legend-item-${world.chest}`)

    const legend = screen.getByTestId('calendar-legend')
    expect(within(legend).getByText('Грудь + трицепс')).toBeTruthy()
    expect(within(legend).getByText('Спина + бицепс')).toBeTruthy()
    expect(within(legend).getByText('Отпуск')).toBeTruthy()
    expect(screen.getByTestId(`legend-dot-${world.chest}`)).toHaveStyle({
      backgroundColor: programColors['prog-red'],
    })
  })

  it('идущая тренировка даёт кнопку «Продолжить тренировку»', async () => {
    const world = await buildWorld()
    const workoutId = await addWorkout(world, {
      date: '2026-08-11',
      programId: world.chest,
      done: 1,
      startedAt: '2026-08-11T14:20:00Z',
      finishedAt: '2026-08-11T15:00:00Z',
    })
    const onContinueWorkout = jest.fn()

    render(<CalendarScreen onContinueWorkout={onContinueWorkout} />, { services: world.services })

    expect(await screen.findByTestId('calendar-today-title')).toHaveTextContent('Сегодня · Грудь + трицепс')
    expect(screen.getByTestId('calendar-today-sub')).toHaveTextContent('Идёт · 1 ч 12 мин')

    fireEvent.press(screen.getByTestId('calendar-continue-workout'))
    expect(onContinueWorkout).toHaveBeenCalledWith(workoutId)
    expect(screen.queryByTestId('calendar-create-workout')).toBeNull()
  })

  it('без сегодняшней тренировки предлагает её создать', async () => {
    const world = await buildWorld()
    const onCreateWorkout = jest.fn()

    render(<CalendarScreen onCreateWorkout={onCreateWorkout} />, { services: world.services })

    expect(await screen.findByTestId('calendar-today-title')).toHaveTextContent('Сегодня тренировки нет')

    fireEvent.press(screen.getByTestId('calendar-create-workout'))
    expect(onCreateWorkout).toHaveBeenCalledWith(localDate('2026-08-11'))
    expect(screen.queryByTestId('calendar-continue-workout')).toBeNull()
  })

  it('мини-статистика считает тренировки месяца', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-08-03',
      programId: world.chest,
      done: 3,
      startedAt: '2026-08-03T09:00:00Z',
      finishedAt: '2026-08-03T10:00:00Z',
    })
    await addWorkout(world, {
      date: '2026-08-05',
      programId: world.back,
      done: 3,
      startedAt: '2026-08-05T09:00:00Z',
      finishedAt: '2026-08-05T10:40:00Z',
    })

    render(<CalendarScreen />, { services: world.services })

    const workouts = await screen.findByTestId('calendar-stat-workouts')
    expect(within(workouts).getByText('2')).toBeTruthy()
    expect(within(screen.getByTestId('calendar-stat-average')).getByText('1 ч 20 мин')).toBeTruthy()
  })

  it('сегмент «Год» переключается и убирает сетку месяца', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })
    await screen.findByTestId('calendar-day-2026-08-11')

    fireEvent.press(screen.getByTestId('calendar-mode-year'))
    expect(await screen.findByTestId('calendar-year-grid')).toBeTruthy()
    expect(screen.queryByTestId('calendar-day-2026-08-11')).toBeNull()

    fireEvent.press(screen.getByTestId('calendar-mode-month'))
    expect(screen.getByTestId('calendar-day-2026-08-11')).toBeTruthy()
    expect(screen.queryByTestId('calendar-year-grid')).toBeNull()
  })

  it('нажатие на день сообщает выбранную дату', async () => {
    const world = await buildWorld()
    const onOpenDay = jest.fn()
    render(<CalendarScreen onOpenDay={onOpenDay} />, { services: world.services })

    fireEvent.press(await screen.findByTestId('calendar-day-2026-08-14'))
    expect(onOpenDay).toHaveBeenCalledWith(localDate('2026-08-14'))
  })
})

describe('Экран «Календарь» — режим года', () => {
  /** Переводит экран в годовой режим и дожидается сетки. */
  const openYear = async (world: World): Promise<void> => {
    render(<CalendarScreen />, { services: world.services })
    await screen.findByTestId('calendar-day-2026-08-11')
    fireEvent.press(screen.getByTestId('calendar-mode-year'))
    await screen.findByTestId('calendar-year-grid')
  }

  it('рисует все двенадцать мини-месяцев', async () => {
    const world = await buildWorld()
    await openYear(world)

    for (let month = 1; month <= 12; month += 1) {
      expect(screen.getByTestId(`calendar-year-month-${month}`)).toBeTruthy()
    }
    expect(screen.getByTestId('calendar-year-month-1-label')).toHaveTextContent('Январь')
    expect(screen.getByTestId('calendar-year-month-12-label')).toHaveTextContent('Декабрь')
  })

  it('день с тренировкой закрашен цветом программы', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-03-05',
      programId: world.chest,
      done: 3,
      startedAt: '2026-03-05T09:00:00Z',
      finishedAt: '2026-03-05T10:00:00Z',
    })
    await addWorkout(world, {
      date: '2026-04-07',
      programId: world.back,
      done: 3,
      startedAt: '2026-04-07T09:00:00Z',
      finishedAt: '2026-04-07T10:00:00Z',
    })

    await openYear(world)

    expect(screen.getByTestId('calendar-year-day-2026-03-05')).toHaveStyle({
      backgroundColor: programColors['prog-red'],
    })
    expect(screen.getByTestId('calendar-year-day-2026-04-07')).toHaveStyle({
      backgroundColor: programColors['prog-blue'],
    })
    expect(screen.getByTestId('calendar-year-day-2026-03-06')).toHaveStyle({
      backgroundColor: light.track,
    })
  })

  it('дни отсутствия отмечены приглушённым серым', async () => {
    const world = await buildWorld()
    await addAbsence(world, '2026-02-16', '2026-02-22')

    await openYear(world)

    expect(screen.getByTestId('calendar-year-day-2026-02-18')).toHaveStyle({
      backgroundColor: light.textMuted,
      opacity: 0.55,
    })
    expect(screen.getByTestId('calendar-year-day-2026-02-23')).toHaveStyle({
      backgroundColor: light.track,
    })
  })

  it('дни соседних месяцев в мини-месяц не попадают', async () => {
    const world = await buildWorld()
    await openYear(world)

    const march = screen.getByTestId('calendar-year-month-3')
    expect(within(march).queryByTestId('calendar-year-day-2026-02-28')).toBeNull()
    expect(within(march).getByTestId('calendar-year-day-2026-03-01')).toBeTruthy()
  })

  it('текущий месяц выделен акцентом', async () => {
    const world = await buildWorld()
    await openYear(world)

    expect(screen.getByTestId('calendar-year-month-8')).toHaveStyle({ borderColor: light.accent })
    expect(screen.getByTestId('calendar-year-month-8-label')).toHaveStyle({ color: light.accent })
    expect(screen.getByTestId('calendar-year-month-7')).toHaveStyle({ borderColor: 'transparent' })
    expect(screen.getByTestId('calendar-year-month-7-label')).toHaveStyle({
      color: light.textSecondary,
    })
  })

  it('стрелки листают годы, а не месяцы', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2025-05-06',
      programId: world.chest,
      done: 3,
      startedAt: '2025-05-06T09:00:00Z',
      finishedAt: '2025-05-06T10:00:00Z',
    })

    await openYear(world)
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2026')

    fireEvent.press(screen.getByTestId('calendar-prev-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2025')
    expect(await screen.findByTestId('calendar-year-day-2025-05-06')).toHaveStyle({
      backgroundColor: programColors['prog-red'],
    })
    expect(screen.queryByTestId('calendar-year-month-8')).toHaveStyle({
      borderColor: 'transparent',
    })

    fireEvent.press(screen.getByTestId('calendar-next-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2026')
    await screen.findByTestId('calendar-year-day-2026-08-11')
  })

  it('в годовом режиме вперёд тоже можно', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })
    await screen.findByTestId('calendar-day-2026-08-11')

    fireEvent.press(screen.getByTestId('calendar-mode-year'))
    await screen.findByTestId('calendar-year-grid')
    fireEvent.press(screen.getByTestId('calendar-next-month'))

    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2027')
  })

  it('возврат в месяц показывает тот же период', async () => {
    const world = await buildWorld()
    render(<CalendarScreen />, { services: world.services })
    await screen.findByTestId('calendar-day-2026-08-11')

    fireEvent.press(screen.getByTestId('calendar-prev-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('Июль 2026')

    fireEvent.press(screen.getByTestId('calendar-mode-year'))
    await screen.findByTestId('calendar-year-grid')
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2026')

    fireEvent.press(screen.getByTestId('calendar-mode-month'))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('Июль 2026')
    expect(await screen.findByTestId('calendar-day-2026-07-15')).toBeTruthy()
  })

  it('итоги года берутся из сценария yearStats', async () => {
    const world = await buildWorld()
    await addWorkout(world, {
      date: '2026-01-13',
      programId: world.chest,
      done: 3,
      startedAt: '2026-01-13T09:00:00Z',
      finishedAt: '2026-01-13T10:00:00Z',
    })
    await addWorkout(world, {
      date: '2026-06-09',
      programId: world.back,
      done: 3,
      startedAt: '2026-06-09T09:00:00Z',
      finishedAt: '2026-06-09T10:00:00Z',
    })
    await addAbsence(world, '2026-07-01', '2026-07-10')

    const expected = await world.services.yearStats({
      anyDateOfYear: localDate('2026-01-01'),
      today: localDate('2026-08-11'),
    })

    await openYear(world)

    const workouts = await screen.findByTestId('calendar-stat-workouts')
    expect(within(workouts).getByText(String(expected.workouts))).toBeTruthy()
    expect(
      within(screen.getByTestId('calendar-stat-per-week')).getByText(
        (expected.perWeek ?? 0).toFixed(1),
      ),
    ).toBeTruthy()
    const absence = screen.getByTestId('calendar-stat-absence')
    expect(within(absence).getByText(String(expected.absenceDays))).toBeTruthy()
    expect(within(absence).getByText('дней отсутствия')).toBeTruthy()
    expect(screen.queryByTestId('calendar-stat-average')).toBeNull()
  })
})

describe('CalendarScreen — заведение отсутствия (FR-1.6)', () => {
  it('долгое нажатие по дню отдаёт его дату', async () => {
    const { services } = createTestServices()
    const onAddAbsence = jest.fn()
    render(<CalendarScreen onAddAbsence={onAddAbsence} />, { services })

    fireEvent(await screen.findByTestId('calendar-day-2026-08-17'), 'longPress')

    expect(onAddAbsence).toHaveBeenCalledWith('2026-08-17')
  })

  it('обычное нажатие по дню отсутствие не заводит', async () => {
    const { services } = createTestServices()
    const onAddAbsence = jest.fn()
    render(<CalendarScreen onAddAbsence={onAddAbsence} />, { services })

    fireEvent.press(await screen.findByTestId('calendar-day-2026-08-17'))

    expect(onAddAbsence).not.toHaveBeenCalled()
  })
})
