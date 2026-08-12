import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { FakePorts } from '../../../../app/testing/fakes'
import { id as makeId, instant, localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders } from '../../../testing/render'
import { StatsScreen } from '../StatsScreen'

/**
 * Экранные тесты статистики. Данные кладутся прямо в фейковое состояние портов:
 * сценарии считают по ним ровно так же, как по базе.
 *
 * Часы фейковых портов стоят на 11 августа 2026 (вторник), зона Europe/Moscow.
 */

interface SeedWorkout {
  readonly date: string
  readonly program?: string
  readonly color?: string
  readonly done?: boolean
  readonly durationMs?: number
}

const HOUR = 60 * 60 * 1000

const seedWorkouts = (ports: FakePorts, workouts: readonly SeedWorkout[]): void => {
  for (const workout of workouts) {
    const programName = workout.program ?? 'Грудь + трицепс'
    const programColor = workout.color ?? 'prog-red'
    const known = ports.state.programs.find((program) => program.name === programName)
    const programId = known?.id ?? makeId(`prog-${ports.state.programs.length + 1}`)

    if (!known) {
      ports.state.programs.push({
        id: programId,
        name: programName,
        color: programColor,
        archivedAt: null,
        createdAt: instant(0),
        updatedAt: instant(0),
      })
    }

    const startedAt = instant(Date.parse(`${workout.date}T09:00:00Z`))
    const finishedAt = instant(startedAt + (workout.durationMs ?? HOUR))
    const workoutId = makeId(`workout-${workout.date}`)

    ports.state.workouts.push({
      id: workoutId,
      date: localDate(workout.date),
      programId,
      programName,
      programColor,
      startedAt,
      finishedAt,
      createdAt: startedAt,
      updatedAt: finishedAt,
    })

    ports.state.workoutItems.push({
      id: makeId(`item-${workout.date}`),
      workoutId,
      exerciseId: makeId('exercise-1'),
      exerciseName: 'Жим лёжа',
      order: 0,
      isAdHoc: false,
      completedAt: workout.done === false ? null : finishedAt,
    })
  }
}

const seedAbsence = (ports: FakePorts, from: string, to: string): void => {
  ports.state.absences.push({
    id: makeId(`absence-${from}`),
    startDate: localDate(from),
    endDate: localDate(to),
    type: 'vacation',
    createdAt: instant(0),
    updatedAt: instant(0),
  })
}

