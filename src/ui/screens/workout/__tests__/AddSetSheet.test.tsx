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
  await services.addSet({ workoutId: previousId, itemId: previousItem.id, value: 80, unit: 'kg', reps: 8 })
  ports.clock.set(instant(STARTED_AT))
}

const renderSheet = (
  fixture: Fixture,
  onClose = jest.fn(),
  setNumber = 1,
  extra: Partial<React.ComponentProps<typeof AddSetSheet>> = {},
) => {
  renderWithProviders(
    <AddSetSheet
      workoutId={fixture.workoutId}
      itemId={fixture.itemId}
      exerciseName="Жим лёжа"
      setNumber={setNumber}
      unit="kg"
      onClose={onClose}
      {...extra}
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
      unit: 'kg',
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

describe('AddSetSheet — единица подхода (FR-4.11)', () => {
  it('фунты записываются в килограммах, а единица запоминается', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    await waitForSuggestion()

    fireEvent.press(screen.getByTestId('set-unit-lb'))
    fireEvent.changeText(screen.getByTestId('set-weight-input'), '180')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '8')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutSets).toHaveLength(1)
    })
    const stored = fixture.ports.state.workoutSets[0]!
    expect(stored.unit).toBe('lb')
    expect(stored.weightKg).toBeCloseTo(81.6, 1)
  })

  it('градусы уходят в угол, а не в вес', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    await waitForSuggestion()

    fireEvent.press(screen.getByTestId('set-unit-deg'))
    fireEvent.changeText(screen.getByTestId('set-weight-input'), '45')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '15')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutSets).toHaveLength(1)
    })
    expect(fixture.ports.state.workoutSets[0]).toMatchObject({
      unit: 'deg',
      angleDeg: 45,
      weightKg: null,
    })
  })

  it('переключение килограммов на фунты пересчитывает число в поле', async () => {
    const fixture = await seed()
    await seedPreviousWorkout(fixture)
    renderSheet(fixture)

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-input').props.value).toBe('80')
    })

    fireEvent.press(screen.getByTestId('set-unit-lb'))
    expect(screen.getByTestId('set-weight-input').props.value).toBe('176')
  })

  it('переход на градусы очищает поле: это другая величина', async () => {
    const fixture = await seed()
    await seedPreviousWorkout(fixture)
    renderSheet(fixture)

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-input').props.value).toBe('80')
    })

    fireEvent.press(screen.getByTestId('set-unit-deg'))
    expect(screen.getByTestId('set-weight-input').props.value).toBe('')
  })

  it('запредельный угол не уходит в запись: кнопка неактивна', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    await waitForSuggestion()

    fireEvent.press(screen.getByTestId('set-unit-deg'))
    fireEvent.changeText(screen.getByTestId('set-weight-input'), '120')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '15')

    expect(screen.getByTestId('set-submit').props.accessibilityState).toMatchObject({
      disabled: true,
    })
    fireEvent.press(screen.getByTestId('set-submit'))
    await waitForSuggestion()
    expect(fixture.ports.state.workoutSets).toHaveLength(0)
  })

  it('шаг кнопки «+» зависит от единицы', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    await waitForSuggestion()

    fireEvent.changeText(screen.getByTestId('set-weight-input'), '80')
    fireEvent.press(screen.getByTestId('set-weight-plus'))
    expect(screen.getByTestId('set-weight-input').props.value).toBe('82.5')

    fireEvent.press(screen.getByTestId('set-unit-deg'))
    fireEvent.changeText(screen.getByTestId('set-weight-input'), '30')
    fireEvent.press(screen.getByTestId('set-weight-plus'))
    expect(screen.getByTestId('set-weight-input').props.value).toBe('35')
  })
})

describe('AddSetSheet — правка подхода (FR-4.4.1)', () => {
  /** Тренировка с одним записанным подходом: его и правим. */
  const seedWithSet = async () => {
    const fixture = await seed()
    await fixture.services.addSet({
      workoutId: fixture.workoutId,
      itemId: fixture.itemId,
      value: 80,
      unit: 'kg',
      reps: 8,
    })
    const set = fixture.ports.state.workoutSets[0]!
    return { fixture, set }
  }

  it('открывается с заголовком правки и значениями подхода', async () => {
    const { fixture, set } = await seedWithSet()
    renderSheet(fixture, jest.fn(), 1, { editing: set })

    expect(screen.getByTestId('add-set-title')).toHaveTextContent('Правка подхода')
    expect(screen.getByText('Жим лёжа · подход 1')).toBeTruthy()
    expect(screen.getByTestId('set-weight-input').props.value).toBe('80')
    expect(screen.getByTestId('set-reps-input').props.value).toBe('8')
  })

  it('сохранение переписывает подход, а не добавляет новый', async () => {
    const { fixture, set } = await seedWithSet()
    const onClose = renderSheet(fixture, jest.fn(), 1, { editing: set })

    fireEvent.changeText(screen.getByTestId('set-weight-input'), '85')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '5')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutSets[0]).toMatchObject({ weightKg: 85, reps: 5 })
    })
    expect(fixture.ports.state.workoutSets).toHaveLength(1)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('кнопка удаления убирает подход', async () => {
    const { fixture, set } = await seedWithSet()
    renderSheet(fixture, jest.fn(), 1, { editing: set })

    fireEvent.press(screen.getByTestId('set-delete'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutSets).toHaveLength(0)
    })
  })

  it('при добавлении кнопки удаления нет', async () => {
    const fixture = await seed()
    renderSheet(fixture)
    await waitForSuggestion()

    expect(screen.queryByTestId('set-delete')).toBeNull()
  })

  it('подсказка показывает подход прошлой тренировки под тем же номером', async () => {
    const { fixture, set } = await seedWithSet()
    const previous = { ...set, id: 'prev' as typeof set.id, weightKg: 75, reps: 10 }
    renderSheet(fixture, jest.fn(), 1, { editing: set, previousSet: previous })

    expect(screen.getByTestId('set-hint')).toHaveTextContent('Прошлый раз: 75 × 10')
  })
})
