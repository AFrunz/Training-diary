import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import type { FakePorts } from '../../../../app/testing/fakes'
import type { Id } from '../../../../domain/model/types'
import { instant, localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders } from '../../../testing/render'
import { AddSetSheet } from '../AddSetSheet'

const STARTED_AT = Date.parse('2026-08-11T15:32:00Z')

interface Fixture {
  readonly services: Services
  readonly ports: FakePorts
  readonly workoutId: Id
  readonly itemId: Id
  readonly benchId: Id
}

/** Тренировка с одним упражнением: подходов ещё нет. */
const seed = async (): Promise<Fixture> => {
  const { services, ports } = createTestServices()
  ports.clock.set(instant(STARTED_AT))

  const benchId = await services.createExercise({ name: 'Жим лёжа' })
  const programId = await services.createProgram({ name: 'Грудь', exerciseIds: [benchId] })
  const workoutId = await services.createWorkout({ date: localDate('2026-08-11'), programId })
  const itemId = ports.state.workoutItems[0]!.id

  return { services, ports, workoutId, itemId, benchId }
}

/** Прошлая тренировка того же упражнения — источник предзаполнения (FR-4.4). */
const seedPreviousWorkout = async (fixture: Fixture) => {
  const { services, ports } = fixture
  ports.clock.set(instant(Date.parse('2026-08-04T15:00:00Z')))
  const programId = ports.state.programs[0]!.id
  const previousId = await services.createWorkout({ date: localDate('2026-08-04'), programId })
  const previousItem = ports.state.workoutItems.find((item) => item.workoutId === previousId)!
  await services.addSet({ workoutId: previousId, itemId: previousItem.id, weightKg: 80, reps: 8 })
  ports.clock.set(instant(STARTED_AT))
}

const renderSheet = (fixture: Fixture, onClose = jest.fn(), setNumber = 1) => {
  renderWithProviders(
    <AddSetSheet
      workoutId={fixture.workoutId}
      itemId={fixture.itemId}
      exerciseName="Жим лёжа"
      setNumber={setNumber}
      unit="kg"
      onClose={onClose}
    />,
    { services: fixture.services },
  )
  return onClose
}

/** Дожидается предзаполнения: пока suggestNextSet не ответил, черновик пуст. */
const waitForSuggestion = async () => {
  await act(async () => {})
}

describe('AddSetSheet', () => {
  it('показывает название упражнения и номер подхода', async () => {
    const fixture = await seed()
    renderSheet(fixture, jest.fn(), 3)
    await waitForSuggestion()

    expect(screen.getByTestId('add-set-title')).toHaveTextContent('Жим лёжа')
    expect(screen.getByText('Подход 3')).toBeTruthy()
    expect(screen.getByText('Добавить подход')).toBeTruthy()
  })

  it('предзаполняет поля значениями из suggestNextSet и показывает прошлый подход', async () => {
    const fixture = await seed()
    await seedPreviousWorkout(fixture)
    renderSheet(fixture)

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-input').props.value).toBe('80')
    })
    expect(screen.getByTestId('set-reps-input').props.value).toBe('8')
    expect(screen.getByTestId('set-hint')).toHaveTextContent('Прошлый раз: 80 × 8')
  })

  it('степперы меняют вес шагом 2.5 кг, а повторы — на единицу', async () => {
    const fixture = await seed()
    await seedPreviousWorkout(fixture)
    renderSheet(fixture)

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-input').props.value).toBe('80')
    })

    fireEvent.press(screen.getByTestId('set-weight-plus'))
    expect(screen.getByTestId('set-weight-input').props.value).toBe('82.5')

    fireEvent.press(screen.getByTestId('set-weight-minus'))
    expect(screen.getByTestId('set-weight-input').props.value).toBe('80')

    fireEvent.press(screen.getByTestId('set-reps-minus'))
    expect(screen.getByTestId('set-reps-input').props.value).toBe('7')
  })

  it('быстрых чипов нет: их работу делают кнопки «−» и «+»', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    expect(screen.queryByTestId('set-quick-5')).toBeNull()
    expect(screen.queryByTestId('set-quick-2.5')).toBeNull()
    expect(screen.getByTestId('set-weight-plus')).toBeTruthy()
  })

  it('записывает подход через сценарий и закрывает шит', async () => {
    const fixture = await seed()
    const onClose = renderSheet(fixture)
    await waitForSuggestion()

    fireEvent.changeText(screen.getByTestId('set-weight-input'), '82.5')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '6')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutSets).toHaveLength(1)
    })
    expect(fixture.ports.state.workoutSets[0]).toMatchObject({
      workoutItemId: fixture.itemId,
      weightKg: 82.5,
      reps: 6,
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('подход без веса записывается с пустым весом', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    await waitForSuggestion()

    fireEvent.changeText(screen.getByTestId('set-weight-input'), '')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '12')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutSets).toHaveLength(1)
    })
    expect(fixture.ports.state.workoutSets[0]).toMatchObject({ weightKg: null, reps: 12 })
  })

  it('без повторов кнопка не отправляет подход', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    await waitForSuggestion()

    fireEvent.changeText(screen.getByTestId('set-reps-input'), '')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('set-submit')).toBeTruthy()
    })
    expect(fixture.ports.state.workoutSets).toHaveLength(0)
  })
})
