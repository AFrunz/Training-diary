import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import type { FakePorts } from '../../../../app/testing/fakes'
import type { Id } from '../../../../domain/model/types'
import { localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders } from '../../../testing/render'
import { ProgramScreen } from '../ProgramScreen'

interface Fixture {
  services: Services
  ports: FakePorts
  programId: Id
  bench: Id
  fly: Id
  dips: Id
}

const seed = async (): Promise<Fixture> => {
  const { services, ports } = createTestServices()

  const bench = await services.createExercise({ name: 'Жим лёжа', muscleGroup: 'Грудь' })
  const fly = await services.createExercise({ name: 'Разводка гантелей' })
  const dips = await services.createExercise({ name: 'Отжимания на брусьях' })

  const programId = await services.createProgram({
    name: 'Грудь + трицепс',
    color: 'prog-red',
    exerciseIds: [bench, fly, dips],
  })

  return { services, ports, programId, bench, fly, dips }
}

const renderScreen = (fixture: Fixture) =>
  renderWithProviders(<ProgramScreen programId={fixture.programId} />, { services: fixture.services })

describe('ProgramScreen', () => {
  it('показывает состав в порядке программы', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    expect(await screen.findByTestId('program-item-0')).toHaveTextContent(/Жим лёжа/)
    expect(screen.getByTestId('program-item-1')).toHaveTextContent(/Разводка гантелей/)
    expect(screen.getByTestId('program-item-2')).toHaveTextContent(/Отжимания на брусьях/)
  })

  it('в подзаголовке — число упражнений и тренировок', async () => {
    const fixture = await seed()
    await fixture.services.createWorkout({ date: localDate('2026-08-10'), programId: fixture.programId })
    await fixture.services.createWorkout({ date: localDate('2026-08-11'), programId: fixture.programId })

    renderScreen(fixture)

    expect(await screen.findByTestId('header-subtitle')).toHaveTextContent('3 упражнения · 2 тренировки')
  })

  it('выбор цвета сохраняется через порты', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('program-color-prog-green'))

    await waitFor(async () => {
      const program = await fixture.ports.programs.byId(fixture.programId)
      expect(program?.color).toBe('prog-green')
    })
    await waitFor(() => expect(screen.getByTestId('program-color-prog-green')).toBeSelected())
  })

  it('удаление упражнения меняет состав, но не трогает проведённую тренировку', async () => {
    const fixture = await seed()
    const workoutId = await fixture.services.createWorkout({
      date: localDate('2026-08-11'),
      programId: fixture.programId,
    })

    renderScreen(fixture)
    fireEvent.press(await screen.findByTestId('program-item-remove-1'))

    await waitFor(async () => {
      const program = await fixture.ports.programs.byIdWithItems(fixture.programId)
      expect(program?.items.map((item) => item.exerciseId)).toEqual([fixture.bench, fixture.dips])
    })

    // снапшот тренировки (FR-3.5) остаётся полным
    const workout = await fixture.ports.workouts.byId(workoutId)
    expect(workout?.items.map((item) => item.exerciseName)).toEqual([
      'Жим лёжа',
      'Разводка гантелей',
      'Отжимания на брусьях',
    ])
  })

  it('дублирование не создаёт программу сразу, а зовёт навигацию на экран создания', async () => {
    const fixture = await seed()
    const onDuplicate = jest.fn()

    renderWithProviders(<ProgramScreen programId={fixture.programId} onDuplicate={onDuplicate} />, {
      services: fixture.services,
    })

    fireEvent.press(await screen.findByTestId('program-duplicate'))

    await waitFor(() => expect(onDuplicate).toHaveBeenCalledTimes(1))
    expect(await fixture.ports.programs.list()).toHaveLength(1)
  })

  describe('порядок упражнений', () => {
    it('стрелка вниз у первого упражнения меняет порядок в портах', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      fireEvent.press(await screen.findByTestId('program-item-down-0'))

      await waitFor(async () => {
        const program = await fixture.ports.programs.byIdWithItems(fixture.programId)
        expect(program?.items.map((item) => item.exerciseId)).toEqual([
          fixture.fly,
          fixture.bench,
          fixture.dips,
        ])
      })
    })

    it('после перестановки список перерисован в новом порядке', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      fireEvent.press(await screen.findByTestId('program-item-down-0'))

      await waitFor(() =>
        expect(screen.getByTestId('program-item-0')).toHaveTextContent(/Разводка гантелей/),
      )
      expect(screen.getByTestId('program-item-1')).toHaveTextContent(/Жим лёжа/)
      expect(screen.getByTestId('program-item-2')).toHaveTextContent(/Отжимания на брусьях/)
    })

    it('стрелка вверх ведёт упражнение к началу списка', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      fireEvent.press(await screen.findByTestId('program-item-up-2'))

      await waitFor(async () => {
        const program = await fixture.ports.programs.byIdWithItems(fixture.programId)
        expect(program?.items.map((item) => item.exerciseId)).toEqual([
          fixture.bench,
          fixture.dips,
          fixture.fly,
        ])
      })
    })

    it('у первого упражнения стрелка вверх недоступна, у последнего — вниз', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      expect((await screen.findByTestId('program-item-up-0')).props.accessibilityState).toMatchObject({
        disabled: true,
      })
      expect(screen.getByTestId('program-item-down-0').props.accessibilityState).toMatchObject({
        disabled: false,
      })
      expect(screen.getByTestId('program-item-down-2').props.accessibilityState).toMatchObject({
        disabled: true,
      })
      expect(screen.getByTestId('program-item-up-2').props.accessibilityState).toMatchObject({
        disabled: false,
      })
    })

    it('нажатие на недоступную стрелку ничего не меняет', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      fireEvent.press(await screen.findByTestId('program-item-up-0'))

      const program = await fixture.ports.programs.byIdWithItems(fixture.programId)
      expect(program?.items.map((item) => item.exerciseId)).toEqual([
        fixture.bench,
        fixture.fly,
        fixture.dips,
      ])
    })
  })

  it('архивация убирает программу из списка действующих', async () => {
    const fixture = await seed()
    renderScreen(fixture)

    fireEvent.press(await screen.findByTestId('program-archive'))

    await waitFor(async () => expect(await fixture.ports.programs.list()).toHaveLength(0))
    expect(await fixture.ports.programs.list({ includeArchived: true })).toHaveLength(1)
  })

  describe('переименование (FR-3.1.3)', () => {
    it('поле показывает текущее название', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      expect(await screen.findByTestId('program-name-input')).toHaveProp('value', 'Грудь + трицепс')
    })

    it('новое название сохраняется по завершении ввода', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      fireEvent.changeText(await screen.findByTestId('program-name-input'), 'День А')
      fireEvent(screen.getByTestId('program-name-input'), 'submitEditing')

      await waitFor(async () => {
        expect((await fixture.ports.programs.byId(fixture.programId))?.name).toBe('День А')
      })
      expect(await screen.findByTestId('header-title')).toHaveTextContent('День А')
    })

    it('пустое название не сохраняется, поле возвращается к прежнему', async () => {
      const fixture = await seed()
      renderScreen(fixture)

      fireEvent.changeText(await screen.findByTestId('program-name-input'), '   ')
      fireEvent(screen.getByTestId('program-name-input'), 'blur')

      await waitFor(() => {
        expect(screen.getByTestId('program-name-input')).toHaveProp('value', 'Грудь + трицепс')
      })
      expect((await fixture.ports.programs.byId(fixture.programId))?.name).toBe('Грудь + трицепс')
    })

    it('проведённая тренировка сохраняет прежнее название (FR-3.5)', async () => {
      const fixture = await seed()
      const workoutId = await fixture.services.createWorkout({
        date: localDate('2026-08-11'),
        programId: fixture.programId,
      })
      renderScreen(fixture)

      fireEvent.changeText(await screen.findByTestId('program-name-input'), 'День А')
      fireEvent(screen.getByTestId('program-name-input'), 'submitEditing')

      await waitFor(async () => {
        expect((await fixture.ports.programs.byId(fixture.programId))?.name).toBe('День А')
      })
      const workout = await fixture.ports.workouts.byId(workoutId)
      expect(workout?.workout.programName).toBe('Грудь + трицепс')
    })
  })

  it('пустой состав показывает подсказку вместо списка', async () => {
    const { services, ports } = createTestServices()
    const programId = await services.createProgram({ name: 'Пустая' })

    renderWithProviders(<ProgramScreen programId={programId} />, { services })

    expect(await screen.findByText('Пока пусто')).toBeTruthy()
    expect(await ports.programs.byIdWithItems(programId)).toBeTruthy()
  })
})
