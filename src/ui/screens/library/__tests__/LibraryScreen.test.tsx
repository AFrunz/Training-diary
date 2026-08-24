import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import type { Services } from '../../../../app/container'
import { localDate } from '../../../../domain/model/types'
import { createTestServices, renderWithProviders as render } from '../../../testing/render'
import { LibraryScreen } from '../LibraryScreen'

const seed = async (services: Services) => {
  await services.createExercise({ name: 'Жим лёжа', muscleGroup: 'chest' })
  await services.createExercise({ name: 'Разводка гантелей', muscleGroup: 'chest' })
  await services.createExercise({ name: 'Подтягивания', muscleGroup: 'back' })
}

describe('Библиотека', () => {
  it('упражнения сгруппированы по мышцам', async () => {
    const { services } = createTestServices()
    await seed(services)

    render(<LibraryScreen />, { services })

    expect(await screen.findByTestId('library-group-chest')).toHaveTextContent('ГРУДЬ')
    expect(screen.getByTestId('library-group-back')).toHaveTextContent('СПИНА')
    expect(screen.getByTestId('exercise-row-Жим лёжа')).toBeTruthy()
    expect(screen.getByTestId('exercise-row-Подтягивания')).toBeTruthy()
  })

  it('поиск оставляет только подходящие упражнения', async () => {
    const { services } = createTestServices()
    await seed(services)

    render(<LibraryScreen />, { services })
    await screen.findByTestId('exercise-row-Жим лёжа')

    fireEvent.changeText(screen.getByTestId('library-search'), 'подтяг')

    await waitFor(() => expect(screen.queryByTestId('exercise-row-Жим лёжа')).toBeNull())
    expect(screen.getByTestId('exercise-row-Подтягивания')).toBeTruthy()
    expect(screen.queryByTestId('library-group-chest')).toBeNull()
  })

  it('вкладка «Программы» показывает программы с числом упражнений', async () => {
    const { services } = createTestServices()
    await seed(services)
    const exercises = await services.ports.exercises.list()
    await services.createProgram({
      name: 'Грудь + трицепс',
      color: 'prog-red',
      exerciseIds: [exercises[0]!.id, exercises[1]!.id],
    })

    render(<LibraryScreen />, { services })
    await screen.findByTestId('exercise-row-Жим лёжа')

    fireEvent.press(screen.getByTestId('library-segment-programs'))

    const row = await screen.findByTestId('program-row-Грудь + трицепс')
    expect(within(row).getByText('2 упражнения')).toBeTruthy()
    expect(screen.getByTestId('program-dot-Грудь + трицепс')).toBeTruthy()
    expect(screen.queryByTestId('exercise-row-Жим лёжа')).toBeNull()

    fireEvent.press(screen.getByTestId('library-segment-exercises'))
    expect(await screen.findByTestId('exercise-row-Жим лёжа')).toBeTruthy()
  })

  it('пустая библиотека объясняет, что делать', async () => {
    const { services } = createTestServices()

    render(<LibraryScreen />, { services })

    const empty = await screen.findByTestId('library-empty')
    expect(within(empty).getByText('Упражнений пока нет')).toBeTruthy()

    fireEvent.press(screen.getByTestId('library-segment-programs'))
    expect(within(await screen.findByTestId('library-empty')).getByText('Программ пока нет')).toBeTruthy()
  })

  it('кнопка добавления заводит упражнение или программу в зависимости от вкладки', async () => {
    const { services } = createTestServices()
    const onCreateExercise = jest.fn()
    const onCreateProgram = jest.fn()

    render(<LibraryScreen onCreateExercise={onCreateExercise} onCreateProgram={onCreateProgram} />, {
      services,
    })

    const button = await screen.findByTestId('add-button')
    // кнопка без подписи: назначение читается по метке доступности
    expect(button.props.accessibilityLabel).toBe('Новое упражнение')
    fireEvent.press(button)
    expect(onCreateExercise).toHaveBeenCalled()

    fireEvent.press(screen.getByTestId('library-segment-programs'))
    expect(screen.getByTestId('add-button').props.accessibilityLabel).toBe('Новая программа')
    fireEvent.press(screen.getByTestId('add-button'))
    expect(onCreateProgram).toHaveBeenCalled()
  })

  it('строка упражнения показывает рекорд и дату последнего раза', async () => {
    const { services, ports } = createTestServices()
    await services.createExercise({ name: 'Жим лёжа', muscleGroup: 'chest' })
    const [exercise] = await ports.exercises.list()
    const programId = await services.createProgram({ name: 'Грудь', exerciseIds: [exercise!.id] })
    const workoutId = await services.createWorkout({ date: localDate('2026-08-11'), programId })
    const aggregate = await ports.workouts.byId(workoutId)
    await services.addSet({ workoutId, itemId: aggregate!.items[0]!.id, value: 82.5, unit: 'kg', reps: 8 })

    render(<LibraryScreen />, { services })

    const row = await screen.findByTestId('exercise-row-Жим лёжа')
    expect(within(row).getByText('82.5 кг')).toBeTruthy()
    expect(within(row).getByText('последний раз 11 авг')).toBeTruthy()
  })
})
