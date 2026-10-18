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

  it('дельта к прошлому разу: прибавка в весе', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-07-26', [[77.5, 8]])
    await fixture.addWorkout('2026-08-02', [[80, 8]])

    renderScreen(fixture)

    // список идёт от свежих к старым
    expect(await screen.findByTestId('history-workout-0')).toHaveTextContent(/2 августа/)
    expect(screen.getByTestId('history-delta-0')).toHaveTextContent('+2.5 кг')
    // у самой первой тренировки сравнивать не с чем
    expect(screen.queryByTestId('history-delta-1')).toBeNull()
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

describe('ExerciseHistoryScreen — объём (FR-5.5)', () => {
  it('объём — третья метрика графика рядом с весом и 1ПМ', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [[80, 8]])
    await fixture.addWorkout('2026-08-11', [
      [80, 8],
      [80, 6],
    ])

    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('history-metric-volume'))

    // пик — свежая тренировка: 80×8 + 80×6 = 1120
    await waitFor(() => expect(screen.getByText('1120')).toBeTruthy())
    // отдельной карточки «за всё время» больше нет
    expect(screen.queryByTestId('history-volume')).toBeNull()
  })

  it('у упражнения без веса объём считается повторами', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-11', [
      [null, 12],
      [null, 10],
    ])

    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('history-metric-volume'))

    await waitFor(() => expect(screen.getByText('22')).toBeTruthy())
  })

  it('объём в графике переводится в единицы из настроек', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-11', [[100, 10]])
    await fixture.ports.settings.set({ ...fixture.ports.state.settings, unit: 'lb' })

    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('history-metric-volume'))

    // 1000 кг = 2205 фунтов
    await waitFor(() => expect(screen.getByText('2205')).toBeTruthy())
  })
})

describe('ExerciseHistoryScreen — плашки изменений (FR-5.5)', () => {
  it('вес прежний, но объём вырос — плашка объёма вместо «без изменений»', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [[80, 8]])
    await fixture.addWorkout('2026-08-11', [
      [80, 8],
      [80, 8],
    ])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-volume-delta-0')).toHaveTextContent('объём +640 кг')
    expect(screen.queryByTestId('history-delta-0')).toBeNull()
  })

  it('выросли и вес, и объём — две плашки', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [[80, 8]])
    await fixture.addWorkout('2026-08-11', [[82.5, 8]])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-delta-0')).toHaveTextContent('+2.5 кг')
    expect(screen.getByTestId('history-volume-delta-0')).toHaveTextContent('объём +20 кг')
  })

  it('«без изменений» — только когда не сдвинулись ни вес, ни объём', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [[80, 8]])
    await fixture.addWorkout('2026-08-11', [[80, 8]])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-delta-0')).toHaveTextContent('без изменений')
    expect(screen.queryByTestId('history-volume-delta-0')).toBeNull()
  })

  it('объём упал — плашка со знаком минус', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [
      [80, 8],
      [80, 8],
    ])
    await fixture.addWorkout('2026-08-11', [[80, 8]])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-volume-delta-0')).toHaveTextContent('объём −640 кг')
  })

  it('у упражнения без веса объём сравнивается повторами', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [[null, 10]])
    await fixture.addWorkout('2026-08-11', [[null, 12]])

    renderScreen(fixture)

    expect(await screen.findByTestId('history-volume-delta-0')).toHaveTextContent('объём +2 повтора')
  })
})

describe('ExerciseHistoryScreen — тап по столбику графика (FR-5.2)', () => {
  it('число показывается у выбранного столбика, а не только у пика', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [[75, 8]])
    await fixture.addWorkout('2026-08-11', [[82.5, 6]])

    renderScreen(fixture)

    // до тапа видно только пик
    expect(await screen.findByTestId('history-bar-value-1')).toHaveTextContent('82.5')
    expect(screen.queryByTestId('history-bar-value-0')).toBeNull()

    fireEvent.press(screen.getByTestId('history-bar-0'))

    expect(screen.getByTestId('history-bar-value-0')).toHaveTextContent('75')
  })

  it('повторный тап снимает выбор', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-04', [[75, 8]])
    await fixture.addWorkout('2026-08-11', [[82.5, 6]])

    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('history-bar-0'))
    fireEvent.press(screen.getByTestId('history-bar-0'))

    expect(screen.queryByTestId('history-bar-value-0')).toBeNull()
  })
})

describe('ExerciseHistoryScreen — правка упражнения (FR-2.5)', () => {
  it('группа мышц показывается переводом, а не ключом', async () => {
    const { services, ports } = createTestServices()
    const exerciseId = await services.createExercise({ name: 'Тяга блока', muscleGroup: 'back' })

    renderWithProviders(<ExerciseHistoryScreen exerciseId={exerciseId} />, { services })

    // в базе лежит ключ 'back', на экране — перевод
    expect(await screen.findByTestId('header-subtitle')).toHaveTextContent('Спина · 0 тренировок')
    expect(ports.state.exercises[0]?.muscleGroup).toBe('back')
  })

  it('упражнение переименовывается из шита', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('exercise-edit'))
    fireEvent.changeText(await screen.findByTestId('exercise-name-input'), 'Жим штанги лёжа')
    fireEvent.press(screen.getByTestId('exercise-save'))

    await waitFor(() => {
      expect(fixture.ports.state.exercises[0]?.name).toBe('Жим штанги лёжа')
    })
    expect(await screen.findByTestId('header-title')).toHaveTextContent('Жим штанги лёжа')
  })

  it('группа мышц меняется там же', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('exercise-edit'))
    fireEvent.press(await screen.findByTestId('muscle-group-back'))
    fireEvent.press(screen.getByTestId('exercise-save'))

    await waitFor(() => {
      expect(fixture.ports.state.exercises[0]?.muscleGroup).toBe('back')
    })
  })

  it('удаление спрашивает подтверждение и уводит с экрана', async () => {
    const fixture = await seed()
    const onDeleted = jest.fn()
    renderWithProviders(
      <ExerciseHistoryScreen exerciseId={fixture.exerciseId} onDeleted={onDeleted} />,
      { services: fixture.services },
    )

    fireEvent.press(await screen.findByTestId('exercise-edit'))
    fireEvent.press(await screen.findByTestId('exercise-delete'))
    expect(await screen.findByTestId('delete-exercise-title')).toBeTruthy()

    fireEvent.press(screen.getByTestId('delete-exercise-confirm'))

    await waitFor(() => {
      expect(fixture.ports.state.exercises).toHaveLength(0)
    })
    expect(onDeleted).toHaveBeenCalled()
  })

  it('использованное упражнение уходит в архив, а история остаётся (FR-2.4)', async () => {
    const fixture = await seed()
    await fixture.addWorkout('2026-08-11', [[80, 8]])
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('exercise-edit'))
    fireEvent.press(await screen.findByTestId('exercise-delete'))
    fireEvent.press(await screen.findByTestId('delete-exercise-confirm'))

    await waitFor(() => {
      expect(fixture.ports.state.exercises[0]?.archivedAt).not.toBeNull()
    })
    expect(fixture.ports.state.workoutSets).toHaveLength(1)
  })
})
