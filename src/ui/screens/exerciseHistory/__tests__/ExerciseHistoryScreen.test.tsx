import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import type { FakePorts } from '../../../../app/testing/fakes'
import type { Id, WeightKg } from '../../../../domain/model/types'
import { localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders } from '../../../testing/render'
import { ExerciseHistoryScreen } from '../ExerciseHistoryScreen'

interface Fixture {
  services: Services
  ports: FakePorts
  exerciseId: Id
  addWorkout: (date: string, sets: readonly (readonly [WeightKg | null, number])[]) => Promise<Id>
}

const seed = async (options?: { muscleGroup?: string }): Promise<Fixture> => {
  const { services, ports } = createTestServices()

  const exerciseId = await services.createExercise({
    name: 'Жим лёжа',
    muscleGroup: options?.muscleGroup ?? 'Грудь',
  })
  const programId = await services.createProgram({ name: 'Грудь', exerciseIds: [exerciseId] })

  const addWorkout: Fixture['addWorkout'] = async (date, sets) => {
    const workoutId = await services.createWorkout({ date: localDate(date), programId })
    const aggregate = await ports.workouts.byId(workoutId)
    const item = aggregate!.items[0]!

    for (const [weightKg, reps] of sets) {
      await services.addSet({ workoutId, itemId: item.id, value: weightKg, unit: 'kg', reps })
    }
    return workoutId
  }

  return { services, ports, exerciseId, addWorkout }
}

const renderScreen = (fixture: Fixture) =>
  renderWithProviders(<ExerciseHistoryScreen exerciseId={fixture.exerciseId} />, {
    services: fixture.services,
  })

describe('ExerciseHistoryScreen', () => {
  it('рекорд веса считается по всем тренировкам', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-07-26', [[75, 8]])
    await fixture.addWorkout('2026-08-02', [[77.5, 8]])
    await fixture.addWorkout('2026-08-11', [
      [80, 8],
      [82.5, 6],
    ])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-record-weight-value')).toHaveTextContent('82.5 кг')
    // рекорд поставлен сегодня, прибавка к прошлому максимуму
    expect(screen.getByTestId('history-record-weight-note')).toHaveTextContent('сегодня, +5 кг')
  })

  it('максимум повторов берётся из всей истории вместе с весом', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-07-14', [[60, 12]])
    await fixture.addWorkout('2026-08-11', [[80, 8]])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-record-reps-value')).toHaveTextContent('12')
    expect(screen.getByTestId('history-record-reps-note')).toHaveTextContent('14 июля, 60 кг')
  })

  it('упражнение без истории показывает пустое состояние, а не нули', async () => {
    const fixture = await seed()

    renderScreen(fixture)

    expect(await screen.findByTestId('history-empty')).toBeTruthy()
    expect(screen.queryByTestId('history-record-weight')).toBeNull()
    expect(screen.queryByTestId('history-chart')).toBeNull()
  })

  it('дельта к прошлому разу: прибавка и «без изменений»', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-07-26', [[77.5, 8]])
    await fixture.addWorkout('2026-08-02', [[80, 6]])
    await fixture.addWorkout('2026-08-11', [[80, 8]])

    renderScreen(fixture)

    // список идёт от свежих к старым
    expect(await screen.findByTestId('history-workout-0')).toHaveTextContent(/11 августа/)
    expect(screen.getByTestId('history-delta-0')).toHaveTextContent('без изменений')
    expect(screen.getByTestId('history-delta-1')).toHaveTextContent('+2.5 кг')
    // у самой первой тренировки сравнивать не с чем
    expect(screen.queryByTestId('history-delta-2')).toBeNull()
  })

  it('подходы без веса выводятся как «× 12»', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-11', [[null, 12]])

    renderScreen(fixture)

    expect(await screen.findByText('× 12')).toBeTruthy()
  })

  it('переключение на 1ПМ меняет значения графика', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-02', [[77.5, 8]])
    await fixture.addWorkout('2026-08-11', [
      [80, 8],
      [82.5, 6],
    ])

    renderScreen(fixture)

    expect(await screen.findByText('82.5')).toBeTruthy()

    fireEvent.press(screen.getByTestId('history-metric-oneRm'))

    // 80 × 8 по Эпли → 101.33, округление показа до 0.5 кг
    await waitFor(() => expect(screen.getByText('101.5')).toBeTruthy())
    expect(screen.queryByText('82.5')).toBeNull()
  })

  it('единицы веса берутся из настроек', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-11', [[100, 5]])
    await fixture.ports.settings.set({ ...fixture.ports.state.settings, unit: 'lb' })

    renderScreen(fixture)

    expect(await screen.findByTestId('history-record-weight-value')).toHaveTextContent('220 lb')
  })

  it('в подзаголовке — группа мышц и число тренировок', async () => {
    const fixture = await seed({ muscleGroup: 'Грудь' })
    await fixture.addWorkout('2026-08-11', [[80, 8]])

    renderScreen(fixture)

    expect(await screen.findByTestId('header-subtitle')).toHaveTextContent('Грудь · 1 тренировка')
  })
})

describe('ExerciseHistoryScreen — объём упражнения (FR-5.5)', () => {
  it('складывает вес на повторы за все тренировки', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [
      [80, 8],
      [80, 6],
    ])
    await fixture.addWorkout('2026-08-11', [[82.5, 6]])

    renderScreen(fixture)

    // 80×8 + 80×6 + 82.5×6 = 1615
    expect(await screen.findByTestId('history-volume-value')).toHaveTextContent('1615 кг')
  })

  it('у упражнения без веса объём считается повторами', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-11', [
      [null, 12],
      [null, 10],
    ])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-volume-value')).toHaveTextContent('22 повтора')
  })

  it('объём показывается в единицах из настроек', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-11', [[100, 10]])
    await fixture.ports.settings.set({ ...fixture.ports.state.settings, unit: 'lb' })

    renderScreen(fixture)

    expect(await screen.findByTestId('history-volume-value')).toHaveTextContent('2205 lb')
  })
})