describe('экран статистики', () => {
  it('показывает метрики месяца из monthStats', async () => {
    const { services, ports } = createTestServices()
    seedWorkouts(ports, [
      { date: '2026-08-03' },
      { date: '2026-08-05' },
      { date: '2026-08-10' },
      { date: '2026-08-12' },
    ])

    renderWithProviders(<StatsScreen />, { services })

    expect(await screen.findByTestId('stat-workouts-value')).toHaveTextContent('4')
    expect(screen.getByTestId('stat-duration-value')).toHaveTextContent('1 ч 00 мин')
    expect(screen.getByTestId('stat-completion-value')).toHaveTextContent('100 %')
    expect(screen.getByTestId('stat-per-week-value')).toHaveTextContent('0.7')
    expect(screen.getByTestId('stats-period')).toHaveTextContent('Август 2026')
  })

  it('вместо отсутствующих значений показывает прочерк, а не ноль', async () => {
    const { services } = createTestServices()

    renderWithProviders(<StatsScreen />, { services })

    expect(await screen.findByTestId('stat-duration-value')).toHaveTextContent('—')
    expect(screen.getByTestId('stat-completion-value')).toHaveTextContent('—')
    // тренировок действительно ноль — здесь прочерк был бы враньём
    expect(screen.getByTestId('stat-workouts-value')).toHaveTextContent('0')
  })

  it('полный месяц отсутствия оставляет «в неделю» без значения', async () => {
    const { services, ports } = createTestServices()
    seedAbsence(ports, '2026-07-20', '2026-09-10')

    renderWithProviders(<StatsScreen />, { services })

    expect(await screen.findByTestId('stat-per-week-value')).toHaveTextContent('—')
    expect(screen.getByTestId('stat-column-absent-0')).toBeOnTheScreen()
    expect(screen.getAllByText('отпуск').length).toBeGreaterThan(0)
  })

  it('переключение на прошлый месяц меняет данные', async () => {
    const { services, ports } = createTestServices()
    seedWorkouts(ports, [
      { date: '2026-08-04' },
      { date: '2026-07-06' },
      { date: '2026-07-08' },
      { date: '2026-07-15' },
    ])

    renderWithProviders(<StatsScreen />, { services })

    expect(await screen.findByTestId('stat-workouts-value')).toHaveTextContent('1')

    fireEvent.press(screen.getByTestId('stats-prev'))

    expect(await screen.findByText('Июль 2026')).toBeOnTheScreen()
    await waitFor(() =>
      expect(screen.getByTestId('stat-workouts-value')).toHaveTextContent('3'),
    )
  })

  it('кнопка «вперёд» недоступна на текущем месяце и оживает в прошлом', async () => {
    const { services } = createTestServices()

    renderWithProviders(<StatsScreen />, { services })

    await screen.findByTestId('stat-workouts-value')
    expect(screen.getByTestId('stats-next')).toBeDisabled()

    fireEvent.press(screen.getByTestId('stats-prev'))

    expect(await screen.findByText('Июль 2026')).toBeOnTheScreen()
    expect(screen.getByTestId('stats-next')).not.toBeDisabled()

    fireEvent.press(screen.getByTestId('stats-next'))

    expect(await screen.findByText('Август 2026')).toBeOnTheScreen()
    expect(screen.getByTestId('stats-next')).toBeDisabled()
  })

  it('распределение показывает все программы периода', async () => {
    const { services, ports } = createTestServices()
    seedWorkouts(ports, [
      { date: '2026-08-03', program: 'Грудь + трицепс', color: 'prog-red' },
      { date: '2026-08-04', program: 'Спина + бицепс', color: 'prog-blue' },
      { date: '2026-08-05', program: 'Спина + бицепс', color: 'prog-blue' },
      { date: '2026-08-06', program: 'Ноги + пресс', color: 'prog-green' },
      { date: '2026-08-07', program: 'Плечи + руки', color: 'prog-violet' },
    ])

    renderWithProviders(<StatsScreen />, { services })

    expect(await screen.findByTestId('stat-program-prog-2')).toHaveTextContent('Спина + бицепс · 2')
    expect(screen.getByTestId('stat-program-prog-1')).toHaveTextContent('Грудь + трицепс · 1')
    expect(screen.getByTestId('stat-program-prog-3')).toBeOnTheScreen()
    expect(screen.getByTestId('stat-program-prog-4')).toBeOnTheScreen()
    expect(screen.getAllByTestId(/^stat-program-prog-/)).toHaveLength(4)
  })

  it('серия склоняется по числу недель', async () => {
    const { services, ports } = createTestServices()
    // март 2026 состоит из шести недель, и в каждой есть тренировка
    seedWorkouts(ports, [
      { date: '2026-03-01' },
      { date: '2026-03-03' },
      { date: '2026-03-10' },
      { date: '2026-03-17' },
      { date: '2026-03-24' },
      { date: '2026-03-31' },
    ])

    renderWithProviders(<StatsScreen />, { services })

    await screen.findByTestId('stat-workouts-value')
    for (let step = 0; step < 5; step++) {
      fireEvent.press(screen.getByTestId('stats-prev'))
    }

    expect(await screen.findByText('Март 2026')).toBeOnTheScreen()
    await waitFor(() =>
      expect(screen.getByTestId('stat-streak-current')).toHaveTextContent('6 недель подряд'),
    )
    expect(screen.getByTestId('stat-streak-record')).toHaveTextContent(/рекорд — 6 недель/)
  })

  it('в годовом режиме суммирует тренировки за все месяцы', async () => {
    const { services, ports } = createTestServices()
    seedWorkouts(ports, [{ date: '2026-03-03' }, { date: '2026-05-05' }, { date: '2026-08-04' }])

    renderWithProviders(<StatsScreen />, { services })

    await screen.findByTestId('stat-workouts-value')
    fireEvent.press(screen.getByTestId('stats-mode-year'))

    expect(await screen.findByText('2026')).toBeOnTheScreen()
    await waitFor(() =>
      expect(screen.getByTestId('stat-workouts-value')).toHaveTextContent('3'),
    )
    expect(screen.getByTestId('stats-next')).toBeDisabled()
  })

  it('высота столбика пропорциональна числу тренировок за неделю', async () => {
    const { services, ports } = createTestServices()
    seedWorkouts(ports, [
      { date: '2026-08-03' },
      { date: '2026-08-04' },
      { date: '2026-08-05' },
      { date: '2026-08-06' },
      { date: '2026-08-11' },
    ])

    renderWithProviders(<StatsScreen />, { services })

    // недели месяца: 27 июля, 3, 10, 17, 24 и 31 августа
    const tallest = await screen.findByTestId('stat-bar-1')
    const shorter = screen.getByTestId('stat-bar-2')

    expect(tallest).toHaveStyle({ height: 86 })
    expect(shorter).toHaveStyle({ height: 22 })
  })
})
