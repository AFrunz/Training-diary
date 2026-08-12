import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import type { FakePorts } from '../../../../app/testing/fakes'
import type { Id } from '../../../../domain/model/types'
import { instant, localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders } from '../../../testing/render'
import { WorkoutScreen } from '../WorkoutScreen'

/** Тренировка началась 11 августа 2026 года в 18:32 по Москве. */
const STARTED_AT = Date.parse('2026-08-11T15:32:00Z')

interface Fixture {
  readonly services: Services
  readonly ports: FakePorts
  readonly workoutId: Id
  readonly benchId: Id
  readonly flyId: Id
}

const seed = async (options: { exercises?: boolean } = {}): Promise<Fixture> => {
  const { services, ports } = createTestServices()
  ports.clock.set(instant(STARTED_AT))

  const benchId = await services.createExercise({ name: 'Жим лёжа' })
  const flyId = await services.createExercise({ name: 'Разводка гантелей' })
  const programId = await services.createProgram({
    name: 'Грудь + трицепс',
    exerciseIds: options.exercises === false ? [] : [benchId, flyId],
  })
  const workoutId = await services.createWorkout({ date: localDate('2026-08-11'), programId })

  return { services, ports, workoutId, benchId, flyId }
}

const renderScreen = (fixture: Fixture) =>
  renderWithProviders(<WorkoutScreen workoutId={fixture.workoutId} />, {
    services: fixture.services,
  })

describe('WorkoutScreen', () => {
  it('показывает программу, дату и упражнения тренировки', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    expect(await screen.findByText('Жим лёжа')).toBeTruthy()
    expect(screen.getByText('Разводка гантелей')).toBeTruthy()
    expect(screen.getByTestId('header-title')).toHaveTextContent('Грудь + трицепс')
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent('11 августа, вторник')
    expect(screen.getByText('Добавить упражнение')).toBeTruthy()
  })

  it('показывает время начала тренировки в зоне устройства', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    expect(await screen.findByTestId('workout-started-at')).toHaveTextContent('начата в 18:32')
  })

  it('счётчик идёт вперёд и через 72 минуты показывает «1 ч 12 мин»', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(STARTED_AT))

    try {
      const fixture = await seed()
      renderScreen(fixture)

      expect(await screen.findByTestId('workout-timer')).toHaveTextContent('0 мин')

      await act(async () => {
        jest.advanceTimersByTime(72 * 60_000)
      })

      expect(screen.getByTestId('workout-timer')).toHaveTextContent('1 ч 12 мин')

      // догоняем отложенные уведомления кэша, иначе они всплывут после теста
      await act(async () => {
        jest.runOnlyPendingTimers()
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it('у завершённой тренировки счётчик замирает на итоговой длительности', async () => {
    const fixture = await seed()
    const items = fixture.ports.state.workoutItems
    for (const [index, item] of items.entries()) {
      fixture.ports.clock.set(instant(STARTED_AT + (index + 1) * 20 * 60_000))
      await fixture.services.toggleItemDone({
        workoutId: fixture.workoutId,
        itemId: item.id,
        done: true,
      })
    }

    renderScreen(fixture)

    // 40 минут от старта до последней отметки, живое время значения не меняет
    expect(await screen.findByTestId('workout-timer')).toHaveTextContent('40 мин')
  })

  it('пока отмечены не все упражнения, счётчик продолжает идти', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(STARTED_AT))

    try {
      const fixture = await seed()
      fixture.ports.clock.set(instant(STARTED_AT + 20 * 60_000))
      await fixture.services.toggleItemDone({
        workoutId: fixture.workoutId,
        itemId: fixture.ports.state.workoutItems[0]!.id,
        done: true,
      })

      jest.setSystemTime(new Date(STARTED_AT + 50 * 60_000))
      renderScreen(fixture)

      // отметка одного упражнения проставила finishedAt, но тренировка ещё идёт
      expect(await screen.findByTestId('workout-timer')).toHaveTextContent('50 мин')
    } finally {
      jest.useRealTimers()
    }
  })

  it('отметка упражнения уходит в сценарий и возвращается из данных', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('item-checkbox-0'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutItems[0]?.completedAt).not.toBeNull()
    })
    await waitFor(() => {
      expect(screen.getByTestId('workout-donut')).toHaveTextContent('1/2')
    })
  })

  it('добавление подхода через шит записывает его в состояние портов', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('add-set-0'))

    const weight = await screen.findByTestId('set-weight-input')
    fireEvent.changeText(weight, '80')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '8')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => {
      expect(fixture.ports.state.workoutSets).toHaveLength(1)
    })
    expect(fixture.ports.state.workoutSets[0]).toMatchObject({ weightKg: 80, reps: 8 })
    expect(await screen.findByText('80 × 8')).toBeTruthy()
  })

  it('пустая тренировка показывает бублик 0/0 и не рисует упражнений', async () => {
    const fixture = await seed({ exercises: false })
    renderScreen(fixture)

    expect(await screen.findByTestId('workout-donut')).toHaveTextContent('0/0')
    expect(screen.queryByTestId('item-checkbox-0')).toBeNull()
    expect(screen.getByTestId('add-exercise')).toBeTruthy()
  })
})

describe('WorkoutScreen — предзаполнение при повторном открытии шита (FR-4.4)', () => {
  it('второй подход подставляет значения первого, а не остаётся пустым', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('add-set-0'))
    fireEvent.changeText(await screen.findByTestId('set-weight-input'), '80')
    fireEvent.changeText(screen.getByTestId('set-reps-input'), '8')
    fireEvent.press(screen.getByTestId('set-submit'))

    await waitFor(() => expect(fixture.ports.state.workoutSets).toHaveLength(1))

    // тот же шит открывается заново: подсказка должна пересчитаться,
    // иначе при вечном кэше вернётся пустое значение первого открытия
    fireEvent.press(await screen.findByTestId('add-set-0'))

    await waitFor(() =>
      expect(screen.getByTestId('set-weight-input').props.value).toBe('80'),
    )
    expect(screen.getByTestId('set-reps-input').props.value).toBe('8')
  })
})
